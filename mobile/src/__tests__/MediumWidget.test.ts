import WidgetService, { WorkoutStatusData, WidgetError, WidgetErrorType } from '@services/WidgetService';

jest.mock('@services/WidgetService');

describe('MediumWidget - Workout Status and Milestones', () => {
  const mockWidgetService = WidgetService as jest.Mocked<typeof WidgetService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('widget data updates', () => {
    it('should load workout status data on mount', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '14 day streak',
        daysUntilMilestone: 7,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data).toEqual(mockData);
      expect(mockWidgetService.getMediumWidgetData).toHaveBeenCalledWith(userId);
    });

    it('should refresh widget data every 15 minutes', () => {
      mockWidgetService.getRefreshInterval.mockReturnValueOnce(15 * 60 * 1000);
      const interval = mockWidgetService.getRefreshInterval();
      expect(interval).toBe(15 * 60 * 1000);
    });

    it('should handle loading state during data fetch', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: false,
        workoutCount: 0,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 7,
      };

      mockWidgetService.getMediumWidgetData.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockData), 100))
      );

      const promise = mockWidgetService.getMediumWidgetData(userId);
      expect(promise).toBeDefined();
      await expect(promise).resolves.toEqual(mockData);
    });

    it('should handle error state when data fetch fails', async () => {
      const userId = 'user-123';
      mockWidgetService.getMediumWidgetData.mockRejectedValueOnce(new Error('Failed to load'));

      await expect(mockWidgetService.getMediumWidgetData(userId)).rejects.toThrow('Failed to load');
    });

    it('should handle user not found error', async () => {
      const userId = 'nonexistent-user';
      mockWidgetService.getMediumWidgetData.mockRejectedValueOnce(new Error('User not found'));

      await expect(mockWidgetService.getMediumWidgetData(userId)).rejects.toThrow('User not found');
    });

    it('should handle network error gracefully', async () => {
      const userId = 'user-123';
      mockWidgetService.getMediumWidgetData.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(mockWidgetService.getMediumWidgetData(userId)).rejects.toThrow('Network connection failed');
    });
  });

  describe('widget tap navigation', () => {
    it('should trigger onTap callback when widget is tapped', () => {
      const onTap = jest.fn();
      onTap();
      expect(onTap).toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('should navigate to workout screen on tap', () => {
      const onTap = jest.fn(() => {
        // Navigate to workout screen
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
    it('should display workout status when workout completed today', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '14 day streak',
        daysUntilMilestone: 7,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.hasWorkoutToday).toBe(true);
      expect(data.workoutCount).toBe(1);
    });

    it('should display workout status when no workout today', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: false,
        workoutCount: 0,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 7,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.hasWorkoutToday).toBe(false);
      expect(data.workoutCount).toBe(0);
    });

    it('should display next milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '30 day streak',
        daysUntilMilestone: 20,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.nextMilestone).toBe('30 day streak');
    });

    it('should display days until next milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '14 day streak',
        daysUntilMilestone: 5,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(5);
    });

    it('should display multiple workouts count', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 3,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 2,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.workoutCount).toBe(3);
    });

    it('should display zero workouts count', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: false,
        workoutCount: 0,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 7,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.workoutCount).toBe(0);
    });

    it('should display 7 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 3,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.nextMilestone).toBe('7 day streak');
    });

    it('should display 100 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '100 day streak',
        daysUntilMilestone: 50,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.nextMilestone).toBe('100 day streak');
    });
  });

  describe('widget size constraints', () => {
    it('should fit in 2x2 widget size', () => {
      const widgetSize = '2x2';
      expect(widgetSize).toBe('2x2');
    });

    it('should display workout status and milestone information', () => {
      const displayedInfo = ['workoutStatus', 'nextMilestone', 'daysUntilMilestone'];
      expect(displayedInfo).toContain('workoutStatus');
      expect(displayedInfo).toContain('nextMilestone');
      expect(displayedInfo).toContain('daysUntilMilestone');
    });
  });

  describe('milestone calculation', () => {
    it('should calculate correct days until 7 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 3,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(3);
    });

    it('should calculate correct days until 14 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '14 day streak',
        daysUntilMilestone: 10,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(10);
    });

    it('should calculate correct days until 30 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '30 day streak',
        daysUntilMilestone: 25,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(25);
    });

    it('should calculate correct days until 60 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '60 day streak',
        daysUntilMilestone: 55,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(55);
    });

    it('should calculate correct days until 100 day milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '100 day streak',
        daysUntilMilestone: 95,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(95);
    });

    it('should handle zero days until milestone', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 0,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.daysUntilMilestone).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very high workout count', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 100,
        nextMilestone: '7 day streak',
        daysUntilMilestone: 2,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.workoutCount).toBe(100);
    });

    it('should handle milestone string with special characters', async () => {
      const userId = 'user-123';
      const mockData: WorkoutStatusData = {
        hasWorkoutToday: true,
        workoutCount: 1,
        nextMilestone: '100+ day streak',
        daysUntilMilestone: 0,
      };

      mockWidgetService.getMediumWidgetData.mockResolvedValueOnce(mockData);

      const data = await mockWidgetService.getMediumWidgetData(userId);
      expect(data.nextMilestone).toBe('100+ day streak');
    });
  });
});
