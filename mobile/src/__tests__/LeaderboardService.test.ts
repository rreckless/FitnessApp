import LeaderboardService, {
  LeaderboardEntry,
  UserPosition,
  NearbyCompetitors,
  LeaderboardError,
} from '../services/LeaderboardService';
import DatabaseManager from '@database/DatabaseManager';
import { mockAxiosGet } from './setup';

jest.mock('@database/DatabaseManager');
jest.mock('axios');
jest.mock('../services/SyncEngine');

describe('LeaderboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
  });

  describe('getGlobalLeaderboard', () => {
    it('should fetch global leaderboard with pagination', async () => {
      const mockEntries: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'user1',
          name: 'Player One',
          level: 10,
          totalXP: 5000,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { entries: mockEntries } });

      const result = await LeaderboardService.getGlobalLeaderboard(100, 0);

      expect(result).toEqual(mockEntries);
    });

    it('should throw error on invalid limit', async () => {
      await expect(LeaderboardService.getGlobalLeaderboard(2000, 0)).rejects.toThrow(
        LeaderboardError
      );
    });

    it('should throw error on negative offset', async () => {
      await expect(LeaderboardService.getGlobalLeaderboard(100, -1)).rejects.toThrow(
        LeaderboardError
      );
    });
  });

  describe('getFriendsLeaderboard', () => {
    it('should fetch friends leaderboard with pagination', async () => {
      const mockEntries: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'friend1',
          name: 'Friend One',
          level: 8,
          totalXP: 3500,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { entries: mockEntries } });

      const result = await LeaderboardService.getFriendsLeaderboard(100, 0);

      expect(result).toEqual(mockEntries);
    });
  });

  describe('getWeeklyLeaderboard', () => {
    it('should fetch weekly leaderboard with pagination', async () => {
      const mockEntries: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'user1',
          name: 'Weekly Leader',
          level: 5,
          totalXP: 1000,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { entries: mockEntries } });

      const result = await LeaderboardService.getWeeklyLeaderboard(100, 0);

      expect(result).toEqual(mockEntries);
    });
  });

  describe('getUserPosition', () => {
    it('should fetch user position on leaderboard', async () => {
      const mockPosition: UserPosition = {
        rank: 42,
        userId: 'user1',
        totalXP: 2500,
      };

      mockAxiosGet.mockResolvedValueOnce({ data: mockPosition });

      const result = await LeaderboardService.getUserPosition('user1', 'global');

      expect(result).toEqual(mockPosition);
    });

    it('should throw error for invalid leaderboard type', async () => {
      await expect(
        LeaderboardService.getUserPosition('user1', 'invalid' as any)
      ).rejects.toThrow(LeaderboardError);
    });
  });

  describe('getNearbyCompetitors', () => {
    it('should fetch nearby competitors', async () => {
      const mockNearby: NearbyCompetitors = {
        userPosition: {
          rank: 42,
          userId: 'user1',
          totalXP: 2500,
        },
        nearby: [
          {
            rank: 40,
            userId: 'user40',
            name: 'Competitor 40',
            level: 7,
            totalXP: 2600,
          },
        ],
      };

      mockAxiosGet.mockResolvedValueOnce({ data: mockNearby });

      const result = await LeaderboardService.getNearbyCompetitors('user1', 'global');

      expect(result.userPosition).toEqual(mockNearby.userPosition);
      expect(result.nearby).toHaveLength(1);
    });
  });

  describe('refreshLeaderboard', () => {
    it('should refresh leaderboard cache', async () => {
      const mockEntries: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'user1',
          name: 'Player One',
          level: 10,
          totalXP: 5000,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { entries: mockEntries } });

      const result = await LeaderboardService.refreshLeaderboard('global', 0);

      expect(result).toEqual(mockEntries);
    });
  });

  describe('position highlighting', () => {
    it('should correctly identify user position in leaderboard', async () => {
      const mockEntries: LeaderboardEntry[] = [
        { rank: 1, userId: 'user1', name: 'Leader', level: 10, totalXP: 5000 },
        { rank: 2, userId: 'user2', name: 'Second', level: 9, totalXP: 4500 },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { entries: mockEntries } });

      const result = await LeaderboardService.getGlobalLeaderboard(100, 0);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });
  });

  describe('weekly reset logic', () => {
    it('should handle weekly leaderboard separately from global', async () => {
      const globalEntries: LeaderboardEntry[] = [
        { rank: 1, userId: 'user1', name: 'Global Leader', level: 10, totalXP: 5000 },
      ];

      const weeklyEntries: LeaderboardEntry[] = [
        { rank: 1, userId: 'user2', name: 'Weekly Leader', level: 5, totalXP: 500 },
      ];

      mockAxiosGet
        .mockResolvedValueOnce({ data: { entries: globalEntries } })
        .mockResolvedValueOnce({ data: { entries: weeklyEntries } });

      const global = await LeaderboardService.getGlobalLeaderboard(100, 0);
      const weekly = await LeaderboardService.getWeeklyLeaderboard(100, 0);

      expect(global[0].userId).toBe('user1');
      expect(weekly[0].userId).toBe('user2');
    });
  });
});
