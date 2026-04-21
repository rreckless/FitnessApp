import uuid from 'react-native-uuid';
import axios, { AxiosInstance } from 'axios';
import DatabaseManager from '@database/DatabaseManager';
import AuthenticationService from './AuthenticationService';
import type { SyncQueueItem } from '@types/index';
import Config from '@config/Config';

const uuidv4 = uuid.v4;

export interface SyncOperation {
  userId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  payload?: string;
}

export interface ConflictResolution {
  entityId: string;
  entityType: string;
  localTimestamp: string;
  remoteTimestamp: string;
  winner: 'local' | 'remote';
  reason: string;
}

export class SyncEngine {
  private static instance: SyncEngine;
  private api: AxiosInstance;
  private dbManager = DatabaseManager;
  private authService = AuthenticationService;

  private isSyncing = false;
  private syncQueue: SyncQueueItem[] = [];

  private constructor() {
    this.api = axios.create({
      baseURL: Config.apiBaseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor
    this.api.interceptors.request.use(async (config) => {
      const token = await this.authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Queue a sync operation
   */
  async queueOperation(
    userId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: string,
    entityId: string,
    payload?: string
  ): Promise<void> {
    try {
      const id = uuidv4() as string;
      const now = new Date().toISOString();

      await this.dbManager.executeSql(
        `INSERT INTO sync_queue (
          id, userId, operation, entityType, entityId, payload, status, retryCount, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, operation, entityType, entityId, payload || null, 'PENDING', 0, now, now]
      );

      console.log(`Queued ${operation} operation for ${entityType} ${entityId}`);
    } catch (error) {
      console.error('Failed to queue operation:', error);
      throw error;
    }
  }

  /**
   * Get pending sync operations
   */
  async getPendingOperations(userId: string): Promise<SyncQueueItem[]> {
    try {
      const results = await this.dbManager.executeSql(
        `SELECT * FROM sync_queue WHERE userId = ? AND status IN ('PENDING', 'FAILED') ORDER BY createdAt ASC`,
        [userId]
      );

      const operations: SyncQueueItem[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        operations.push(this.mapRowToSyncQueueItem(results.rows.item(i)));
      }

      return operations;
    } catch (error) {
      console.error('Failed to get pending operations:', error);
      return [];
    }
  }

  /**
   * Sync all pending operations with conflict detection
   */
  async syncAll(userId: string): Promise<{ synced: number; failed: number; conflicts: ConflictResolution[] }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { synced: 0, failed: 0, conflicts: [] };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    const conflicts: ConflictResolution[] = [];

    try {
      const operations = await this.getPendingOperations(userId);

      for (const operation of operations) {
        try {
          // Check for conflicts before syncing
          const conflict = await this.detectConflict(operation);
          if (conflict) {
            conflicts.push(conflict);
            // Apply last-write-wins resolution
            const shouldSync = await this.resolveConflict(conflict, operation);
            if (!shouldSync) {
              await this.updateOperationStatus(operation.id, 'SYNCED');
              synced++;
              continue;
            }
          }

          await this.syncOperation(operation);
          synced++;
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          failed++;
          await this.incrementRetryCount(operation.id);
        }
      }

      console.log(`Sync complete: ${synced} synced, ${failed} failed, ${conflicts.length} conflicts`);
      return { synced, failed, conflicts };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Detect conflicts using timestamps
   */
  private async detectConflict(operation: SyncQueueItem): Promise<ConflictResolution | null> {
    try {
      // For UPDATE and DELETE operations, check if remote version is newer
      if (operation.operation === 'UPDATE' || operation.operation === 'DELETE') {
        const response = await this.api.get(`/sync/check-conflict`, {
          params: {
            entityType: operation.entityType,
            entityId: operation.entityId,
          },
        });

        if (response.data.hasConflict) {
          const localTimestamp = operation.updatedAt.toISOString();
          const remoteTimestamp = response.data.remoteTimestamp;

          // Last-write-wins: compare timestamps
          const winner = new Date(localTimestamp) > new Date(remoteTimestamp) ? 'local' : 'remote';

          return {
            entityId: operation.entityId,
            entityType: operation.entityType,
            localTimestamp,
            remoteTimestamp,
            winner,
            reason: `Conflict detected: local ${localTimestamp} vs remote ${remoteTimestamp}`,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to detect conflict:', error);
      return null;
    }
  }

  /**
   * Resolve conflict using last-write-wins strategy
   */
  private async resolveConflict(conflict: ConflictResolution, operation: SyncQueueItem): Promise<boolean> {
    if (conflict.winner === 'local') {
      // Local version is newer, proceed with sync
      console.log(`Conflict resolved: local version wins for ${conflict.entityId}`);
      return true;
    } else {
      // Remote version is newer, skip local sync and fetch remote
      console.log(`Conflict resolved: remote version wins for ${conflict.entityId}`);
      try {
        const response = await this.api.get(`/sync/pull-entity`, {
          params: {
            entityType: operation.entityType,
            entityId: operation.entityId,
          },
        });

        // Update local database with remote version
        await this.updateLocalWithRemote(operation, response.data);
        return false; // Don't sync local version
      } catch (error) {
        console.error('Failed to fetch remote version:', error);
        return true; // Fallback to syncing local version
      }
    }
  }

  /**
   * Update local database with remote version
   */
  private async updateLocalWithRemote(operation: SyncQueueItem, remoteData: any): Promise<void> {
    try {
      const now = new Date().toISOString();

      switch (operation.entityType) {
        case 'WORKOUT':
          await this.dbManager.executeSql(
            `UPDATE workouts SET totalVolume = ?, totalXP = ?, notes = ?, updatedAt = ? WHERE id = ?`,
            [remoteData.totalVolume, remoteData.totalXP, remoteData.notes, now, operation.entityId]
          );
          break;
        case 'WEIGHT':
          await this.dbManager.executeSql(
            `UPDATE body_weight SET weight = ?, notes = ?, updatedAt = ? WHERE id = ?`,
            [remoteData.weight, remoteData.notes, now, operation.entityId]
          );
          break;
        case 'MEASUREMENT':
          await this.dbManager.executeSql(
            `UPDATE body_measurements SET chest = ?, waist = ?, hips = ?, arms = ?, thighs = ?, notes = ?, updatedAt = ? WHERE id = ?`,
            [remoteData.chest, remoteData.waist, remoteData.hips, remoteData.arms, remoteData.thighs, remoteData.notes, now, operation.entityId]
          );
          break;
        case 'PHOTO':
          await this.dbManager.executeSql(
            `UPDATE progress_photos SET imageUrl = ?, thumbnailUrl = ?, notes = ?, updatedAt = ? WHERE id = ?`,
            [remoteData.imageUrl, remoteData.thumbnailUrl, remoteData.notes, now, operation.entityId]
          );
          break;
      }

      console.log(`Updated local ${operation.entityType} ${operation.entityId} with remote version`);
    } catch (error) {
      console.error('Failed to update local with remote:', error);
      throw error;
    }
  }

  /**
   * Sync a single operation with exponential backoff retry
   */
  private async syncOperation(operation: SyncQueueItem): Promise<void> {
    try {
      // Update status to SYNCING
      await this.updateOperationStatus(operation.id, 'SYNCING');

      // Perform the sync with exponential backoff
      await this.syncWithRetry(operation);

      // Mark as synced
      await this.updateOperationStatus(operation.id, 'SYNCED');
    } catch (error) {
      // Mark as failed
      await this.updateOperationStatus(operation.id, 'FAILED');
      throw error;
    }
  }

  /**
   * Sync with exponential backoff retry logic
   */
  private async syncWithRetry(operation: SyncQueueItem, attempt: number = 0): Promise<void> {
    const maxRetries = 4; // 1s, 2s, 4s, 8s
    const baseDelay = 1000; // 1 second

    try {
      // Perform the sync based on operation type
      switch (operation.operation) {
        case 'CREATE':
          await this.syncCreate(operation);
          break;
        case 'UPDATE':
          await this.syncUpdate(operation);
          break;
        case 'DELETE':
          await this.syncDelete(operation);
          break;
      }
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`Sync failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.syncWithRetry(operation, attempt + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Sync CREATE operation
   */
  private async syncCreate(operation: SyncQueueItem): Promise<void> {
    const payload = operation.payload ? JSON.parse(operation.payload) : {};

    switch (operation.entityType) {
      case 'WORKOUT':
        await this.api.post('/workouts', payload);
        break;
      case 'WEIGHT':
        await this.api.post('/body/weight', payload);
        break;
      case 'MEASUREMENT':
        await this.api.post('/body/measurements', payload);
        break;
      case 'PHOTO':
        await this.api.post('/body/photos', payload);
        break;
      default:
        throw new Error(`Unknown entity type: ${operation.entityType}`);
    }
  }

  /**
   * Sync UPDATE operation
   */
  private async syncUpdate(operation: SyncQueueItem): Promise<void> {
    const payload = operation.payload ? JSON.parse(operation.payload) : {};

    switch (operation.entityType) {
      case 'WORKOUT':
        await this.api.put(`/workouts/${operation.entityId}`, payload);
        break;
      case 'WEIGHT':
        await this.api.put(`/body/weight/${operation.entityId}`, payload);
        break;
      case 'MEASUREMENT':
        await this.api.put(`/body/measurements/${operation.entityId}`, payload);
        break;
      case 'PHOTO':
        await this.api.put(`/body/photos/${operation.entityId}`, payload);
        break;
      default:
        throw new Error(`Unknown entity type: ${operation.entityType}`);
    }
  }

  /**
   * Sync DELETE operation
   */
  private async syncDelete(operation: SyncQueueItem): Promise<void> {
    switch (operation.entityType) {
      case 'WORKOUT':
        await this.api.delete(`/workouts/${operation.entityId}`);
        break;
      case 'WEIGHT':
        await this.api.delete(`/body/weight/${operation.entityId}`);
        break;
      case 'MEASUREMENT':
        await this.api.delete(`/body/measurements/${operation.entityId}`);
        break;
      case 'PHOTO':
        await this.api.delete(`/body/photos/${operation.entityId}`);
        break;
      default:
        throw new Error(`Unknown entity type: ${operation.entityType}`);
    }
  }

  /**
   * Update operation status
   */
  private async updateOperationStatus(operationId: string, status: string): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `UPDATE sync_queue SET status = ?, updatedAt = ? WHERE id = ?`,
        [status, new Date().toISOString(), operationId]
      );
    } catch (error) {
      console.error('Failed to update operation status:', error);
    }
  }

  /**
   * Increment retry count
   */
  private async incrementRetryCount(operationId: string): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `UPDATE sync_queue SET retryCount = retryCount + 1, updatedAt = ? WHERE id = ?`,
        [new Date().toISOString(), operationId]
      );
    } catch (error) {
      console.error('Failed to increment retry count:', error);
    }
  }

  /**
   * Clear synced operations
   */
  async clearSyncedOperations(userId: string): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `DELETE FROM sync_queue WHERE userId = ? AND status = 'SYNCED'`,
        [userId]
      );
    } catch (error) {
      console.error('Failed to clear synced operations:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<{ pending: number; syncing: number; failed: number }> {
    try {
      const results = await this.dbManager.executeSql(
        `SELECT status, COUNT(*) as count FROM sync_queue WHERE userId = ? GROUP BY status`,
        [userId]
      );

      let pending = 0;
      let syncing = 0;
      let failed = 0;

      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        switch (row.status) {
          case 'PENDING':
            pending = row.count;
            break;
          case 'SYNCING':
            syncing = row.count;
            break;
          case 'FAILED':
            failed = row.count;
            break;
        }
      }

      return { pending, syncing, failed };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return { pending: 0, syncing: 0, failed: 0 };
    }
  }

  /**
   * Check if currently syncing
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Map database row to SyncQueueItem
   */
  private mapRowToSyncQueueItem(row: any): SyncQueueItem {
    return {
      id: row.id,
      userId: row.userId,
      operation: row.operation,
      entityType: row.entityType,
      entityId: row.entityId,
      payload: row.payload,
      status: row.status,
      retryCount: row.retryCount,
      lastError: row.lastError,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

export default SyncEngine.getInstance();
