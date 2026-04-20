import WidgetService, {
  WidgetData,
  WorkoutStatusData,
  LeaderboardWidgetData,
  WidgetError,
  WidgetErrorType,
} from '@services/WidgetService';
import DatabaseManager from '@database/DatabaseManager';

jest.mock('@database/DatabaseManager');

describe('WidgetService', () => {
  let mockDbManager: jest.Mocked<typeof DatabaseManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;
  });

  describe('getSmallWidgetData', () => {
    it('should return widget data with streak and XP progress', async () => {
      const userId = 'user-123';
      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: {
          length: 1,
          item: () => ({
            id: userId,
            level: 5,
            totalXP: 2500,
            currentStreak: 14,
            longestStreak: 30,
          }),
        },
      } as any);

      const result = await WidgetService.getSmallWidgetData(userId);

      expect(result).toMatchObject({
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
      });
      expect(result.xpProgress).toBeGreaterThanOrEqual(0);
      expect(result.xpProgress).toBeLessThanOrEqual(100);
    });

    it('should handle user not found', async () => {
      const userId = 'nonexistent';
      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: { length: 0 },
      } as any);

      await expect(WidgetService.getSmallWidgetData(userId)).rejects.toThrow(
        WidgetError
      );
    });

    it('should handle database errors', async () => {
      const userId = 'user-123';
      mockDbManager.executeSql.mockRejectedValueOnce(new Error('DB error'));

      await expect(WidgetService.getSmallWidgetData(userId)).rejects.toThrow(
        WidgetError
      );
    });

    it('should calculate XP progress correctly', async () => {
      const userId = 'user-123';
      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: {
          length: 1,
          item: () => ({
            id: userId,
            level: 2,
            totalXP: 750, // halfway to level 3 (1500)
            currentStreak: 0,
            longestStreak: 0,
          }),
        },
      } as any);

      const result = await WidgetService.getSmallWidgetData(userId);

      expect(result.xpProgress).toBeGreaterThan(0);
      expect(result.xpToNextLevel).toBeGreaterThan(0);
    });
  });

  describe('getMediumWidgetData', () => {
    it('should return workout status with today\'s workout', async () => {
      const userId = 'user-123';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ count: 1 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ currentStreak: 7 }),
          },
        } as any);

      const result = await WidgetService.getMediumWidgetData(userId);

      expect(result.hasWorkoutToday).toBe(true);
      expect(result.workoutCount).toBe(1);
      expect(result.nextMilestone).toBeDefined();
      expect(result.daysUntilMilestone).toBeGreaterThanOrEqual(0);
    });

    it('should return workout status without today\'s workout', async () => {
      const userId = 'user-123';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ count: 0 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ currentStreak: 5 }),
          },
        } as any);

      const result = await WidgetService.getMediumWidgetData(userId);

      expect(result.hasWorkoutToday).toBe(false);
      expect(result.workoutCount).toBe(0);
    });

    it('should calculate correct days until next milestone', async () => {
      const userId = 'user-123';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ count: 1 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ currentStreak: 5 }),
          },
        } as any);

      const result = await WidgetService.getMediumWidgetData(userId);

      expect(result.daysUntilMilestone).toBe(2); // 7 - 5 = 2
    });

    it('should handle user not found', async () => {
      const userId = 'nonexistent';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ count: 0 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: { length: 0 },
        } as any);

      await expect(WidgetService.getMediumWidgetData(userId)).rejects.toThrow(
        WidgetError
      );
    });
  });

  describe('getLargeWidgetData', () => {
    it('should return leaderboard data with user position', async () => {
      const userId = 'user-123';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ totalXP: 2000 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 3,
            item: (index: number) => {
              const users = [
                { id: 'user-1', name: 'Alice', totalXP: 5000, level: 10 },
                { id: 'user-2', name: 'Bob', totalXP: 4000, level: 9 },
                { id: 'user-3', name: 'Charlie', totalXP: 3000, level: 8 },
              ];
              return users[index];
            },
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ position: 5 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 2,
            item: (index: number) => {
              const activities = [
                { name: 'Alice', activity: 'completed a workout', timestamp: new Date().toISOString() },
                { name: 'Bob', activity: 'completed a workout', timestamp: new Date().toISOString() },
              ];
              return activities[index];
            },
          },
        } as any);

      const result = await WidgetService.getLargeWidgetData(userId);

      expect(result.userPosition).toBe(6); // 5 + 1
      expect(result.userXP).toBe(2000);
      expect(result.topThreeUsers).toHaveLength(3);
      expect(result.topThreeUsers[0].rank).toBe(1);
      expect(result.friendsActivity).toBeDefined();
    });

    it('should handle user not found', async () => {
      const userId = 'nonexistent';

      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: { length: 0 },
      } as any);

      await expect(WidgetService.getLargeWidgetData(userId)).rejects.toThrow(
        WidgetError
      );
    });

    it('should return empty friends activity if none available', async () => {
      const userId = 'user-123';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ totalXP: 2000 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 0,
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ position: 0 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 0,
          },
        } as any);

      const result = await WidgetService.getLargeWidgetData(userId);

      expect(result.topThreeUsers).toHaveLength(0);
      expect(result.friendsActivity).toHaveLength(0);
    });
  });

  describe('refreshAllWidgets', () => {
    it('should refresh all widget data simultaneously', async () => {
      const userId = 'user-123';

      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({
              id: userId,
              level: 5,
              totalXP: 2500,
              currentStreak: 14,
              longestStreak: 30,
            }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ count: 1 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ currentStreak: 14 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ totalXP: 2500 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ id: 'user-1', name: 'Alice', totalXP: 5000, level: 10 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ position: 5 }),
          },
        } as any)
        .mockResolvedValueOnce({
          rows: {
            length: 0,
          },
        } as any);

      const result = await WidgetService.refreshAllWidgets(userId);

      expect(result.small).toBeDefined();
      expect(result.medium).toBeDefined();
      expect(result.large).toBeDefined();
    });
  });

  describe('validateWidgetData', () => {
    it('should validate correct widget data', () => {
      const validData: WidgetData = {
        userId: 'user-123',
        currentStreak: 10,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      expect(() => WidgetService.validateWidgetData(validData)).not.toThrow();
    });

    it('should reject negative current streak', () => {
      const invalidData: WidgetData = {
        userId: 'user-123',
        currentStreak: -1,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      expect(() => WidgetService.validateWidgetData(invalidData)).toThrow(
        WidgetError
      );
    });

    it('should reject invalid XP progress', () => {
      const invalidData: WidgetData = {
        userId: 'user-123',
        currentStreak: 10,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 150,
      };

      expect(() => WidgetService.validateWidgetData(invalidData)).toThrow(
        WidgetError
      );
    });

    it('should reject level less than 1', () => {
      const invalidData: WidgetData = {
        userId: 'user-123',
        currentStreak: 10,
        longestStreak: 30,
        totalXP: 2500,
        level: 0,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      expect(() => WidgetService.validateWidgetData(invalidData)).toThrow(
        WidgetError
      );
    });
  });

  describe('getRefreshInterval', () => {
    it('should return 15 minute refresh interval', () => {
      const interval = WidgetService.getRefreshInterval();
      expect(interval).toBe(15 * 60 * 1000);
    });
  });
});
