import request from 'supertest';
import express from 'express';
import activityFeedRoutes from '../activityFeedRoutes';
import * as activityFeedService from '../../services/activityFeedService';

// Mock dependencies
jest.mock('../../services/activityFeedService');
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

// Mock auth middleware
const mockVerifyToken = (req: any, _res: any, next: any) => {
  req.userId = 'test-user-id';
  next();
};

// Create test app
const app = express();
app.use(express.json());
app.use((req: any, res: any, next: any) => mockVerifyToken(req, res, next));
app.use('/activity-feed', activityFeedRoutes);

describe('Activity Feed Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - GET /activity-feed

  /**
   * Test: Get activity feed with default pagination
   * 
   * **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6**
   */
  it('should get activity feed with default pagination', async () => {
    const mockEntries = [
      {
        id: 'entry-1',
        userId: 'test-user-id',
        activityType: 'WORKOUT_COMPLETED',
        relatedEntityId: 'workout-1',
        metadata: { totalVolume: 5000, totalXP: 50 },
        createdAt: new Date(),
      },
      {
        id: 'entry-2',
        userId: 'friend-id',
        activityType: 'LEVEL_UP',
        relatedEntityId: null,
        metadata: { newLevel: 5 },
        createdAt: new Date(),
      },
    ];

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 2,
    });

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(2);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.pageSize).toBe(50);
    expect(response.body.pagination.total).toBe(2);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith('test-user-id', 1, 50);
  });

  /**
   * Test: Get activity feed with custom pagination
   * 
   * **Validates: Requirements 11.5, 11.6**
   */
  it('should get activity feed with custom pagination', async () => {
    const mockEntries = Array(25).fill(null).map((_, i) => ({
      id: `entry-${i}`,
      userId: 'friend-id',
      activityType: 'WORKOUT_COMPLETED',
      relatedEntityId: `workout-${i}`,
      metadata: { totalVolume: 5000, totalXP: 50 },
      createdAt: new Date(),
    }));

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 100,
    });

    const response = await request(app)
      .get('/activity-feed')
      .query({ page: 2, pageSize: 25 });

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(25);
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.pagination.pageSize).toBe(25);
    expect(response.body.pagination.total).toBe(100);
    expect(response.body.pagination.totalPages).toBe(4);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith('test-user-id', 2, 25);
  });

  /**
   * Test: Get activity feed with max page size limit
   * 
   * **Validates: Requirements 11.5, 11.6**
   */
  it('should limit page size to 100', async () => {
    const mockEntries = Array(100).fill(null).map((_, i) => ({
      id: `entry-${i}`,
      userId: 'friend-id',
      activityType: 'WORKOUT_COMPLETED',
      relatedEntityId: `workout-${i}`,
      metadata: { totalVolume: 5000, totalXP: 50 },
      createdAt: new Date(),
    }));

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 500,
    });

    const response = await request(app)
      .get('/activity-feed')
      .query({ pageSize: 200 }); // Request 200, should be limited to 100

    expect(response.status).toBe(200);
    expect(response.body.pagination.pageSize).toBe(100);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith('test-user-id', 1, 100);
  });

  /**
   * Test: Get activity feed with empty result
   * 
   * **Validates: Requirements 11.1, 11.5**
   */
  it('should return empty activity feed', async () => {
    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: [],
      total: 0,
    });

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(0);
    expect(response.body.pagination.total).toBe(0);
    expect(response.body.pagination.totalPages).toBe(0);
  });

  /**
   * Test: Get activity feed with various activity types
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('should return activity feed with various activity types', async () => {
    const mockEntries = [
      {
        id: 'entry-1',
        userId: 'friend-1',
        activityType: 'WORKOUT_COMPLETED',
        relatedEntityId: 'workout-1',
        metadata: { totalVolume: 5000, totalXP: 50 },
        createdAt: new Date(),
      },
      {
        id: 'entry-2',
        userId: 'friend-2',
        activityType: 'LEVEL_UP',
        relatedEntityId: null,
        metadata: { newLevel: 5 },
        createdAt: new Date(),
      },
      {
        id: 'entry-3',
        userId: 'friend-3',
        activityType: 'ACHIEVEMENT_UNLOCKED',
        relatedEntityId: 'achievement-1',
        metadata: { achievementName: 'First Workout' },
        createdAt: new Date(),
      },
      {
        id: 'entry-4',
        userId: 'friend-4',
        activityType: 'STREAK_MILESTONE',
        relatedEntityId: null,
        metadata: { streakDays: 7 },
        createdAt: new Date(),
      },
      {
        id: 'entry-5',
        userId: 'friend-5',
        activityType: 'FRIEND_ADDED',
        relatedEntityId: 'user-1',
        metadata: { friendName: 'John Doe' },
        createdAt: new Date(),
      },
    ];

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 5,
    });

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(5);

    // Verify all activity types are present
    const activityTypes = response.body.entries.map((e: any) => e.activityType);
    expect(activityTypes).toContain('WORKOUT_COMPLETED');
    expect(activityTypes).toContain('LEVEL_UP');
    expect(activityTypes).toContain('ACHIEVEMENT_UNLOCKED');
    expect(activityTypes).toContain('STREAK_MILESTONE');
    expect(activityTypes).toContain('FRIEND_ADDED');
  });

  /**
   * Test: Get activity feed with metadata
   * 
   * **Validates: Requirements 11.2**
   */
  it('should return activity feed entries with metadata', async () => {
    const mockEntries = [
      {
        id: 'entry-1',
        userId: 'friend-1',
        activityType: 'WORKOUT_COMPLETED',
        relatedEntityId: 'workout-1',
        metadata: {
          totalVolume: 5000,
          totalXP: 50,
          exerciseCount: 5,
        },
        createdAt: new Date(),
      },
    ];

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 1,
    });

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(200);
    expect(response.body.entries[0].metadata).toEqual({
      totalVolume: 5000,
      totalXP: 50,
      exerciseCount: 5,
    });
  });

  /**
   * Test: Get activity feed handles service error
   * 
   * **Validates: Requirements 11.1**
   */
  it('should handle service error', async () => {
    (activityFeedService.getActivityFeed as jest.Mock).mockRejectedValueOnce(
      new Error('Database error')
    );

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to fetch activity feed');
  });

  /**
   * Test: Get activity feed with page 0 should default to page 1
   * 
   * **Validates: Requirements 11.5**
   */
  it('should default to page 1 if page is 0', async () => {
    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: [],
      total: 0,
    });

    const response = await request(app)
      .get('/activity-feed')
      .query({ page: 0 });

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith('test-user-id', 1, 50);
  });

  /**
   * Test: Get activity feed with negative page size should default to 1
   * 
   * **Validates: Requirements 11.5**
   */
  it('should default to pageSize 1 if pageSize is negative', async () => {
    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: [],
      total: 0,
    });

    const response = await request(app)
      .get('/activity-feed')
      .query({ pageSize: -10 });

    expect(response.status).toBe(200);
    expect(response.body.pagination.pageSize).toBe(1);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith('test-user-id', 1, 1);
  });

  /**
   * Test: Get activity feed returns correct pagination info
   * 
   * **Validates: Requirements 11.5, 11.6**
   */
  it('should return correct pagination info', async () => {
    const mockEntries = Array(50).fill(null).map((_, i) => ({
      id: `entry-${i}`,
      userId: 'friend-id',
      activityType: 'WORKOUT_COMPLETED',
      relatedEntityId: `workout-${i}`,
      metadata: {},
      createdAt: new Date(),
    }));

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 250,
    });

    const response = await request(app)
      .get('/activity-feed')
      .query({ page: 3, pageSize: 50 });

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 3,
      pageSize: 50,
      total: 250,
      totalPages: 5,
    });
  });

  /**
   * Test: Get activity feed entries are in reverse chronological order
   * 
   * **Validates: Requirements 11.4**
   */
  it('should return entries in reverse chronological order', async () => {
    const now = new Date();
    const mockEntries = [
      {
        id: 'entry-1',
        userId: 'friend-1',
        activityType: 'WORKOUT_COMPLETED',
        relatedEntityId: 'workout-1',
        metadata: {},
        createdAt: new Date(now.getTime()),
      },
      {
        id: 'entry-2',
        userId: 'friend-2',
        activityType: 'LEVEL_UP',
        relatedEntityId: null,
        metadata: {},
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        id: 'entry-3',
        userId: 'friend-3',
        activityType: 'ACHIEVEMENT_UNLOCKED',
        relatedEntityId: 'achievement-1',
        metadata: {},
        createdAt: new Date(now.getTime() - 2000),
      },
    ];

    (activityFeedService.getActivityFeed as jest.Mock).mockResolvedValueOnce({
      entries: mockEntries,
      total: 3,
    });

    const response = await request(app).get('/activity-feed');

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(3);

    // Verify reverse chronological order
    for (let i = 0; i < response.body.entries.length - 1; i++) {
      const current = new Date(response.body.entries[i].createdAt);
      const next = new Date(response.body.entries[i + 1].createdAt);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });
});
