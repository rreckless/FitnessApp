/**
 * SyncEngine - Manages offline-first synchronization
 * Handles sync queue, conflict resolution, and data consistency
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../database/DatabaseService';
import {
  SyncQueueEntry,
  SyncOperation,
  SyncEntityType,
  SyncStatusEnum,
  SyncConflict,
  PullResponse,
  PushRequest,
  PushResponse,
  SyncError,
  SyncException,
} from '../models/SyncModels';
import { AuthenticationService } from './AuthenticationService';

const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff: 1s, 2s, 4s, 8s
const MAX_RETRIES = 3;
const SYNC_TIMEOUT = 30000; // 30 seconds
const OFFLINE_HISTORY_DAYS = 30;

export class SyncEngine {
  private static instance: SyncEngine;
  private apiClient: AxiosInstance;
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private readonly apiBaseUrl: string;
  private readonly authService: AuthenticationService;
  private readonly db: DatabaseService;

  private constructor(
    apiBaseUrl: string = 'http://localhost:5000/api',
    authService?: AuthenticationService
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.authService = authService || AuthenticationService.getInstance();
    this.db = DatabaseService.getInstance();

    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: SYNC_TIMEOUT,
    });

    // Add request interceptor to include access token
    this.apiClient.interceptors.request.use(
      async (config) => {
        const token = await this.authService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  static getInstance(apiBaseUrl?: string, authService?: AuthenticationService): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine(apiBaseUrl, authService);
    }
    return SyncEngine.instance;
  }

  /**
   * Initialize sync engine and start periodic sync
   */
  async initialize(): Promise<void> {
    try {
      await this.db.initialize();
      this.startPeriodicSync();
    } catch (error) {
      console.error('Failed to initialize sync engine:', error);
      throw error;
    }
  }

  /**
   * Add an operation to the sync queue
   */
  async queueOperation(
    operation: SyncOperation,
    entityType: SyncEntityType,
    entityId: string,
    payload: Record<string, any>
  ): Promise<string> {
    try {
      const entry: SyncQueueEntry = {
        id: uuidv4(),
        operation,
        entityType,
        entityId,
        payload,
        status: SyncStatusEnum.PENDING,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.db.insert('sync_queue', entry);
      return entry.id;
    } catch (error) {
      console.error('Failed to queue operation:', error);
      throw new SyncException(SyncError.UNKNOWN, 'Failed to queue operation', error);
    }
  }

  /**
   * Perform a full sync cycle (pull + push)
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      // Check authentication
      const isAuthenticated = await this.authService.isAuthenticated();
      if (!isAuthenticated) {
        console.warn('User not authenticated, skipping sync');
        this.isSyncing = false;
        return;
      }

      // Pull changes from server
      await this.pull();

      // Push local changes to server
      await this.push();

      // Update last sync time
      await AsyncStorage.setItem('last_sync_time', Date.now().toString());
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull changes from server
   */
  private async pull(): Promise<void> {
    try {
      const lastSyncTime = await AsyncStorage.getItem('last_sync_time');
      const timestamp = lastSyncTime ? parseInt(lastSyncTime) : 0;

      const response = await this.apiClient.post<PullResponse>('/sync/pull', {
        timestamp,
        entityTypes: Object.values(SyncEntityType),
      });

      // Process pulled data
      for (const item of response.data.data) {
        await this.processPulledItem(item);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new SyncException(SyncError.UNAUTHORIZED, 'Unauthorized', error);
      }
      throw new SyncException(SyncError.SERVER_ERROR, 'Failed to pull changes', error);
    }
  }

  /**
   * Process a single pulled item
   */
  private async processPulledItem(item: any): Promise<void> {
    try {
      const { entityType, entityId, operation, data, timestamp } = item;

      // Check for conflicts
      const localItem = await this.getLocalItem(entityType, entityId);
      if (localItem && localItem.updatedAt > timestamp) {
        // Local version is newer, skip
        console.warn(`Conflict detected for ${entityType}:${entityId}, keeping local version`);
        return;
      }

      // Update local database
      if (operation === SyncOperation.DELETE) {
        await this.deleteLocalItem(entityType, entityId);
      } else {
        await this.upsertLocalItem(entityType, entityId, data);
      }
    } catch (error) {
      console.error('Failed to process pulled item:', error);
      // Continue processing other items
    }
  }

  /**
   * Push local changes to server
   */
  private async push(): Promise<void> {
    try {
      // Get pending operations
      const pendingOps = await this.getPendingOperations();

      if (pendingOps.length === 0) {
        return;
      }

      // Push operations
      const response = await this.apiClient.post<PushResponse>('/sync/push', {
        operations: pendingOps,
      } as PushRequest);

      // Process successful operations
      for (const id of response.data.successful) {
        await this.markSynced(id);
      }

      // Process failed operations
      for (const failure of response.data.failed) {
        await this.markFailed(failure.id, failure.error);
      }

      // Handle conflicts
      for (const conflict of response.data.conflicts) {
        await this.handleConflict(conflict);
      }

      // Retry failed operations
      await this.retryFailedOperations();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new SyncException(SyncError.UNAUTHORIZED, 'Unauthorized', error);
      }
      throw new SyncException(SyncError.SERVER_ERROR, 'Failed to push changes', error);
    }
  }

  /**
   * Get pending operations from sync queue
   */
  private async getPendingOperations(): Promise<SyncQueueEntry[]> {
    try {
      const rows = await this.db.queryAll(
        'SELECT * FROM sync_queue WHERE status IN (?, ?) ORDER BY createdAt ASC',
        [SyncStatusEnum.PENDING, SyncStatusEnum.FAILED]
      );

      return rows.map((row) => ({
        ...row,
        payload: JSON.parse(row.payload),
      }));
    } catch (error) {
      console.error('Failed to get pending operations:', error);
      return [];
    }
  }

  /**
   * Mark operation as synced
   */
  private async markSynced(operationId: string): Promise<void> {
    try {
      await this.db.update(
        'sync_queue',
        {
          status: SyncStatusEnum.SYNCED,
          updatedAt: new Date().toISOString(),
        },
        'id = ?',
        [operationId]
      );
    } catch (error) {
      console.error('Failed to mark operation as synced:', error);
    }
  }

  /**
   * Mark operation as failed
   */
  private async markFailed(operationId: string, error: string): Promise<void> {
    try {
      const entry = await this.db.queryOne('SELECT * FROM sync_queue WHERE id = ?', [operationId]);

      if (!entry) {
        return;
      }

      const retryCount = (entry.retryCount || 0) + 1;
      const status = retryCount >= MAX_RETRIES ? SyncStatusEnum.FAILED : SyncStatusEnum.PENDING;

      await this.db.update(
        'sync_queue',
        {
          status,
          retryCount,
          lastError: error,
          updatedAt: new Date().toISOString(),
        },
        'id = ?',
        [operationId]
      );
    } catch (error) {
      console.error('Failed to mark operation as failed:', error);
    }
  }

  /**
   * Handle sync conflict
   */
  private async handleConflict(conflict: SyncConflict): Promise<void> {
    try {
      // Last-write-wins: use most recent timestamp
      const useRemote = conflict.remoteTimestamp > conflict.localTimestamp;

      if (useRemote) {
        // Update local with remote data
        await this.upsertLocalItem(conflict.entityType, conflict.entityId, conflict.remoteData);
      }
      // Otherwise keep local data (already in database)

      // Log conflict for debugging
      console.warn('Conflict resolved:', {
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        resolution: useRemote ? 'REMOTE' : 'LOCAL',
      });
    } catch (error) {
      console.error('Failed to handle conflict:', error);
    }
  }

  /**
   * Retry failed operations with exponential backoff
   */
  private async retryFailedOperations(): Promise<void> {
    try {
      const failedOps = await this.db.queryAll(
        'SELECT * FROM sync_queue WHERE status = ? AND retryCount < ? ORDER BY updatedAt ASC',
        [SyncStatusEnum.FAILED, MAX_RETRIES]
      );

      for (const op of failedOps) {
        const delay = RETRY_DELAYS[Math.min(op.retryCount, RETRY_DELAYS.length - 1)];

        // Schedule retry
        setTimeout(async () => {
          try {
            await this.db.update(
              'sync_queue',
              { status: SyncStatusEnum.PENDING },
              'id = ?',
              [op.id]
            );
            await this.push();
          } catch (error) {
            console.error('Retry failed:', error);
          }
        }, delay);
      }
    } catch (error) {
      console.error('Failed to retry failed operations:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<any> {
    try {
      const pendingCount = await this.db.queryOne(
        'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
        [SyncStatusEnum.PENDING]
      );

      const failedCount = await this.db.queryOne(
        'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
        [SyncStatusEnum.FAILED]
      );

      const lastSyncTime = await AsyncStorage.getItem('last_sync_time');

      return {
        isSyncing: this.isSyncing,
        lastSyncTime: lastSyncTime ? parseInt(lastSyncTime) : null,
        pendingCount: pendingCount?.count || 0,
        failedCount: failedCount?.count || 0,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        isSyncing: this.isSyncing,
        pendingCount: 0,
        failedCount: 0,
      };
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    // Sync every 30 seconds
    this.syncTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, 30000);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get local item
   */
  private async getLocalItem(entityType: SyncEntityType, entityId: string): Promise<any> {
    try {
      const table = this.getTableForEntityType(entityType);
      return await this.db.queryOne(`SELECT * FROM ${table} WHERE id = ?`, [entityId]);
    } catch (error) {
      console.error('Failed to get local item:', error);
      return null;
    }
  }

  /**
   * Upsert local item
   */
  private async upsertLocalItem(
    entityType: SyncEntityType,
    entityId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const table = this.getTableForEntityType(entityType);
      const existing = await this.getLocalItem(entityType, entityId);

      if (existing) {
        await this.db.update(table, { ...data, syncedAt: new Date().toISOString() }, 'id = ?', [
          entityId,
        ]);
      } else {
        await this.db.insert(table, {
          id: entityId,
          ...data,
          syncedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to upsert local item:', error);
    }
  }

  /**
   * Delete local item
   */
  private async deleteLocalItem(entityType: SyncEntityType, entityId: string): Promise<void> {
    try {
      const table = this.getTableForEntityType(entityType);
      await this.db.delete(table, 'id = ?', [entityId]);
    } catch (error) {
      console.error('Failed to delete local item:', error);
    }
  }

  /**
   * Get table name for entity type
   */
  private getTableForEntityType(entityType: SyncEntityType): string {
    const tableMap: Record<SyncEntityType, string> = {
      [SyncEntityType.USER]: 'users',
      [SyncEntityType.USER_PREFERENCES]: 'user_preferences',
      [SyncEntityType.WORKOUT]: 'workouts',
      [SyncEntityType.WEIGHT]: 'body_weight',
      [SyncEntityType.MEASUREMENT]: 'body_measurements',
      [SyncEntityType.PHOTO]: 'progress_photos',
      [SyncEntityType.EXERCISE]: 'exercises',
      [SyncEntityType.ACHIEVEMENT]: 'achievements',
      [SyncEntityType.FRIENDSHIP]: 'friendships',
    };

    return tableMap[entityType] || 'workouts';
  }

  /**
   * Cleanup old data (older than 30 days)
   */
  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - OFFLINE_HISTORY_DAYS);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Delete old synced workouts
      await this.db.delete('workouts', 'syncedAt IS NOT NULL AND createdAt < ?', [cutoffTimestamp]);

      // Delete old activity feed entries
      await this.db.delete('activity_feed', 'createdAt < ?', [cutoffTimestamp]);

      // Delete synced sync queue entries
      await this.db.delete('sync_queue', 'status = ? AND updatedAt < ?', [
        SyncStatusEnum.SYNCED,
        cutoffTimestamp,
      ]);
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  /**
   * Shutdown sync engine
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicSync();
    await this.db.close();
  }
}

export default SyncEngine;
