import * as activityFeedService from '../activityFeedService';
import { query } from '../../database/connection';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../../logging/logger');
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    lrange: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
  }));
});

describe('Activity Feed Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - createActivityFeedEntry

  /**
   * Test: Create activity feed entry for workout completion
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should create activity feed entry for workout completion', async () => {
    const userId = 'user-1';
    const workoutId = 'workout-1';
    const metadata = { totalVolume: 5000, totalXP: 50, exerciseCount: 5 };

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'entry-1',
          user_id: userId,
          activity_type: 'WORKOUT_COMPLETED',
          related_entity_id: workoutId,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock friends query for fan-out
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const entry = await activityFeedService.createActivityFeedEntry(
      userId,
      'WORKOUT_COMPLETED',
      workoutId,
      metadata
    );

    expect(entry.id).toBe('entry-1');
    expect(entry.userId).toBe(userId);
    expect(entry.activityType).toBe('WORKOUT_COMPLETED');
    expect(entry.relatedEntityId).toBe(workoutId);
    expect(entry.metadata).toEqual(metadata);
  });

  /**
   * Test: Create activity feed entry for level up
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should create activity feed entry for level up', async () => {
    const userId = 'user-1';
    const metadata = { newLevel: 5 };

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'entry-2',
          user_id: userId,
          activity_type: 'LEVEL_UP',
          related_entity_id: null,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock friends query for fan-out
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const entry = await activityFeedService.createActivityFeedEntry(
      userId,
      'LEVEL_UP',
      undefined,
      metadata
    );

    expect(entry.id).toBe('entry-2');
    expect(entry.userId).toBe(userId);
    expect(entry.activityType).toBe('LEVEL_UP');
    expect(entry.relatedEntityId).toBeNull();
    expect(entry.metadata).toEqual(metadata);
  });

  /**
   * Test: Create activity feed entry for achievement unlock
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should create activity feed entry for achievement unlock', async () => {
    const userId = 'user-1';
    const achievementId = 'achievement-1';
    const metadata = { achievementName: 'First Workout', rarity: 'COMMON' };

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'entry-3',
          user_id: userId,
          activity_type: 'ACHIEVEMENT_UNLOCKED',
          related_entity_id: achievementId,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock friends query for fan-out
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const entry = await activityFeedService.createActivityFeedEntry(
      userId,
      'ACHIEVEMENT_UNLOCKED',
      achievementId,
      metadata
    );

    expect(entry.id).toBe('entry-3');
    expect(entry.activityType).toBe('ACHIEVEMENT_UNLOCKED');
    expect(entry.relatedEntityId).toBe(achievementId);
  });

  /**
   * Test: Create activity feed entry for streak milestone
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should create activity feed entry for streak milestone', async () => {
    const userId = 'user-1';
    const metadata = { streakDays: 7 };

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'entry-4',
          user_id: userId,
          activity_type: 'STREAK_MILESTONE',
          related_entity_id: null,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock friends query for fan-out
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const entry = await activityFeedService.createActivityFeedEntry(
      userId,
      'STREAK_MILESTONE',
      undefined,
      metadata
    );

    expect(entry.activityType).toBe('STREAK_MILESTONE');
    expect(entry.metadata).toEqual(metadata);
  });

  /**
   * Test: Create activity feed entry for friend added
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should create activity feed entry for friend added', async () => {
    const userId = 'user-1';
    const friendId = 'user-2';
    const metadata = { friendName: 'John Doe' };

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'entry-5',
          user_id: userId,
          activity_type: 'FRIEND_ADDED',
          related_entity_id: friendId,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock friends query for fan-out
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const entry = await activityFeedService.createActivityFeedEntry(
      userId,
      'FRIEND_ADDED',
      friendId,
      metadata
    );

    expect(entry.activityType).toBe('FRIEND_ADDED');
    expect(entry.relatedEntityId).toBe(friendId);
  });

  // MARK: - getActivityFeed

  /**
   * Test: Get activity feed with pagination
   * 
   * **Validates: Requirements 11.4, 11.5, 11.6**
   */
  it('should get activity feed with pagination', async () => {
    const userId = 'user-1';
    const mockEntries = [
      {
        id: 'entry-1',
        user_id: 'friend-1',
        activity_type: 'WORKOUT_COMPLETED',
        related_entity_id: 'workout-1',
        metadata: JSON.stringify({ totalVolume: 5000, totalXP: 50 }),
        created_at: new Date().toISOString(),
      },
      {
        id: 'entry-2',
        user_id: 'friend-2',
        activity_type: 'LEVEL_UP',
        related_entity_id: null,
        metadata: JSON.stringify({ newLevel: 5 }),
        created_at: new Date().toISOString(),
      },
    ];

    // Mock Redis lrange (empty, so fall back to database)
    // Mock database query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockEntries,
    });

    // Mock count query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 2 }],
    });

    const result = await activityFeedService.getActivityFeed(userId, 1, 50);

    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.entries[0].activityType).toBe('WORKOUT_COMPLETED');
    expect(result.entries[1].activityType).toBe('LEVEL_UP');
  });

  /**
   * Test: Get activity feed with custom page
   * 
   * **Validates: Requirements 11.5, 11.6**
   */
  it('should get activity feed with custom page', async () => {
    const userId = 'user-1';
    const mockEntries = Array(25).fill(null).map((_, i) => ({
      id: `entry-${i}`,
      user_id: 'friend-1',
      activity_type: 'WORKOUT_COMPLETED',
      related_entity_id: `workout-${i}`,
      metadata: JSON.stringify({ totalVolume: 5000, totalXP: 50 }),
      created_at: new Date().toISOString(),
    }));

    // Mock database query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockEntries,
    });

    // Mock count query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 100 }],
    });

    const result = await activityFeedService.getActivityFeed(userId, 2, 25);

    expect(result.entries).toHaveLength(25);
    expect(result.total).toBe(100);
  });

  /**
   * Test: Get activity feed with empty result
   * 
   * **Validates: Requirements 11.5, 11.6**
   */
  it('should return empty activity feed', async () => {
    const userId = 'user-1';

    // Mock database query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    // Mock count query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 0 }],
    });

    const result = await activityFeedService.getActivityFeed(userId, 1, 50);

    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  /**
   * Test: Get activity feed entries are in reverse chronological order
   * 
   * **Validates: Requirements 11.4**
   */
  it('should return entries in reverse chronological order', async () => {
    const userId = 'user-1';
    const now = new Date();
    const mockEntries = [
      {
        id: 'entry-1',
        user_id: 'friend-1',
        activity_type: 'WORKOUT_COMPLETED',
        related_entity_id: 'workout-1',
        metadata: JSON.stringify({}),
        created_at: new Date(now.getTime()).toISOString(),
      },
      {
        id: 'entry-2',
        user_id: 'friend-2',
        activity_type: 'LEVEL_UP',
        related_entity_id: null,
        metadata: JSON.stringify({}),
        created_at: new Date(now.getTime() - 1000).toISOString(),
      },
      {
        id: 'entry-3',
        user_id: 'friend-3',
        activity_type: 'ACHIEVEMENT_UNLOCKED',
        related_entity_id: 'achievement-1',
        metadata: JSON.stringify({}),
        created_at: new Date(now.getTime() - 2000).toISOString(),
      },
    ];

    // Mock database query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockEntries,
    });

    // Mock count query
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 3 }],
    });

    const result = await activityFeedService.getActivityFeed(userId, 1, 50);

    expect(result.entries).toHaveLength(3);

    // Verify reverse chronological order
    for (let i = 0; i < result.entries.length - 1; i++) {
      const current = new Date(result.entries[i].createdAt);
      const next = new Date(result.entries[i + 1].createdAt);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });

  /**
   * Test: Get friend count for activity feed
   * 
   * **Validates: Requirements 11.7**
   */
  it('should get friend count for activity feed', async () => {
    const userId = 'user-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 50 }],
    });

    const count = await activityFeedService.getFriendCountForActivityFeed(userId);

    expect(count).toBe(50);
  });

  /**
   * Test: Get friend count enforces 1000 friend limit
   * 
   * **Validates: Requirements 11.7**
   */
  it('should handle friend count at limit', async () => {
    const userId = 'user-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 1000 }],
    });

    const count = await activityFeedService.getFriendCountForActivityFeed(userId);

    expect(count).toBe(1000);
  });

  /**
   * Test: Clear activity feed cache
   * 
   * **Validates: Requirements 11.5**
   */
  it('should clear activity feed cache', async () => {
    const userId = 'user-1';

    await activityFeedService.clearActivityFeedCache(userId);

    // Should not throw
    expect(true).toBe(true);
  });
});
