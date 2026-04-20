import * as streakService from '../streakService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Unit Tests for Streak Service
 * 
 * **Validates: Requirements 7.0**
 */
describe('Streak Service', () => {
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Streak Increment Tests

  describe('Streak Increment', () => {
    it('should increment streak on consecutive days', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 5,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 6,
            longest_streak: 10,
            last_sync_at: new Date().toISOString(),
          },
        ],
      });

      const result = await streakService.incrementStreak(userId, new Date());

      expect(result.currentStreak).toBe(6);
      expect(result.longestStreak).toBe(10);
    });

    it('should reset streak if no workout in 24 hours', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 5,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 1,
            longest_streak: 10,
            last_sync_at: new Date().toISOString(),
          },
        ],
      });

      const result = await streakService.incrementStreak(userId, new Date());

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(10);
    });

    it('should update longest streak if current exceeds it', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 10,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 11,
            longest_streak: 11,
            last_sync_at: new Date().toISOString(),
          },
        ],
      });

      const result = await streakService.incrementStreak(userId, new Date());

      expect(result.currentStreak).toBe(11);
      expect(result.longestStreak).toBe(11);
    });

    it('should start streak at 1 for first workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 0,
            longest_streak: 0,
            last_sync_at: null,
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 1,
            longest_streak: 1,
            last_sync_at: new Date().toISOString(),
          },
        ],
      });

      const result = await streakService.incrementStreak(userId, new Date());

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });
  });

  // MARK: - Streak Reset Tests

  describe('Streak Reset', () => {
    it('should reset streak if no workout in 24 hours', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 5,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 0,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });

      const result = await streakService.checkAndResetStreak(userId);

      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(10);
    });

    it('should not reset streak if within 24 hours', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            current_streak: 5,
            longest_streak: 10,
            last_sync_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });

      const result = await streakService.checkAndResetStreak(userId);

      expect(result).toBeNull();
    });
  });

  // MARK: - Streak Data Retrieval Tests

  describe('Streak Data Retrieval', () => {
    it('should get streak data for user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: userId,
            current_streak: 7,
            longest_streak: 15,
            last_sync_at: new Date().toISOString(),
          },
        ],
      });

      const result = await streakService.getStreakData(userId);

      expect(result.userId).toBe(userId);
      expect(result.currentStreak).toBe(7);
      expect(result.longestStreak).toBe(15);
    });
  });

  // MARK: - Milestone Detection Tests

  describe('Milestone Detection', () => {
    it('should detect 7-day milestone', () => {
      const milestone = streakService.checkStreakMilestone(7);

      expect(milestone).not.toBeNull();
      expect(milestone?.days).toBe(7);
      expect(milestone?.xpReward).toBe(50);
    });

    it('should detect 14-day milestone', () => {
      const milestone = streakService.checkStreakMilestone(14);

      expect(milestone).not.toBeNull();
      expect(milestone?.days).toBe(14);
      expect(milestone?.xpReward).toBe(100);
    });

    it('should detect 30-day milestone', () => {
      const milestone = streakService.checkStreakMilestone(30);

      expect(milestone).not.toBeNull();
      expect(milestone?.days).toBe(30);
      expect(milestone?.xpReward).toBe(250);
    });

    it('should detect 60-day milestone', () => {
      const milestone = streakService.checkStreakMilestone(60);

      expect(milestone).not.toBeNull();
      expect(milestone?.days).toBe(60);
      expect(milestone?.xpReward).toBe(500);
    });

    it('should detect 100-day milestone', () => {
      const milestone = streakService.checkStreakMilestone(100);

      expect(milestone).not.toBeNull();
      expect(milestone?.days).toBe(100);
      expect(milestone?.xpReward).toBe(1000);
    });

    it('should return null for non-milestone streak', () => {
      const milestone = streakService.checkStreakMilestone(5);

      expect(milestone).toBeNull();
    });

    it('should get next milestone', () => {
      const nextMilestone = streakService.getNextMilestone(5);

      expect(nextMilestone).not.toBeNull();
      expect(nextMilestone?.days).toBe(7);
    });

    it('should calculate days until next milestone', () => {
      const daysUntil = streakService.daysUntilNextMilestone(5);

      expect(daysUntil).toBe(2);
    });
  });

  // MARK: - Validation Tests

  describe('Validation', () => {
    it('should reject negative current streak', () => {
      expect(() => {
        streakService.validateStreakData(-1, 10);
      }).toThrow('Current streak cannot be negative');
    });

    it('should reject negative longest streak', () => {
      expect(() => {
        streakService.validateStreakData(5, -1);
      }).toThrow('Longest streak cannot be negative');
    });

    it('should reject current streak > longest streak', () => {
      expect(() => {
        streakService.validateStreakData(15, 10);
      }).toThrow('Current streak cannot exceed longest streak');
    });

    it('should accept valid streak data', () => {
      expect(() => {
        streakService.validateStreakData(5, 10);
      }).not.toThrow();
    });
  });

  // MARK: - Batch Operations Tests

  describe('Batch Operations', () => {
    it('should batch reset expired streaks', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      });

      const resetCount = await streakService.batchResetExpiredStreaks();

      expect(resetCount).toBe(3);
    });
  });
});
