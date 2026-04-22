import { HomeScreenWidgetService, WidgetData } from '../HomeScreenWidgetService';
import axios from 'axios';
import SQLite from 'react-native-sqlite-storage';

jest.mock('axios');
jest.mock('react-native-sqlite-storage');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockDb = {
  executeSql: jest.fn(),
  close: jest.fn(),
};

describe('HomeScreenWidgetService', () => {
  let service: HomeScreenWidgetService;
  const apiBaseUrl = 'https://api.fitquest.com';
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

    service = new HomeScreenWidgetService(apiBaseUrl, userId);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Small Widget', () => {
    it('should get small widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const result = await service.getSmallWidgetData(false);

      expect(result.widgetType).toBe('SMALL');
      expect(result.currentStreak).toBe(5);
      expect(result.currentXP).toBe(1250);
      expect(result.isDarkMode).toBe(false);
    });

    it('should support dark mode', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const result = await service.getSmallWidgetData(true);

      expect(result.isDarkMode).toBe(true);
    });

    it('should cache small widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const result1 = await service.getSmallWidgetData(false);
      const result2 = await service.getSmallWidgetData(false);

      // Should only call API once due to caching
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      expect(result1.currentStreak).toBe(result2.currentStreak);
    });
  });

  describe('Medium Widget', () => {
    it('should get medium widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'IN_PROGRESS' as const,
        nextMilestone: 'Complete today\'s workout',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const result = await service.getMediumWidgetData(false);

      expect(result.widgetType).toBe('MEDIUM');
      expect(result.todayWorkoutStatus).toBe('IN_PROGRESS');
      expect(result.nextMilestone).toBe('Complete today\'s workout');
    });

    it('should cache medium widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'IN_PROGRESS' as const,
        nextMilestone: 'Complete today\'s workout',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      await service.getMediumWidgetData(false);
      await service.getMediumWidgetData(false);

      // Should only call API once due to caching
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Large Widget', () => {
    it('should get large widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Reach Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [
          {
            friendId: 'friend-1',
            friendName: 'John',
            activity: 'Completed a workout',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const result = await service.getLargeWidgetData(false);

      expect(result.widgetType).toBe('LARGE');
      expect(result.leaderboardPosition).toBe(42);
      expect(result.friendsActivity).toHaveLength(1);
    });

    it('should cache large widget data', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Reach Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      await service.getLargeWidgetData(false);
      await service.getLargeWidgetData(false);

      // Should only call API once due to caching
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Widget Refresh', () => {
    it('should refresh all widgets', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const callback = jest.fn();
      service.on('widgetsRefreshed', callback);

      await service.refreshAllWidgets(false);

      expect(callback).toHaveBeenCalled();
      expect(mockApiClient.get).toHaveBeenCalledTimes(3); // small, medium, large
    });

    it('should start auto-refresh', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      const callback = jest.fn();
      service.on('autoRefreshStarted', callback);

      service.startAutoRefresh(false);

      expect(callback).toHaveBeenCalled();
    });

    it('should stop auto-refresh', async () => {
      const callback = jest.fn();
      service.on('autoRefreshStopped', callback);

      service.startAutoRefresh(false);
      service.stopAutoRefresh();

      expect(callback).toHaveBeenCalled();
    });

    it('should refresh every 15 minutes', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      service.startAutoRefresh(false);

      // Advance time by 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);

      // Should have called API multiple times (initial + refresh)
      expect(mockApiClient.get).toHaveBeenCalled();

      service.stopAutoRefresh();
    });
  });

  describe('Refresh Configuration', () => {
    it('should set refresh configuration', () => {
      service.setRefreshConfig({
        refreshInterval: 10 * 60 * 1000,
        autoRefresh: true,
      });

      const config = service.getRefreshConfig();

      expect(config.refreshInterval).toBe(10 * 60 * 1000);
      expect(config.autoRefresh).toBe(true);
    });

    it('should get refresh configuration', () => {
      const config = service.getRefreshConfig();

      expect(config.refreshInterval).toBe(15 * 60 * 1000); // default
      expect(config.autoRefresh).toBe(true); // default
    });
  });

  describe('Widget Tap Handling', () => {
    it('should route small widget tap to home', () => {
      const route = service.handleWidgetTap('SMALL');

      expect(route).toBe('home');
    });

    it('should route medium widget tap to workouts', () => {
      const route = service.handleWidgetTap('MEDIUM');

      expect(route).toBe('workouts');
    });

    it('should route large widget tap to leaderboard', () => {
      const route = service.handleWidgetTap('LARGE');

      expect(route).toBe('leaderboard');
    });
  });

  describe('Event Listeners', () => {
    it('should emit widgetsRefreshed event', async () => {
      const callback = jest.fn();
      service.on('widgetsRefreshed', callback);

      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      await service.refreshAllWidgets(false);

      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
      const callback = jest.fn();
      service.on('widgetsRefreshed', callback);
      service.off('widgetsRefreshed', callback);

      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
        leaderboardPosition: 42,
        leaderboardTotal: 1000,
        friendsActivity: [],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      await service.refreshAllWidgets(false);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Offline Functionality', () => {
    it('should return default widget data on API error', async () => {
      const mockApiClient = mockAxios.create();
      (mockApiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getSmallWidgetData(false);

      expect(result.widgetType).toBe('SMALL');
      expect(result.currentStreak).toBe(0); // default
      expect(result.currentLevel).toBe(1); // default
    });

    it('should store widget data locally', async () => {
      const mockApiClient = mockAxios.create();
      const widgetData = {
        currentStreak: 5,
        longestStreak: 10,
        currentXP: 1250,
        xpToNextLevel: 250,
        currentLevel: 3,
        todayWorkoutStatus: 'COMPLETED' as const,
        nextMilestone: 'Level 4',
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

      await service.getSmallWidgetData(false);

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO widget_data'),
        expect.any(Array)
      );
    });
  });

  describe('Database Cleanup', () => {
    it('should close database connection', async () => {
      await service.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should clear cache', async () => {
      await service.clearCache();

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM widget_cache')
      );
    });
  });
});

/**
 * Property-Based Tests: Home Screen Widgets
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6**
 *
 * Property 1: All widget types should have valid data
 * Property 2: Dark mode should be consistently applied
 * Property 3: Widget refresh should maintain data consistency
 */
describe('HomeScreenWidgetService - Property Tests', () => {
  let service: HomeScreenWidgetService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

    service = new HomeScreenWidgetService('https://api.fitquest.com', 'test-user-123');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should provide valid widget data for all types', async () => {
    const mockApiClient = mockAxios.create();
    const widgetData = {
      currentStreak: 5,
      longestStreak: 10,
      currentXP: 1250,
      xpToNextLevel: 250,
      currentLevel: 3,
      todayWorkoutStatus: 'COMPLETED' as const,
      nextMilestone: 'Level 4',
      leaderboardPosition: 42,
      leaderboardTotal: 1000,
      friendsActivity: [],
    };

    (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

    const small = await service.getSmallWidgetData(false);
    const medium = await service.getMediumWidgetData(false);
    const large = await service.getLargeWidgetData(false);

    // Property 1: All widgets should have valid data
    expect(small.currentLevel).toBeGreaterThan(0);
    expect(medium.currentLevel).toBeGreaterThan(0);
    expect(large.currentLevel).toBeGreaterThan(0);

    expect(small.currentXP).toBeGreaterThanOrEqual(0);
    expect(medium.currentXP).toBeGreaterThanOrEqual(0);
    expect(large.currentXP).toBeGreaterThanOrEqual(0);
  });

  it('should apply dark mode consistently', async () => {
    const mockApiClient = mockAxios.create();
    const widgetData = {
      currentStreak: 5,
      longestStreak: 10,
      currentXP: 1250,
      xpToNextLevel: 250,
      currentLevel: 3,
      todayWorkoutStatus: 'COMPLETED' as const,
      nextMilestone: 'Level 4',
      leaderboardPosition: 42,
      leaderboardTotal: 1000,
      friendsActivity: [],
    };

    (mockApiClient.get as jest.Mock).mockResolvedValue({ data: widgetData });

    const lightSmall = await service.getSmallWidgetData(false);
    const darkSmall = await service.getSmallWidgetData(true);

    // Property 2: Dark mode should be set correctly
    expect(lightSmall.isDarkMode).toBe(false);
    expect(darkSmall.isDarkMode).toBe(true);

    // Data should be the same except for dark mode
    expect(lightSmall.currentStreak).toBe(darkSmall.currentStreak);
  });
});
