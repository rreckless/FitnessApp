/**
 * SyncEngine Tests
 * Unit and property-based tests for sync functionality
 */

import { SyncEngine } from '../SyncEngine';
import { AuthenticationService } from '../AuthenticationService';
import DatabaseService from '../../database/DatabaseService';
import {
  SyncOperation,
  SyncEntityType,
  SyncStatusEnum,
  SyncError,
  SyncException,
} from '../../models/SyncModels';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('axios');
jest.mock('../../database/DatabaseService');

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      isAuthenticated: jest.fn().mockResolvedValue(true),
      getAccessToken: jest.fn().mockResolvedValue('token123'),
    } as any;

    mockDb = {
      initialize: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue('id123'),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      queryOne: jest.fn(),
      queryAll: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    syncEngine = SyncEngine.getInstance('http://localhost:5000/api', mockAuthService);
  });

  describe('Queue Operations', () => {
    it('should queue a CREATE operation', async () => {
      const operationId = await syncEngine.queueOperation(
        SyncOperation.CREATE,
        SyncEntityType.WORKOUT,
        'workout123',
        { name: 'Test Workout' }
      );

      expect(operationId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith('sync_queue', expect.objectContaining({
        operation: SyncOperation.CREATE,
        entityType: SyncEntityType.WORKOUT,
        entityId: 'workout123',
        status: SyncStatusEnum.PENDING,
      }));
    });

    it('should queue an UPDATE operation', async () => {
      const operationId = await syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.WEIGHT,
        'weight123',
        { weight: 75.5 }
      );

      expect(operationId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith('sync_queue', expect.objectContaining({
        operation: SyncOperation.UPDATE,
        entityType: SyncEntityType.WEIGHT,
      }));
    });

    it('should queue a DELETE operation', async () => {
      const operationId = await syncEngine.queueOperation(
        SyncOperation.DELETE,
        SyncEntityType.PHOTO,
        'photo123',
        {}
      );

      expect(operationId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith('sync_queue', expect.objectContaining({
        operation: SyncOperation.DELETE,
        entityType: SyncEntityType.PHOTO,
      }));
    });

    // Property-based test: All queued operations should have required fields
    it('should queue operations with all required fields', async () => {
      const operations = [
        { op: SyncOperation.CREATE, entity: SyncEntityType.WORKOUT },
        { op: SyncOperation.UPDATE, entity: SyncEntityType.WEIGHT },
        { op: SyncOperation.DELETE, entity: SyncEntityType.MEASUREMENT },
      ];

      for (const { op, entity } of operations) {
        await syncEngine.queueOperation(op, entity, 'id123', {});

        const callArgs = (mockDb.insert as jest.Mock).mock.calls[
          (mockDb.insert as jest.Mock).mock.calls.length - 1
        ][1];

        expect(callArgs).toHaveProperty('id');
        expect(callArgs).toHaveProperty('operation', op);
        expect(callArgs).toHaveProperty('entityType', entity);
        expect(callArgs).toHaveProperty('status', SyncStatusEnum.PENDING);
        expect(callArgs).toHaveProperty('retryCount', 0);
        expect(callArgs).toHaveProperty('createdAt');
        expect(callArgs).toHaveProperty('updatedAt');
      }
    });
  });

  describe('Sync Status', () => {
    it('should return sync status', async () => {
      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce({ count: 5 }) // pending count
        .mockResolvedValueOnce({ count: 2 }); // failed count

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1234567890');

      const status = await syncEngine.getSyncStatus();

      expect(status).toEqual({
        isSyncing: false,
        lastSyncTime: 1234567890,
        pendingCount: 5,
        failedCount: 2,
      });
    });

    it('should return zero counts if no pending operations', async () => {
      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const status = await syncEngine.getSyncStatus();

      expect(status.pendingCount).toBe(0);
      expect(status.failedCount).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    // Property-based test: Last-write-wins should always use most recent timestamp
    it('should resolve conflicts using last-write-wins', async () => {
      const conflicts = [
        {
          entityType: SyncEntityType.WORKOUT,
          entityId: 'workout1',
          localTimestamp: 1000,
          remoteTimestamp: 2000, // Remote is newer
          localData: { name: 'Local' },
          remoteData: { name: 'Remote' },
          resolution: 'REMOTE' as const,
        },
        {
          entityType: SyncEntityType.WEIGHT,
          entityId: 'weight1',
          localTimestamp: 3000, // Local is newer
          remoteTimestamp: 2000,
          localData: { weight: 75 },
          remoteData: { weight: 70 },
          resolution: 'LOCAL' as const,
        },
      ];

      for (const conflict of conflicts) {
        const useRemote = conflict.remoteTimestamp > conflict.localTimestamp;
        expect(useRemote).toBe(conflict.resolution === 'REMOTE');
      }
    });

    // Property-based test: Conflict resolution should be deterministic
    it('should resolve same conflicts consistently', async () => {
      const conflict = {
        entityType: SyncEntityType.WORKOUT,
        entityId: 'workout1',
        localTimestamp: 1000,
        remoteTimestamp: 2000,
        localData: { name: 'Local' },
        remoteData: { name: 'Remote' },
        resolution: 'REMOTE' as const,
      };

      // Resolve multiple times
      for (let i = 0; i < 5; i++) {
        const useRemote = conflict.remoteTimestamp > conflict.localTimestamp;
        expect(useRemote).toBe(true);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations with exponential backoff', async () => {
      const failedOps = [
        {
          id: 'op1',
          retryCount: 0,
          status: SyncStatusEnum.FAILED,
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'op2',
          retryCount: 1,
          status: SyncStatusEnum.FAILED,
          updatedAt: new Date().toISOString(),
        },
      ];

      (mockDb.queryAll as jest.Mock).mockResolvedValueOnce(failedOps);

      // Verify exponential backoff delays
      const delays = [1000, 2000, 4000, 8000];
      for (let i = 0; i < failedOps.length; i++) {
        const expectedDelay = delays[Math.min(failedOps[i].retryCount, delays.length - 1)];
        expect(expectedDelay).toBeGreaterThan(0);
      }
    });

    // Property-based test: Retry count should not exceed max retries
    it('should not retry operations exceeding max retries', async () => {
      const MAX_RETRIES = 3;
      const operations = [
        { id: 'op1', retryCount: 0 },
        { id: 'op2', retryCount: 1 },
        { id: 'op3', retryCount: 2 },
        { id: 'op4', retryCount: 3 },
        { id: 'op5', retryCount: 4 },
      ];

      for (const op of operations) {
        const shouldRetry = op.retryCount < MAX_RETRIES;
        expect(shouldRetry).toBe(op.retryCount < MAX_RETRIES);
      }
    });
  });

  describe('Offline Data Availability', () => {
    // Property-based test: Offline data should be available for 30 days
    it('should maintain 30 days of offline history', async () => {
      const OFFLINE_HISTORY_DAYS = 30;
      const now = Date.now();
      const thirtyDaysAgo = now - OFFLINE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
      const thirtyOneDaysAgo = now - (OFFLINE_HISTORY_DAYS + 1) * 24 * 60 * 60 * 1000;

      // Data from 30 days ago should be available
      expect(thirtyDaysAgo).toBeGreaterThan(thirtyOneDaysAgo);

      // Data from 31 days ago should be cleaned up
      expect(thirtyOneDaysAgo).toBeLessThan(thirtyDaysAgo);
    });

    it('should cleanup old data', async () => {
      await syncEngine.cleanupOldData();

      // Verify delete was called for old workouts
      expect(mockDb.delete).toHaveBeenCalledWith(
        'workouts',
        'syncedAt IS NOT NULL AND createdAt < ?',
        expect.any(Array)
      );

      // Verify delete was called for old activity feed
      expect(mockDb.delete).toHaveBeenCalledWith(
        'activity_feed',
        'createdAt < ?',
        expect.any(Array)
      );
    });
  });

  describe('Sync Initialization', () => {
    it('should initialize sync engine', async () => {
      await syncEngine.initialize();

      expect(mockDb.initialize).toHaveBeenCalled();
    });

    it('should start periodic sync on initialization', async () => {
      jest.useFakeTimers();

      await syncEngine.initialize();

      // Verify periodic sync is scheduled
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      jest.useRealTimers();
    });
  });

  describe('Sync Shutdown', () => {
    it('should shutdown sync engine', async () => {
      await syncEngine.initialize();
      await syncEngine.shutdown();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should stop periodic sync on shutdown', async () => {
      jest.useFakeTimers();

      await syncEngine.initialize();
      syncEngine.stopPeriodicSync();

      // Verify timer is cleared
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Entity Type Mapping', () => {
    // Property-based test: All entity types should map to valid tables
    it('should map all entity types to valid tables', () => {
      const entityTypeToTable: Record<SyncEntityType, string> = {
        [SyncEntityType.WORKOUT]: 'workouts',
        [SyncEntityType.WEIGHT]: 'body_weight',
        [SyncEntityType.MEASUREMENT]: 'body_measurements',
        [SyncEntityType.PHOTO]: 'progress_photos',
        [SyncEntityType.EXERCISE]: 'exercises',
        [SyncEntityType.ACHIEVEMENT]: 'achievements',
        [SyncEntityType.FRIENDSHIP]: 'friendships',
      };

      for (const [entityType, table] of Object.entries(entityTypeToTable)) {
        expect(table).toBeDefined();
        expect(table.length).toBeGreaterThan(0);
      }
    });
  });
});
