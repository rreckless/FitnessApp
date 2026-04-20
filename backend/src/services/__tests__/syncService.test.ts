import { SyncService } from '../syncService';
import { Pool } from 'pg';

describe('SyncService', () => {
  let mockPool: jest.Mocked<Pool>;
  let syncService: SyncService;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;
    syncService = new SyncService(mockPool);
  });

  // MARK: - Authorization Tests (Fix 1.1)

  describe('Authorization - Users cannot access other users data', () => {
    it('should only return workouts for authenticated user', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const lastSyncAt = new Date('2024-01-01T10:00:00Z');

      const mockWorkouts = [
        {
          id: 'workout-1',
          user_id: userId,
          start_time: new Date('2024-01-01T11:00:00Z'),
          updated_at: new Date('2024-01-01T11:30:00Z'),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockWorkouts });

      const changes = await syncService.pullChanges(userId, lastSyncAt);

      // Verify query includes user_id filter
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        expect.arrayContaining([userId])
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].user_id).toBe(userId);
    });

    it('should not return workouts from other users', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Mock: no workouts for this user
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const changes = await syncService.pullChanges(userId);

      expect(changes).toHaveLength(0);
    });

    it('should verify user ownership when pushing changes', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';

      // Mock: entity doesn't exist
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: create entity
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'WEIGHT',
          entityId,
          payload: { weight: 150 },
          clientTimestamp: new Date(),
        },
      ]);

      // Verify that getEntity query includes user_id filter
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        expect.arrayContaining([entityId, userId])
      );

      expect(result.synced).toContain(entityId);
    });

    it('should not allow user to access other users workouts', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const workoutId = 'workout-1';

      // Mock: workout belongs to other user (not found for this user)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: create entity (since not found)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'UPDATE',
          entityType: 'WORKOUT',
          entityId: workoutId,
          payload: { duration: 3600 },
          clientTimestamp: new Date(),
        },
      ]);

      // Should create new entity for this user, not update other user's
      expect(result.synced).toContain(workoutId);
    });

    it('should verify user ownership in getSyncStatus', async () => {
      const userId = 'user-123';
      const lastSyncAt = new Date('2024-01-01T10:00:00Z');

      // Mock: get user
      mockPool.query.mockResolvedValueOnce({
        rows: [{ last_sync_at: lastSyncAt }],
      });

      // Mock: get pending count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      const status = await syncService.getSyncStatus(userId);

      // Verify query includes user_id filter
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE id = $1'),
        expect.arrayContaining([userId])
      );

      expect(status.lastSyncAt).toEqual(lastSyncAt);
      expect(status.pendingChanges).toBe(5);
    });
  });

  // MARK: - Sync Queue Operations Tests

  describe('pushChanges', () => {
    it('should sync new workout creation', async () => {
      const userId = 'user-123';
      const workoutId = 'workout-456';
      const now = new Date();

      // Mock: entity doesn't exist
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: create entity
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: workoutId,
          payload: {
            startTime: now,
            duration: 3600,
            totalVolume: 5000,
            totalXP: 50,
          },
          clientTimestamp: now,
        },
      ]);

      expect(result.synced).toContain(workoutId);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle multiple operations in batch', async () => {
      const userId = 'user-123';
      const operations = [
        {
          operation: 'CREATE' as const,
          entityType: 'WEIGHT' as const,
          entityId: 'weight-1',
          payload: { weight: 150 },
          clientTimestamp: new Date(),
        },
        {
          operation: 'CREATE' as const,
          entityType: 'MEASUREMENT' as const,
          entityId: 'measurement-1',
          payload: { chest: 40, waist: 32 },
          clientTimestamp: new Date(),
        },
      ];

      // Mock: entities don't exist
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: create entities
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, operations);

      expect(result.synced).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflict when cloud version is newer', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';
      const localTimestamp = new Date('2024-01-01T10:00:00Z');
      const cloudTimestamp = new Date('2024-01-01T11:00:00Z');

      // Mock: entity exists with newer timestamp
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            user_id: userId,
            weight: 150,
            updated_at: cloudTimestamp,
          },
        ],
      });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'UPDATE',
          entityType: 'WEIGHT',
          entityId,
          payload: { weight: 160 },
          clientTimestamp: localTimestamp,
        },
      ]);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        entityId,
        entityType: 'WEIGHT',
        localTimestamp,
        cloudTimestamp,
        resolution: 'CLOUD',
      });
      expect(result.synced).not.toContain(entityId);
    });

    it('should sync update when local version is newer', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';
      const localTimestamp = new Date('2024-01-01T11:00:00Z');
      const cloudTimestamp = new Date('2024-01-01T10:00:00Z');

      // Mock: entity exists with older timestamp
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            user_id: userId,
            weight: 150,
            updated_at: cloudTimestamp,
          },
        ],
      });

      // Mock: update entity
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'UPDATE',
          entityType: 'WEIGHT',
          entityId,
          payload: { weight: 160 },
          clientTimestamp: localTimestamp,
        },
      ]);

      expect(result.synced).toContain(entityId);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle delete operation', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';
      const localTimestamp = new Date('2024-01-01T11:00:00Z');
      const cloudTimestamp = new Date('2024-01-01T10:00:00Z');

      // Mock: entity exists with older timestamp
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            user_id: userId,
            weight: 150,
            updated_at: cloudTimestamp,
          },
        ],
      });

      // Mock: delete entity
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock: update last sync time
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'DELETE',
          entityType: 'WEIGHT',
          entityId,
          payload: {},
          clientTimestamp: localTimestamp,
        },
      ]);

      expect(result.synced).toContain(entityId);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  // MARK: - Conflict Detection Tests

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using last-write-wins', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';

      // Scenario: Local update is newer
      const localTimestamp = new Date('2024-01-01T12:00:00Z');
      const cloudTimestamp = new Date('2024-01-01T11:00:00Z');

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            user_id: userId,
            weight: 150,
            updated_at: cloudTimestamp,
          },
        ],
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'UPDATE',
          entityType: 'WEIGHT',
          entityId,
          payload: { weight: 160 },
          clientTimestamp: localTimestamp,
        },
      ]);

      // Local version should win
      expect(result.synced).toContain(entityId);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle delete conflict when cloud is newer', async () => {
      const userId = 'user-123';
      const entityId = 'weight-1';
      const localTimestamp = new Date('2024-01-01T10:00:00Z');
      const cloudTimestamp = new Date('2024-01-01T11:00:00Z');

      // Mock: entity exists with newer timestamp
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            user_id: userId,
            weight: 150,
            updated_at: cloudTimestamp,
          },
        ],
      });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'DELETE',
          entityType: 'WEIGHT',
          entityId,
          payload: {},
          clientTimestamp: localTimestamp,
        },
      ]);

      // Cloud version should win (conflict)
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('CLOUD');
    });
  });

  // MARK: - Sync Status Tests

  describe('getSyncStatus', () => {
    it('should return last sync time and pending changes count', async () => {
      const userId = 'user-123';
      const lastSyncAt = new Date('2024-01-01T10:00:00Z');

      // Mock: get user
      mockPool.query.mockResolvedValueOnce({
        rows: [{ last_sync_at: lastSyncAt }],
      });

      // Mock: get pending count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      const status = await syncService.getSyncStatus(userId);

      expect(status.lastSyncAt).toEqual(lastSyncAt);
      expect(status.pendingChanges).toBe(5);
    });

    it('should return null for last sync time if never synced', async () => {
      const userId = 'user-123';

      // Mock: get user with no sync
      mockPool.query.mockResolvedValueOnce({
        rows: [{ last_sync_at: null }],
      });

      // Mock: get pending count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      const status = await syncService.getSyncStatus(userId);

      expect(status.lastSyncAt).toBeNull();
      expect(status.pendingChanges).toBe(0);
    });
  });

  // MARK: - Entity Type Handling Tests

  describe('Entity Type Handling', () => {
    it('should handle WORKOUT entity type', async () => {
      const userId = 'user-123';
      const workoutId = 'workout-1';

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'WORKOUT',
          entityId: workoutId,
          payload: {
            startTime: new Date(),
            duration: 3600,
            totalVolume: 5000,
          },
          clientTimestamp: new Date(),
        },
      ]);

      expect(result.synced).toContain(workoutId);
    });

    it('should handle WEIGHT entity type', async () => {
      const userId = 'user-123';
      const weightId = 'weight-1';

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'WEIGHT',
          entityId: weightId,
          payload: { weight: 150, notes: 'test' },
          clientTimestamp: new Date(),
        },
      ]);

      expect(result.synced).toContain(weightId);
    });

    it('should handle MEASUREMENT entity type', async () => {
      const userId = 'user-123';
      const measurementId = 'measurement-1';

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'MEASUREMENT',
          entityId: measurementId,
          payload: { chest: 40, waist: 32 },
          clientTimestamp: new Date(),
        },
      ]);

      expect(result.synced).toContain(measurementId);
    });

    it('should handle PHOTO entity type', async () => {
      const userId = 'user-123';
      const photoId = 'photo-1';

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.pushChanges(userId, [
        {
          operation: 'CREATE',
          entityType: 'PHOTO',
          entityId: photoId,
          payload: { imageUrl: 'https://example.com/photo.jpg' },
          clientTimestamp: new Date(),
        },
      ]);

      expect(result.synced).toContain(photoId);
    });
  });

  // MARK: - Pull Changes Tests

  describe('pullChanges', () => {
    it('should pull changes since last sync', async () => {
      const userId = 'user-123';
      const lastSyncAt = new Date('2024-01-01T10:00:00Z');

      const mockWorkouts = [
        {
          id: 'workout-1',
          user_id: userId,
          start_time: new Date('2024-01-01T11:00:00Z'),
          updated_at: new Date('2024-01-01T11:30:00Z'),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockWorkouts });

      const changes = await syncService.pullChanges(userId, lastSyncAt);

      expect(changes).toHaveLength(1);
      expect(changes[0].id).toBe('workout-1');
    });

    it('should pull all changes if no last sync time', async () => {
      const userId = 'user-123';

      const mockWorkouts = [
        {
          id: 'workout-1',
          user_id: userId,
          start_time: new Date('2024-01-01T11:00:00Z'),
          updated_at: new Date('2024-01-01T11:30:00Z'),
        },
        {
          id: 'workout-2',
          user_id: userId,
          start_time: new Date('2024-01-02T11:00:00Z'),
          updated_at: new Date('2024-01-02T11:30:00Z'),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockWorkouts });

      const changes = await syncService.pullChanges(userId);

      expect(changes).toHaveLength(2);
    });
  });
});
