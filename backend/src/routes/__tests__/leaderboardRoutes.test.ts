import request from 'supertest';
import express from 'express';
import leaderboardRoutes from '../leaderboardRoutes';
import * as leaderboardService from '../../services/leaderboardService';

// Mock the leaderboard service
jest.mock('../../services/leaderboardService');
jest.mock('../../logging/logger');

// Mock the auth routes verifyToken
jest.mock('../authRoutes', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/leaderboards', leaderboardRoutes);

describe('Leaderboard Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /leaderboards/global', () => {
    it('should return global leaderboard with default pagination', async () => {
      const mockLeaderboard: any[] = [
        {
          rank: 1,
          userId: 'user-1',
          name: 'User 1',
          level: 10,
          xp: 5000,
          profilePictureUrl: 'url1',
        },
        {
          rank: 2,
          userId: 'user-2',
          name: 'User 2',
          level: 8,
          xp: 4000,
          profilePictureUrl: 'url2',
        },
      ];

      (leaderboardService.getGlobalLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app).get('/leaderboards/global');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('global');
      expect(response.body.limit).toBe(100);
      expect(response.body.offset).toBe(0);
      expect(response.body.entries).toEqual(mockLeaderboard);
    });

    it('should handle custom pagination parameters', async () => {
      const mockLeaderboard: any[] = [];

      (leaderboardService.getGlobalLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app)
        .get('/leaderboards/global')
        .query({ limit: 50, offset: 100 });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(100);
      expect(leaderboardService.getGlobalLeaderboard).toHaveBeenCalledWith(50, 100);
    });

    it('should cap limit at 1000', async () => {
      const mockLeaderboard: any[] = [];

      (leaderboardService.getGlobalLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app)
        .get('/leaderboards/global')
        .query({ limit: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(1000);
      expect(leaderboardService.getGlobalLeaderboard).toHaveBeenCalledWith(1000, 0);
    });

    it('should handle service errors', async () => {
      (leaderboardService.getGlobalLeaderboard as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app).get('/leaderboards/global');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch leaderboard');
    });
  });

  describe('GET /leaderboards/friends', () => {
    it('should return friends leaderboard', async () => {
      const mockLeaderboard: any[] = [
        {
          rank: 1,
          userId: 'friend-1',
          name: 'Friend 1',
          level: 9,
          xp: 4500,
          profilePictureUrl: 'url1',
        },
      ];

      (leaderboardService.getFriendsLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app).get('/leaderboards/friends');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('friends');
      expect(response.body.entries).toEqual(mockLeaderboard);
      expect(leaderboardService.getFriendsLeaderboard).toHaveBeenCalledWith('test-user-id', 100, 0);
    });

    it('should pass user ID to service', async () => {
      (leaderboardService.getFriendsLeaderboard as jest.Mock).mockResolvedValue([]);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      await request(app).get('/leaderboards/friends');

      expect(leaderboardService.getFriendsLeaderboard).toHaveBeenCalledWith('test-user-id', 100, 0);
    });
  });

  describe('GET /leaderboards/weekly', () => {
    it('should return weekly leaderboard', async () => {
      const mockLeaderboard: any[] = [
        {
          rank: 1,
          userId: 'user-1',
          name: 'User 1',
          level: 10,
          xp: 1000,
          profilePictureUrl: 'url1',
        },
      ];

      (leaderboardService.getWeeklyLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);
      (leaderboardService.validateLeaderboardParams as jest.Mock).mockReturnValue(undefined);

      const response = await request(app).get('/leaderboards/weekly');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('weekly');
      expect(response.body.entries).toEqual(mockLeaderboard);
      expect(leaderboardService.getWeeklyLeaderboard).toHaveBeenCalledWith(100, 0);
    });
  });

  describe('GET /leaderboards/:type/position/:userId', () => {
    it('should return user position on global leaderboard', async () => {
      const mockPosition = {
        rank: 5,
        userId: 'user-1',
        xp: 3000,
        level: 7,
      };

      const mockNearby = {
        userId: 'user-1',
        rank: 5,
        competitors: [
          { rank: 3, userId: 'user-3', xp: 3500, name: 'User 3' },
          { rank: 4, userId: 'user-4', xp: 3200, name: 'User 4' },
          { rank: 5, userId: 'user-1', xp: 3000, name: 'User 1' },
          { rank: 6, userId: 'user-6', xp: 2800, name: 'User 6' },
          { rank: 7, userId: 'user-7', xp: 2500, name: 'User 7' },
        ],
      };

      (leaderboardService.getUserRankPosition as jest.Mock).mockResolvedValue(mockPosition);
      (leaderboardService.getNearbyCompetitors as jest.Mock).mockResolvedValue(mockNearby);

      const response = await request(app).get('/leaderboards/global/position/user-1');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('global');
      expect(response.body.userId).toBe('user-1');
      expect(response.body.position).toEqual(mockPosition);
      expect(response.body.nearbyCompetitors).toEqual(mockNearby);
    });

    it('should return user position on friends leaderboard', async () => {
      const mockPosition = {
        rank: 2,
        userId: 'user-1',
        xp: 4500,
        level: 9,
      };

      const mockNearby = {
        userId: 'user-1',
        rank: 2,
        competitors: [
          { rank: 1, userId: 'friend-1', xp: 5000, name: 'Friend 1' },
          { rank: 2, userId: 'user-1', xp: 4500, name: 'User 1' },
          { rank: 3, userId: 'friend-3', xp: 4000, name: 'Friend 3' },
        ],
      };

      (leaderboardService.getUserRankPosition as jest.Mock).mockResolvedValue(mockPosition);
      (leaderboardService.getNearbyCompetitors as jest.Mock).mockResolvedValue(mockNearby);

      const response = await request(app).get('/leaderboards/friends/position/user-1');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('friends');
      expect(leaderboardService.getUserRankPosition).toHaveBeenCalledWith('user-1', 'friends');
    });

    it('should return user position on weekly leaderboard', async () => {
      const mockPosition = {
        rank: 10,
        userId: 'user-1',
        xp: 500,
        level: 7,
      };

      const mockNearby = {
        userId: 'user-1',
        rank: 10,
        competitors: [],
      };

      (leaderboardService.getUserRankPosition as jest.Mock).mockResolvedValue(mockPosition);
      (leaderboardService.getNearbyCompetitors as jest.Mock).mockResolvedValue(mockNearby);

      const response = await request(app).get('/leaderboards/weekly/position/user-1');

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('weekly');
      expect(leaderboardService.getUserRankPosition).toHaveBeenCalledWith('user-1', 'weekly');
    });

    it('should reject invalid leaderboard type', async () => {
      const response = await request(app).get('/leaderboards/invalid/position/user-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid leaderboard type');
    });

    it('should handle service errors', async () => {
      (leaderboardService.getUserRankPosition as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/leaderboards/global/position/user-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user position');
    });
  });
});
