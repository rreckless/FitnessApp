import SyncEngine from '@services/SyncEngine';
import DatabaseManager from '@database/DatabaseManager';
import AuthenticationService from '@services/AuthenticationService';
import { mockAxiosInstance, mockDatabaseManager } from './setup';

const mockedDbManager = mockDatabaseManager;
const mockedAxios = mockAxiosInstance;
const mockedAuthService = AuthenticationService as jest.Mocked<typeof AuthenticationService>;

describe('SyncEngine', () => {
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset axios instance methods
    mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });
    mockedAxios.put = jest.fn().mockResolvedValue({ data: {} });
    mockedAxios.delete = jest.fn().mockResolvedValue({ data: {} });
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { hasConflict: false } });
    
    mockedAuthService.getAccessToken = jest.fn().mockResolvedValue('access-token-123');
    mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('queueOperation', () => {
    it('should queue a CREATE operation', async () => {
      const payload = JSON.stringify({ duration: 3600, volume: 5000 });

      await SyncEngine.queueOperation(userId, 'CREATE', 'WORKOUT', 'workout-1', payload);

      expect(mockedDbManager.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining([userId, 'CREATE', 'WORKOUT', 'workout-1', payload])
      );
    });

    it('should queue an UPDATE operation', async () => {
      const payload = JSON.stringify({ duration: 3700 });

      await SyncEngine.queueOperation(userId, 'UPDATE', 'WORKOUT', 'workout-1', payload);

      expect(mockedDbManager.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining([userId, 'UPDATE', 'WORKOUT', 'workout-1', payload])
      );
    });

    it('should queue a DELETE operation', async () => {
      await SyncEngine.queueOperation(userId, 'DELETE', 'WORKOUT', 'workout-1');

      expect(mockedDbManager.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining([userId, 'DELETE', 'WORKOUT', 'workout-1'])
      );
    });

    it('should throw error on database failure', async () => {
      mockedDbManager.executeSql = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        SyncEngine.queueOperation(userId, 'CREATE', 'WORKOUT', 'workout-1')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPendingOperations', () => {
    it('should return pending operations', async () => {
      const mockRows = {
        length: 2,
        item: (index: number) => ({
          id: `op-${index}`,
          userId,
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: `workout-${index}`,
          payload: null,
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });

      const result = await SyncEngine.getPendingOperations(userId);

      expect(result).toHaveLength(2);
      expect(result[0].operation).toBe('CREATE');
      expect(result[0].status).toBe('PENDING');
    });

    it('should return empty array on error', async () => {
      mockedDbManager.executeSql = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await SyncEngine.getPendingOperations(userId);

      expect(result).toEqual([]);
    });
  });

  describe('syncAll', () => {
    it('should sync all pending operations', async () => {
      const mockRows = {
        length: 2,
        item: (index: number) => ({
          id: `op-${index}`,
          userId,
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: `workout-${index}`,
          payload: JSON.stringify({ duration: 3600 }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });
      mockedAxios.get = jest.fn().mockResolvedValue({ data: { hasConflict: false } });

      const result = await SyncEngine.syncAll(userId);

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toEqual([]);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle failed operations', async () => {
      const mockRows = {
        length: 2,
        item: (index: number) => ({
          id: `op-${index}`,
          userId,
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: `workout-${index}`,
          payload: JSON.stringify({ duration: 3600 }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.post = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: {} });
      mockedAxios.get = jest.fn().mockResolvedValue({ data: { hasConflict: false } });

      const result = await SyncEngine.syncAll(userId);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should prevent concurrent syncs', async () => {
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      // Start first sync
      const sync1 = SyncEngine.syncAll(userId);

      // Try to start second sync while first is in progress
      const sync2 = SyncEngine.syncAll(userId);

      const result1 = await sync1;
      const result2 = await sync2;

      // Second sync should return immediately with 0 synced
      expect(result2.synced).toBe(0);
      expect(result2.failed).toBe(0);
    });
  });

  describe('syncOperation - CREATE', () => {
    it('should sync CREATE WORKOUT operation', async () => {
      const mockRows = {
        length: 1,
        item: () => ({
          id: 'op-1',
          userId,
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: 'workout-1',
          payload: JSON.stringify({ duration: 3600, volume: 5000 }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });

      await SyncEngine.syncAll(userId);

      expect(mockedAxios.post).toHaveBeenCalledWith('/workouts', {
        duration: 3600,
        volume: 5000,
      });
    });

    it('should sync CREATE WEIGHT operation', async () => {
      const mockRows = {
        length: 1,
        item: () => ({
          id: 'op-1',
          userId,
          operation: 'CREATE',
          entityType: 'WEIGHT',
          entityId: 'weight-1',
          payload: JSON.stringify({ weight: 180, date: '2024-01-01' }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });

      await SyncEngine.syncAll(userId);

      expect(mockedAxios.post).toHaveBeenCalledWith('/body/weight', {
        weight: 180,
        date: '2024-01-01',
      });
    });
  });

  describe('syncOperation - UPDATE', () => {
    it('should sync UPDATE WORKOUT operation', async () => {
      const mockRows = {
        length: 1,
        item: () => ({
          id: 'op-1',
          userId,
          operation: 'UPDATE',
          entityType: 'WORKOUT',
          entityId: 'workout-1',
          payload: JSON.stringify({ duration: 3700 }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.put = jest.fn().mockResolvedValue({ data: {} });

      await SyncEngine.syncAll(userId);

      expect(mockedAxios.put).toHaveBeenCalledWith('/workouts/workout-1', {
        duration: 3700,
      });
    });
  });

  describe('syncOperation - DELETE', () => {
    it('should sync DELETE WORKOUT operation', async () => {
      const mockRows = {
        length: 1,
        item: () => ({
          id: 'op-1',
          userId,
          operation: 'DELETE',
          entityType: 'WORKOUT',
          entityId: 'workout-1',
          payload: null,
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.delete = jest.fn().mockResolvedValue({ data: {} });

      await SyncEngine.syncAll(userId);

      expect(mockedAxios.delete).toHaveBeenCalledWith('/workouts/workout-1');
    });
  });

  describe('clearSyncedOperations', () => {
    it('should clear synced operations', async () => {
      await SyncEngine.clearSyncedOperations(userId);

      expect(mockedDbManager.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sync_queue'),
        expect.arrayContaining([userId])
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status', async () => {
      const mockRows = {
        length: 3,
        item: (index: number) => {
          const statuses = ['PENDING', 'SYNCING', 'FAILED'];
          return {
            status: statuses[index],
            count: index + 1,
          };
        },
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });

      const result = await SyncEngine.getSyncStatus(userId);

      expect(result.pending).toBe(1);
      expect(result.syncing).toBe(2);
      expect(result.failed).toBe(3);
    });

    it('should return zero counts on error', async () => {
      mockedDbManager.executeSql = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await SyncEngine.getSyncStatus(userId);

      expect(result.pending).toBe(0);
      expect(result.syncing).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('getIsSyncing', () => {
    it('should return false initially', () => {
      const result = SyncEngine.getIsSyncing();
      expect(result).toBe(false);
    });

    it('should return true during sync', async () => {
      const mockRows = {
        length: 1,
        item: () => ({
          id: 'op-1',
          userId,
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: 'workout-1',
          payload: JSON.stringify({ duration: 3600 }),
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: mockRows });
      mockedAxios.post = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: {} }), 100);
          })
      );

      const syncPromise = SyncEngine.syncAll(userId);

      // Check syncing state during sync
      expect(SyncEngine.getIsSyncing()).toBe(true);

      await syncPromise;

      // Check syncing state after sync
      expect(SyncEngine.getIsSyncing()).toBe(false);
    });
  });
});
