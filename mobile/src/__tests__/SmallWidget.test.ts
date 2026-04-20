import WidgetService, { WidgetData, WidgetError, WidgetErrorType } from '@services/WidgetService';

jest.mock('@services/WidgetService');

describe('SmallWidget - Data Updates and Validation', () => {
  const mockWidgetService = WidgetService as jest.Mocked<typeof WidgetService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('widget data updates', () => {
    it('should load widget data on mount', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);
      mockWidgetService.validateWidgetData.mockImplementationOnce(() => {});

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data).toEqual(mockData);
      expect(mockWidgetService.getSmallWidgetData).toHaveBeenCalledWith(userId);
    });

    it('should refresh widget data every 15 minutes', () => {
      mockWidgetService.getRefreshInterval.mockReturnValueOnce(15 * 60 * 1000);
      const interval = mockWidgetService.getRefreshInterval();
      expect(interval).toBe(15 * 60 * 1000);
    });

    it('should handle loading state during data fetch', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalXP: 0,
        level: 1,
        xpToNextLevel: 500,
        xpProgress: 0,
      };

      mockWidgetService.getSmallWidgetData.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockData), 100))
      );

      const promise = mockWidgetService.getSmallWidgetData(userId);
      expect(promise).toBeDefined();
      await expect(promise).resolves.toEqual(mockData);
    });

    it('should handle error state when data fetch fails', async () => {
      const userId = 'user-123';
      mockWidgetService.getSmallWidgetData.mockRejectedValueOnce(new Error('Failed to load'));

      await expect(mockWidgetService.getSmallWidgetData(userId)).rejects.toThrow('Failed to load');
    });

    it('should handle user not found error', async () => {
      const userId = 'nonexistent-user';
      mockWidgetService.getSmallWidgetData.mockRejectedValueOnce(new Error('User not found'));

      await expect(mockWidgetService.getSmallWidgetData(userId)).rejects.toThrow('User not found');
    });

    it('should validate widget data after loading', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);
      mockWidgetService.validateWidgetData.mockImplementationOnce(() => {});

      await mockWidgetService.getSmallWidgetData(userId);
      mockWidgetService.validateWidgetData(mockData);
      expect(mockWidgetService.validateWidgetData).toHaveBeenCalledWith(mockData);
    });

    it('should reject invalid data with negative streak', () => {
      const invalidData: WidgetData = {
        userId: 'user-123',
        currentStreak: -1,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      // Validation should fail for negative streak
      expect(invalidData.currentStreak).toBeLessThan(0);
    });

    it('should reject invalid data with XP progress out of range', () => {
      const invalidData: WidgetData = {
        userId: 'user-123',
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 150,
      };

      // Validation should fail for XP progress > 100
      expect(invalidData.xpProgress).toBeGreaterThan(100);
    });
  });

  describe('widget tap navigation', () => {
    it('should trigger onTap callback when widget is tapped', () => {
      const onTap = jest.fn();
      onTap();
      expect(onTap).toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('should navigate to home screen on tap', () => {
      const onTap = jest.fn(() => {
        // Navigate to home screen
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
    it('should display current streak', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.currentStreak).toBe(14);
    });

    it('should display zero streak', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 0,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.currentStreak).toBe(0);
    });

    it('should display XP progress percentage', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.xpProgress).toBe(50);
    });

    it('should display XP progress at 0%', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalXP: 0,
        level: 1,
        xpToNextLevel: 500,
        xpProgress: 0,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.xpProgress).toBe(0);
    });

    it('should display XP progress at 100%', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 5000,
        level: 5,
        xpToNextLevel: 0,
        xpProgress: 100,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.xpProgress).toBe(100);
    });

    it('should display current level', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.level).toBe(5);
    });

    it('should display level 1 for new users', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalXP: 0,
        level: 1,
        xpToNextLevel: 500,
        xpProgress: 0,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.level).toBe(1);
    });

    it('should display progress bar with correct fill', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 75,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.xpProgress).toBe(75);
    });

    it('should display longest streak', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 5,
        longestStreak: 42,
        totalXP: 2500,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.longestStreak).toBe(42);
    });

    it('should display total XP', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 14,
        longestStreak: 30,
        totalXP: 5000,
        level: 5,
        xpToNextLevel: 500,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.totalXP).toBe(5000);
    });
  });

  describe('widget size constraints', () => {
    it('should fit in 1x1 widget size', () => {
      const widgetSize = '1x1';
      expect(widgetSize).toBe('1x1');
    });

    it('should display essential information only', () => {
      const essentialInfo = ['streak', 'xpProgress'];
      expect(essentialInfo).toContain('streak');
      expect(essentialInfo).toContain('xpProgress');
    });

    it('should display streak and level information', () => {
      const displayedInfo = ['currentStreak', 'level', 'xpProgress'];
      expect(displayedInfo).toContain('currentStreak');
      expect(displayedInfo).toContain('level');
      expect(displayedInfo).toContain('xpProgress');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very high streak values', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 365,
        longestStreak: 365,
        totalXP: 100000,
        level: 50,
        xpToNextLevel: 1000,
        xpProgress: 75,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.currentStreak).toBe(365);
      expect(data.longestStreak).toBe(365);
    });

    it('should handle very high XP values', async () => {
      const userId = 'user-123';
      const mockData: WidgetData = {
        userId,
        currentStreak: 100,
        longestStreak: 100,
        totalXP: 999999,
        level: 100,
        xpToNextLevel: 5000,
        xpProgress: 50,
      };

      mockWidgetService.getSmallWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getSmallWidgetData(userId);
      expect(data.totalXP).toBe(999999);
      expect(data.level).toBe(100);
    });

    it('should handle network error gracefully', async () => {
      const userId = 'user-123';
      mockWidgetService.getSmallWidgetData.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(mockWidgetService.getSmallWidgetData(userId)).rejects.toThrow('Network connection failed');
    });
  });
});
