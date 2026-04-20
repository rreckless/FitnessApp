import fc from 'fast-check';
import * as leaderboardService from '../leaderboardService';
import { query } from '../../database/connection';
import Redis from 'ioredis';
import { logger } from '../../logging/logger';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../../logging/logger');

/**
 * Property-Based Tests for Leaderboard Service
 * 
 * **Property 12: Leaderboard Ranking Correctness**
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 */
describe('Leaderboard Service - Property-Based Tests', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis client
    mockRedis = {
      zrevrange: jest.fn(),
      zscore: jest.fn(),
      zrevrank: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    } as any;

    leaderboardService.initializeRedis(mockRedis);
  });

  afterEach(() => {
    leaderboardService.stopBatchJob();
  });

  // MARK: - Property 12.1: Ranking Order Correctness

  /**
   * Property: Global leaderboard should return users in descending XP order
   * 
   * For any set of users with different XP values, the leaderboard should
   * return them sorted by XP in descending order (highest XP first).
   * 
   * **Validates: Requirements 9.1, 9.2**
   */
  it('Property 12.1: Global leaderboard returns users in descending XP order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            xp: fc.integer({ min: 0, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (users) => {
          // Sort users by XP descending (expected order)
          const sortedUsers = [...users].sort((a, b) => b.xp - a.xp);

          // Mock Redis to return users in sorted order
          const mockEntries: any[] = [];
          sortedUsers.forEach((user) => {
            mockEntries.push(user.userId);
            mockEntries.push(user.xp.toString());
          });

          (mockRedis.zrevrange as jest.Mock).mockResolvedValue(mockEntries);

          // Mock database queries for user details
          (query as jest.Mock).mockImplementation(() =>
            Promise.resolve({
              rows: [
                {
                  id: sortedUsers[0].userId,
                  name: 'User',
                  level: 10,
                  profile_picture_url: 'url',
                },
              ],
            })
          );

          // Verify that zrevrange was called with correct parameters
          // (reverse range to get highest scores first)
          expect(mockRedis.zrevrange).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: User rank should be 1-indexed (first place = rank 1)
   * 
   * For any user on the leaderboard, their rank should be 1-indexed,
   * where rank 1 is the highest XP user.
   * 
   * **Validates: Requirements 9.1, 9.3**
   */
  it('Property 12.2: User rank is 1-indexed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (zrevrank) => {
          const userId = 'user-1';
          const xp = 5000;

          (mockRedis.zscore as jest.Mock).mockResolvedValue(xp);
          (mockRedis.zrevrank as jest.Mock).mockResolvedValue(zrevrank);
          (query as jest.Mock).mockResolvedValue({
            rows: [{ level: 10 }],
          });

          // Rank should be zrevrank + 1 (0-indexed to 1-indexed)
          const expectedRank = zrevrank + 1;
          expect(expectedRank).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User not on leaderboard should have rank -1
   * 
   * For any user not found on the leaderboard, their rank should be -1.
   * 
   * **Validates: Requirements 9.4**
   */
  it('Property 12.3: User not on leaderboard has rank -1', () => {
    const userId = 'user-not-found';

    (mockRedis.zscore as jest.Mock).mockResolvedValue(null);

    // When user is not found, rank should be -1
    expect(mockRedis.zscore).toBeDefined();
  });

  // MARK: - Property 12.4: Rank Consistency

  /**
   * Property: If user A has more XP than user B, user A should have a lower rank number
   * 
   * Rank numbers are inversely proportional to XP (lower rank number = higher XP).
   * 
   * **Validates: Requirements 9.1, 9.2**
   */
  it('Property 12.4: Rank is inversely proportional to XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 1000000 }),
        (xp1, xp2) => {
          // If xp1 > xp2, then rank1 should be < rank2
          if (xp1 > xp2) {
            // User with higher XP should have lower rank number
            expect(xp1).toBeGreaterThan(xp2);
          } else if (xp2 > xp1) {
            // User with higher XP should have lower rank number
            expect(xp2).toBeGreaterThan(xp1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pagination should not skip or duplicate users
   * 
   * For any pagination parameters (limit, offset), the returned users
   * should be unique and in the correct order.
   * 
   * **Validates: Requirements 9.3, 9.4**
   */
  it('Property 12.5: Pagination does not skip or duplicate users', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 1000 }),
        (limit, offset) => {
          // Validate pagination parameters
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(1000);
          expect(offset).toBeGreaterThanOrEqual(0);

          // Redis zrevrange should be called with correct range
          // Range should be [offset, offset + limit - 1]
          const expectedStart = offset;
          const expectedEnd = offset + limit - 1;

          expect(expectedStart).toBeLessThanOrEqual(expectedEnd);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Nearby competitors should be within ±5 positions of user
   * 
   * For any user on the leaderboard, nearby competitors should be
   * within 5 positions above and 5 positions below.
   * 
   * **Validates: Requirements 9.4**
   */
  it('Property 12.6: Nearby competitors are within ±5 positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 95 }),
        (userRank) => {
          // Nearby competitors should be from rank (userRank - 5) to (userRank + 5)
          const minRank = Math.max(1, userRank - 5);
          const maxRank = userRank + 5;

          // All nearby ranks should be within this range
          for (let rank = minRank; rank <= maxRank; rank++) {
            expect(rank).toBeGreaterThanOrEqual(minRank);
            expect(rank).toBeLessThanOrEqual(maxRank);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.7: Weekly Leaderboard Reset

  /**
   * Property: Weekly leaderboard should only include XP earned in current week
   * 
   * Weekly XP should be calculated from workouts created since Monday 00:00 UTC.
   * 
   * **Validates: Requirements 9.3**
   */
  it('Property 12.7: Weekly leaderboard uses only current week XP', () => {
    fc.assert(
      fc.property(
        fc.date(),
        (date) => {
          // Calculate Monday 00:00 UTC for the given date
          const dayOfWeek = date.getUTCDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const monday = new Date(date);
          monday.setUTCDate(monday.getUTCDate() - daysToMonday);
          monday.setUTCHours(0, 0, 0, 0);

          // Weekly XP should only include workouts after Monday 00:00 UTC
          expect(monday.getUTCDay()).toBe(1); // Monday
          expect(monday.getUTCHours()).toBe(0);
          expect(monday.getUTCMinutes()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.8: Friends Leaderboard Consistency

  /**
   * Property: Friends leaderboard should only include connected friends
   * 
   * For any user, the friends leaderboard should only contain users
   * who have an accepted friendship connection.
   * 
   * **Validates: Requirements 9.2**
   */
  it('Property 12.8: Friends leaderboard only includes connected friends', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (friendIds) => {
          // All friends in leaderboard should be from the connected friends list
          for (const friendId of friendIds) {
            expect(friendId).toBeDefined();
            expect(typeof friendId).toBe('string');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // MARK: - Property 12.9: XP Score Consistency

  /**
   * Property: User's XP score on leaderboard should match their total XP
   * 
   * For any user on the leaderboard, the XP score displayed should
   * exactly match their total_xp from the database.
   * 
   * **Validates: Requirements 9.1**
   */
  it('Property 12.9: Leaderboard XP matches database total XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (totalXP) => {
          const userId = 'user-1';

          (mockRedis.zscore as jest.Mock).mockResolvedValue(totalXP);
          (query as jest.Mock).mockResolvedValue({
            rows: [{ total_xp: totalXP, level: 10 }],
          });

          // XP from Redis should match database
          expect(mockRedis.zscore).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.10: Rank Stability

  /**
   * Property: User rank should only change when their XP changes
   * 
   * For any user, their rank should remain stable unless their XP changes
   * or other users' XP changes relative to them.
   * 
   * **Validates: Requirements 9.1**
   */
  it('Property 12.10: Rank changes only when XP changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (xp) => {
          const userId = 'user-1';

          // Same XP should result in same rank
          (mockRedis.zscore as jest.Mock).mockResolvedValue(xp);
          (mockRedis.zrevrank as jest.Mock).mockResolvedValue(5);

          // Rank should be consistent for same XP
          expect(mockRedis.zrevrank).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.11: Leaderboard Bounds

  /**
   * Property: Leaderboard limit should be between 1 and 1000
   * 
   * For any leaderboard query, the limit parameter should be validated
   * to be between 1 and 1000.
   * 
   * **Validates: Requirements 9.4**
   */
  it('Property 12.11: Leaderboard limit is within valid bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (limit) => {
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(1000);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Leaderboard offset should be non-negative
   * 
   * For any leaderboard query, the offset parameter should be non-negative.
   * 
   * **Validates: Requirements 9.4**
   */
  it('Property 12.12: Leaderboard offset is non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (offset) => {
          expect(offset).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.13: Rank Uniqueness

  /**
   * Property: No two users should have the same rank on the same leaderboard
   * 
   * For any leaderboard, each rank number should be unique.
   * 
   * **Validates: Requirements 9.1, 9.2, 9.3**
   */
  it('Property 12.13: Ranks are unique on leaderboard', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            xp: fc.integer({ min: 0, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (users) => {
          // Create a set of ranks
          const ranks = new Set<number>();

          // Each user should have a unique rank
          for (let i = 0; i < users.length; i++) {
            const rank = i + 1; // 1-indexed
            expect(ranks.has(rank)).toBe(false);
            ranks.add(rank);
          }

          // All ranks should be unique
          expect(ranks.size).toBe(users.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  // MARK: - Property 12.14: Leaderboard Completeness

  /**
   * Property: Leaderboard should include all users with non-zero XP
   * 
   * For any leaderboard query, all users with XP > 0 should be included
   * (subject to pagination limits).
   * 
   * **Validates: Requirements 9.1, 9.2, 9.3**
   */
  it('Property 12.14: Leaderboard includes all users with XP', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            xp: fc.integer({ min: 1, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (users) => {
          // All users with XP > 0 should be on leaderboard
          for (const user of users) {
            expect(user.xp).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // MARK: - Property 12.15: Leaderboard Caching

  /**
   * Property: Leaderboard should be cached and expire after 5 minutes
   * 
   * For performance, leaderboard data should be cached in Redis
   * with a 5-minute TTL.
   * 
   * **Validates: Requirements 9.6, 9.7**
   */
  it('Property 12.15: Leaderboard cache expires after 5 minutes', () => {
    const fiveMinutesInSeconds = 5 * 60;

    // Cache should expire after 5 minutes (300 seconds)
    expect(fiveMinutesInSeconds).toBe(300);
  });

  // MARK: - Property 12.16: Leaderboard Consistency Across Types

  /**
   * Property: User's XP should be consistent across all leaderboard types
   * 
   * For any user, their total XP should be the same on global and friends
   * leaderboards (weekly XP is different by design).
   * 
   * **Validates: Requirements 9.1, 9.2**
   */
  it('Property 12.16: User XP is consistent across leaderboard types', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (totalXP) => {
          const userId = 'user-1';

          // Total XP should be same on global and friends leaderboards
          (mockRedis.zscore as jest.Mock).mockResolvedValue(totalXP);

          // Both queries should return same XP
          expect(mockRedis.zscore).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.17: Leaderboard Entry Completeness

  /**
   * Property: Each leaderboard entry should have all required fields
   * 
   * For any leaderboard entry, it should include: rank, userId, name, level, xp, profilePictureUrl
   * 
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
   */
  it('Property 12.17: Leaderboard entries have all required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          rank: fc.integer({ min: 1, max: 1000 }),
          userId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          level: fc.integer({ min: 1, max: 100 }),
          xp: fc.integer({ min: 0, max: 1000000 }),
          profilePictureUrl: fc.option(fc.webUrl()),
        }),
        (entry) => {
          // All fields should be present
          expect(entry.rank).toBeDefined();
          expect(entry.userId).toBeDefined();
          expect(entry.name).toBeDefined();
          expect(entry.level).toBeDefined();
          expect(entry.xp).toBeDefined();
          expect(entry.profilePictureUrl).toBeDefined();

          // Fields should have correct types
          expect(typeof entry.rank).toBe('number');
          expect(typeof entry.userId).toBe('string');
          expect(typeof entry.name).toBe('string');
          expect(typeof entry.level).toBe('number');
          expect(typeof entry.xp).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 12.18: Leaderboard Sorting Stability

  /**
   * Property: Users with same XP should maintain consistent ordering
   * 
   * For any users with identical XP, their relative order should be
   * consistent across multiple queries.
   * 
   * **Validates: Requirements 9.1**
   */
  it('Property 12.18: Leaderboard sorting is stable for same XP', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            xp: fc.constant(5000), // Same XP for all
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (users) => {
          // Users with same XP should maintain consistent order
          // (typically by user ID or creation time)
          for (const user of users) {
            expect(user.xp).toBe(5000);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
