import ActivityFeedService, {
  ActivityFeedEntry,
  ActivityFeedPage,
  ActivityFeedError,
} from '../services/ActivityFeedService';
import DatabaseManager from '@database/DatabaseManager';
import { mockAxiosGet, mockAxiosPost } from './setup';

jest.mock('@database/DatabaseManager');
jest.mock('axios');
jest.mock('../services/SyncEngine');

describe('ActivityFeedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
    mockAxiosPost.mockClear();
  });

  describe('getActivityFeed', () => {
    it('should fetch activity feed with pagination', async () => {
      const mockEntries: ActivityFeedEntry[] = [
        {
          id: 'activity1',
          userId: 'user1',
          userName: 'John Doe',
          activityType: 'WORKOUT_COMPLETED',
          metadata: { duration: 60, volume: 5000 },
          createdAt: new Date(),
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({
        data: { entries: mockEntries, total: 100 },
      });

      const result = await ActivityFeedService.getActivityFeed(1, 50);

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(100);
    });

    it('should throw error on invalid page number', async () => {
      await expect(ActivityFeedService.getActivityFeed(0, 50)).rejects.toThrow(
        ActivityFeedError
      );
    });

    it('should throw error on invalid page size', async () => {
      await expect(ActivityFeedService.getActivityFeed(1, 200)).rejects.toThrow(
        ActivityFeedError
      );
    });
  });

  describe('createLocalActivityEntry', () => {
    it('should create local activity entry', async () => {
      const result = await ActivityFeedService.createLocalActivityEntry(
        'user1',
        'John Doe',
        'WORKOUT_COMPLETED',
        { duration: 60, volume: 5000 },
        'workout123'
      );

      expect(result.userId).toBe('user1');
      expect(result.userName).toBe('John Doe');
      expect(result.activityType).toBe('WORKOUT_COMPLETED');
    });

    it('should throw error on invalid activity type', async () => {
      await expect(
        ActivityFeedService.createLocalActivityEntry(
          'user1',
          'John Doe',
          'INVALID_TYPE' as any,
          {}
        )
      ).rejects.toThrow(ActivityFeedError);
    });
  });

  describe('activity types', () => {
    it('should support all activity types', async () => {
      const activityTypes = [
        'WORKOUT_COMPLETED',
        'LEVEL_UP',
        'ACHIEVEMENT_UNLOCKED',
        'STREAK_MILESTONE',
        'FRIEND_ADDED',
      ];

      for (const type of activityTypes) {
        const result = await ActivityFeedService.createLocalActivityEntry(
          'user1',
          'John Doe',
          type as any,
          {}
        );

        expect(result.activityType).toBe(type);
      }
    });
  });

  describe('pagination', () => {
    it('should correctly paginate activity feed', async () => {
      const mockEntries: ActivityFeedEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `activity${i}`,
        userId: `user${i}`,
        userName: `User ${i}`,
        activityType: 'WORKOUT_COMPLETED',
        metadata: {},
        createdAt: new Date(),
      }));

      mockAxiosGet.mockResolvedValue({
        data: { entries: mockEntries, total: 200 },
      });

      const page1 = await ActivityFeedService.getActivityFeed(1, 50);
      expect(page1.page).toBe(1);
      expect(page1.entries).toHaveLength(50);

      const page2 = await ActivityFeedService.getActivityFeed(2, 50);
      expect(page2.page).toBe(2);
    });
  });

  describe('activity metadata', () => {
    it('should preserve activity metadata', async () => {
      const metadata = {
        duration: 60,
        volume: 5000,
        exerciseCount: 5,
        xpEarned: 150,
      };

      const result = await ActivityFeedService.createLocalActivityEntry(
        'user1',
        'John Doe',
        'WORKOUT_COMPLETED',
        metadata
      );

      expect(result.metadata).toEqual(metadata);
    });
  });
});
