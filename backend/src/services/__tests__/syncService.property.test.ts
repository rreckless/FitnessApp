import fc from 'fast-check';
import { SyncService } from '../syncService';
import { Pool } from 'pg';

/**
 * Property 19: Sync Conflict Resolution
 * 
 * **Validates: Requirements 24.4**
 * 
 * Property: For any two conflicting updates to the same entity with different timestamps,
 * the sync engine always resolves the conflict by selecting the entity with the most recent
 * timestamp (last-write-wins strategy). The resolution is deterministic and consistent.
 */
describe('Property 19: Sync Conflict Resolution', () => {
  let mockPool: jest.Mocked<Pool>;
  let syncService: SyncService;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;
    syncService = new SyncService(mockPool);
  });

  it('should resolve conflicts using last-write-wins strategy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1000000000000, max: 9999999999999 }), // Timestamps in ms
        fc.integer({ min: 1000000000000, max: 9999999999999 }),
        fc.record({
          weight: fc.integer({ min: 100, max: 300 }),
          notes: fc.string(),
        }),
        async (userId, entityId, timestamp1Ms, timestamp2Ms, payload) => {
          const timestamp1 = new Date(timestamp1Ms);
          const timestamp2 = new Date(timestamp2Ms);

          // Ensure timestamps are different
          if (timestamp1.getTime() === timestamp2.getTime()) {
            return;
          }

          const olderTimestamp = timestamp1 < timestamp2 ? timestamp1 : timestamp2;
          const newerTimestamp = timestamp1 > timestamp2 ? timestamp1 : timestamp2;

          // Mock: get existing entity with older timestamp
          mockPool.query.mockResolvedValueOnce({
            rows: [
              {
                id: entityId,
                user_id: userId,
                weight: 150,
                notes: 'old notes',
                updated_at: olderTimestamp,
              },
            ],
          } as any);

          // Mock: update entity
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          } as any);

          // Mock: update last sync time
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          } as any);

          // Perform sync with newer timestamp
          const result = await syncService.pushChanges(userId, [
            {
              operation: 'UPDATE',
              entityType: 'WEIGHT',
              entityId,
              payload,
              clientTimestamp: newerTimestamp,
            },
          ]);

          // Assert: newer update should be synced (no conflict)
          expect(result.synced).toContain(entityId);
          expect(result.conflicts).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect conflicts when cloud version is newer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1000000000000, max: 9999999999999 }),
        fc.integer({ min: 1000000000000, max: 9999999999999 }),
        fc.record({
          weight: fc.integer({ min: 100, max: 300 }),
          notes: fc.string(),
        }),
        async (userId, entityId, timestamp1Ms, timestamp2Ms, payload) => {
          const timestamp1 = new Date(timestamp1Ms);
          const timestamp2 = new Date(timestamp2Ms);

          // Ensure timestamps are different
          if (timestamp1.getTime() === timestamp2.getTime()) {
            return;
          }

          const olderTimestamp = timestamp1 < timestamp2 ? timestamp1 : timestamp2;
          const newerTimestamp = timestamp1 > timestamp2 ? timestamp1 : timestamp2;

          // Mock: get existing entity with NEWER timestamp (cloud is newer)
          mockPool.query.mockResolvedValueOnce({
            rows: [
              {
                id: entityId,
                user_id: userId,
                weight: 150,
                notes: 'cloud notes',
                updated_at: newerTimestamp,
              },
            ],
          } as any);

          // Perform sync with older timestamp
          const result = await syncService.pushChanges(userId, [
            {
              operation: 'UPDATE',
              entityType: 'WEIGHT',
              entityId,
              payload,
              clientTimestamp: olderTimestamp,
            },
          ]);

          // Assert: conflict should be detected with CLOUD resolution
          expect(result.conflicts).toHaveLength(1);
          expect(result.conflicts[0]).toMatchObject({
            entityId,
            entityType: 'WEIGHT',
            localTimestamp: olderTimestamp,
            cloudTimestamp: newerTimestamp,
            resolution: 'CLOUD',
          });
          expect(result.synced).not.toContain(entityId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle delete conflicts correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1000000000000, max: 9999999999999 }),
        fc.integer({ min: 1000000000000, max: 9999999999999 }),
        async (userId, entityId, timestamp1Ms, timestamp2Ms) => {
          const timestamp1 = new Date(timestamp1Ms);
          const timestamp2 = new Date(timestamp2Ms);

          // Ensure timestamps are different
          if (timestamp1.getTime() === timestamp2.getTime()) {
            return;
          }

          const olderTimestamp = timestamp1 < timestamp2 ? timestamp1 : timestamp2;
          const newerTimestamp = timestamp1 > timestamp2 ? timestamp1 : timestamp2;

          // Scenario: Local delete is newer than cloud update
          // Mock: get existing entity with older timestamp
          mockPool.query.mockResolvedValueOnce({
            rows: [
              {
                id: entityId,
                user_id: userId,
                weight: 150,
                updated_at: olderTimestamp,
              },
            ],
          } as any);

          // Mock: delete entity
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          } as any);

          // Mock: update last sync time
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          } as any);

          // Perform sync with DELETE operation and newer timestamp
          const result = await syncService.pushChanges(userId, [
            {
              operation: 'DELETE',
              entityType: 'WEIGHT',
              entityId,
              payload: {},
              clientTimestamp: newerTimestamp,
            },
          ]);

          // Assert: delete should succeed (no conflict)
          expect(result.synced).toContain(entityId);
          expect(result.conflicts).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency across multiple operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.record({
            entityId: fc.uuid(),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            payload: fc.record({
              weight: fc.integer({ min: 100, max: 300 }),
            }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userId, operations) => {
          // Mock all queries
          for (let i = 0; i < operations.length; i++) {
            // Mock: get existing entity
            mockPool.query.mockResolvedValueOnce({
              rows: [
                {
                  id: operations[i].entityId,
                  user_id: userId,
                  weight: 150,
                  updated_at: new Date(operations[i].timestamp - 1000), // Older than client
                },
              ],
            } as any);

            // Mock: update entity
            mockPool.query.mockResolvedValueOnce({
              rows: [],
            } as any);
          }

          // Mock: update last sync time
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          } as any);

          // Perform sync with all operations
          const syncOps = operations.map((op) => ({
            operation: 'UPDATE' as const,
            entityType: 'WEIGHT' as const,
            entityId: op.entityId,
            payload: op.payload,
            clientTimestamp: new Date(op.timestamp),
          }));

          const result = await syncService.pushChanges(userId, syncOps);

          // Assert: all operations should be synced (no conflicts)
          expect(result.synced).toHaveLength(operations.length);
          expect(result.conflicts).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
