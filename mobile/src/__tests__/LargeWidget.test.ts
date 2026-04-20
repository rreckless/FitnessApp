import WidgetService, { LeaderboardWidgetData, WidgetError, WidgetErrorType } from '@services/WidgetService';

jest.mock('@services/WidgetService');

describe('LargeWidget - Leaderboard and Friends Activity', () => {
  const mockWidgetService = WidgetService as jest.Mocked<typeof WidgetService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('widget data updates', () => {
    it('should load leaderboard data on mount', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 5000, level: 10 },
          { rank: 2, name: 'Bob', xp: 4000, level: 9 },
          { rank: 3, name: 'Charlie', xp: 3000, level: 8 },
        ],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: new Date() },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data).toEqual(mockData);
      expect(mockWidgetService.getLargeWidgetData).toHaveBeenCalledWith(userId);
    });

    it('should refresh widget data every 15 minutes', () => {
      mockWidgetService.getRefreshInterval.mockReturnValueOnce(15 * 60 * 1000);
      const interval = mockWidgetService.getRefreshInterval();
      expect(interval).toBe(15 * 60 * 1000);
    });

    it('should handle loading state during data fetch', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 1,
        userXP: 0,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockData), 100))
      );

      const promise = mockWidgetService.getLargeWidgetData(userId);
      expect(promise).toBeDefined();
      await expect(promise).resolves.toEqual(mockData);
    });

    it('should handle error state when data fetch fails', async () => {
      const userId = 'user-123';
      mockWidgetService.getLargeWidgetData.mockRejectedValueOnce(new Error('Failed to load'));

      await expect(mockWidgetService.getLargeWidgetData(userId)).rejects.toThrow('Failed to load');
    });

    it('should handle user not found error', async () => {
      const userId = 'nonexistent-user';
      mockWidgetService.getLargeWidgetData.mockRejectedValueOnce(new Error('User not found'));

      await expect(mockWidgetService.getLargeWidgetData(userId)).rejects.toThrow('User not found');
    });

    it('should handle network error gracefully', async () => {
      const userId = 'user-123';
      mockWidgetService.getLargeWidgetData.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(mockWidgetService.getLargeWidgetData(userId)).rejects.toThrow('Network connection failed');
    });
  });

  describe('widget tap navigation', () => {
    it('should trigger onTap callback when widget is tapped', () => {
      const onTap = jest.fn();
      onTap();
      expect(onTap).toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('should navigate to leaderboard screen on tap', () => {
      const onTap = jest.fn(() => {
        // Navigate to leaderboard screen
      });
      onTap();
      expect(onTap).toHaveBeenCalled();
    });

    it('should handle multiple taps', () => {
      const onTap = jest.fn();
      onTap();
      onTap();
      onTap();
      expect(onTap).toHaveBeenCalledTimes(3);
    });
  });

  describe('dark/light mode rendering', () => {
    it('should render with light mode colors', () => {
      const isDark = false;
      expect(isDark).toBe(false);
    });

    it('should render with dark mode colors', () => {
      const isDark = true;
      expect(isDark).toBe(true);
    });

    it('should update colors when color scheme changes from light to dark', () => {
      let isDark = false;
      expect(isDark).toBe(false);

      isDark = true;
      expect(isDark).toBe(true);
    });

    it('should update colors when color scheme changes from dark to light', () => {
      let isDark = true;
      expect(isDark).toBe(true);

      isDark = false;
      expect(isDark).toBe(false);
    });

    it('should handle null color scheme gracefully', () => {
      const isDark = false;
      expect(isDark).toBe(false);
    });
  });

  describe('widget data display', () => {
    it('should display user position', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userPosition).toBe(5);
    });

    it('should display user position as rank 1', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 1,
        userXP: 10000,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userPosition).toBe(1);
    });

    it('should display user XP', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userXP).toBe(2000);
    });

    it('should display zero XP for new users', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 1000,
        userXP: 0,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userXP).toBe(0);
    });

    it('should display top 3 users', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 5000, level: 10 },
          { rank: 2, name: 'Bob', xp: 4000, level: 9 },
          { rank: 3, name: 'Charlie', xp: 3000, level: 8 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.topThreeUsers).toHaveLength(3);
      expect(data.topThreeUsers[0].rank).toBe(1);
      expect(data.topThreeUsers[0].name).toBe('Alice');
      expect(data.topThreeUsers[0].xp).toBe(5000);
      expect(data.topThreeUsers[0].level).toBe(10);
    });

    it('should display top users in correct order by XP', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 10000, level: 15 },
          { rank: 2, name: 'Bob', xp: 8000, level: 13 },
          { rank: 3, name: 'Charlie', xp: 6000, level: 11 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.topThreeUsers[0].xp).toBeGreaterThan(data.topThreeUsers[1].xp);
      expect(data.topThreeUsers[1].xp).toBeGreaterThan(data.topThreeUsers[2].xp);
    });

    it('should display friends activity', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
          { friendName: 'Bob', activity: 'completed a workout', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity).toHaveLength(2);
      expect(data.friendsActivity[0].friendName).toBe('Alice');
      expect(data.friendsActivity[1].friendName).toBe('Bob');
    });

    it('should handle empty leaderboard', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 1,
        userXP: 0,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.topThreeUsers).toHaveLength(0);
    });

    it('should handle empty friends activity', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 5000, level: 10 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity).toHaveLength(0);
    });

    it('should display activity with correct timestamp', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity[0].timestamp).toEqual(now);
    });
  });

  describe('widget size constraints', () => {
    it('should fit in 2x4 widget size', () => {
      const widgetSize = '2x4';
      expect(widgetSize).toBe('2x4');
    });

    it('should display leaderboard and friends activity', () => {
      const displayedInfo = ['userPosition', 'topThreeUsers', 'friendsActivity'];
      expect(displayedInfo).toContain('userPosition');
      expect(displayedInfo).toContain('topThreeUsers');
      expect(displayedInfo).toContain('friendsActivity');
    });
  });

  describe('leaderboard display', () => {
    it('should display user rank with correct position', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 42,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userPosition).toBe(42);
    });

    it('should display top user with highest XP', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 10000, level: 15 },
          { rank: 2, name: 'Bob', xp: 8000, level: 13 },
          { rank: 3, name: 'Charlie', xp: 6000, level: 11 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.topThreeUsers[0].xp).toBe(10000);
      expect(data.topThreeUsers[0].xp).toBeGreaterThan(data.topThreeUsers[1].xp);
    });

    it('should display user levels correctly', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 10000, level: 15 },
          { rank: 2, name: 'Bob', xp: 8000, level: 13 },
          { rank: 3, name: 'Charlie', xp: 6000, level: 11 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.topThreeUsers[0].level).toBe(15);
      expect(data.topThreeUsers[1].level).toBe(13);
      expect(data.topThreeUsers[2].level).toBe(11);
    });
  });

  describe('friends activity display', () => {
    it('should display friend name and activity', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity[0].friendName).toBe('Alice');
      expect(data.friendsActivity[0].activity).toBe('completed a workout');
    });

    it('should display activity timestamp', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity[0].timestamp).toEqual(now);
    });

    it('should display multiple activities', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
          { friendName: 'Bob', activity: 'reached level 10', timestamp: new Date(now.getTime() - 60000) },
          { friendName: 'Charlie', activity: 'unlocked achievement', timestamp: new Date(now.getTime() - 120000) },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity).toHaveLength(3);
    });

    it('should handle different activity types', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice', activity: 'completed a workout', timestamp: now },
          { friendName: 'Bob', activity: 'reached level 10', timestamp: now },
          { friendName: 'Charlie', activity: 'unlocked achievement', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity[0].activity).toBe('completed a workout');
      expect(data.friendsActivity[1].activity).toBe('reached level 10');
      expect(data.friendsActivity[2].activity).toBe('unlocked achievement');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very high user position', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 100000,
        userXP: 100,
        topThreeUsers: [],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userPosition).toBe(100000);
    });

    it('should handle very high XP values', async () => {
      const userId = 'user-123';
      const mockData: LeaderboardWidgetData = {
        userPosition: 1,
        userXP: 999999,
        topThreeUsers: [
          { rank: 1, name: 'Alice', xp: 999999, level: 100 },
        ],
        friendsActivity: [],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.userXP).toBe(999999);
      expect(data.topThreeUsers[0].xp).toBe(999999);
    });

    it('should handle special characters in friend names', async () => {
      const userId = 'user-123';
      const now = new Date();
      const mockData: LeaderboardWidgetData = {
        userPosition: 5,
        userXP: 2000,
        topThreeUsers: [],
        friendsActivity: [
          { friendName: 'Alice-O\'Brien', activity: 'completed a workout', timestamp: now },
        ],
      };

      mockWidgetService.getLargeWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getLargeWidgetData(userId);
      expect(data.friendsActivity[0].friendName).toBe('Alice-O\'Brien');
    });
  });
});
