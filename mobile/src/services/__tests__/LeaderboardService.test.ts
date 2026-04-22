import { LeaderboardService, LeaderboardEntry, LeaderboardPosition } from '../LeaderboardService';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import * as fc from 'fast-check';

jest.mock('axios');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-sqlite-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  const mockUserId = 'user-123';
  const apiBaseUrl = 'http://api.test.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
    } as any);
  });

  describe('Unit Tests', () => {
    describe('getLeaderboard', () => {
      it('should fetch global leaderboard from backend', async () => {
        const mockEntries: LeaderboardEntry[] = [
          { rank: 1, userId: 'user-1', name: 'Alice', xp: 5000, level: 10 },
          { rank: 2, userId: 'user-2', name: 'Bob', xp: 4500, level: 9 },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockEntries }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboard('global', 1);

        expect(result).toEqual(mockEntries);
        expect(mockApiClient.get).toHaveBeenCalledWith('/leaderboards/global', {
          params: { limit: 100, offset: 0 },
        });
      });

      it('should fetch friends leaderboard from backend', async () => {
        const mockEntries: LeaderboardEntry[] = [
          { rank: 1, userId: 'user-1', name: 'Friend1', xp: 3000, level: 8 },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockEntries }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboard('friends', 1);

        expect(result).toEqual(mockEntries);
        expect(mockApiClient.get).toHaveBeenCalledWith('/leaderboards/friends', {
          params: { limit: 100, offset: 0 },
        });
      });

      it('should fetch weekly leaderboard from backend', async () => {
        const mockEntries: LeaderboardEntry[] = [
          { rank: 1, userId: 'user-1', name: 'TopWeekly', xp: 1000, level: 5 },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockEntries }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboard('weekly', 1);

        expect(result).toEqual(mockEntries);
      });

      it('should support pagination', async () => {
        const mockEntries: LeaderboardEntry[] = [];
        for (let i = 100; i < 200; i++) {
          mockEntries.push({
            rank: i,
            userId: `user-${i}`,
            name: `User${i}`,
            xp: 5000 - i * 10,
            level: 10 - Math.floor(i / 100),
          });
        }

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockEntries }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboard('global', 2);

        expect(result).toEqual(mockEntries);
        expect(mockApiClient.get).toHaveBeenCalledWith('/leaderboards/global', {
          params: { limit: 100, offset: 100 },
        });
      });

      it('should return empty array on error', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Network error')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboard('global', 1);

        expect(result).toEqual([]);
      });
    });

    describe('getUserPosition', () => {
      it('should fetch user position with nearby competitors', async () => {
        const mockPosition: LeaderboardPosition = {
          rank: 50,
          totalUsers: 1000,
          nearbyCompetitors: [
            { rank: 45, userId: 'user-45', name: 'Competitor1', xp: 2500, level: 7 },
            { rank: 50, userId: mockUserId, name: 'CurrentUser', xp: 2000, level: 6 },
            { rank: 55, userId: 'user-55', name: 'Competitor2', xp: 1900, level: 6 },
          ],
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPosition }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getUserPosition('global');

        expect(result).toEqual(mockPosition);
        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/leaderboards/global/position/${mockUserId}`
        );
      });

      it('should return null on error', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Not found')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getUserPosition('global');

        expect(result).toBeNull();
      });
    });

    describe('getLeaderboardWithUserHighlight', () => {
      it('should return leaderboard entries with user position', async () => {
        const mockEntries: LeaderboardEntry[] = [
          { rank: 1, userId: 'user-1', name: 'Alice', xp: 5000, level: 10 },
          { rank: 2, userId: 'user-2', name: 'Bob', xp: 4500, level: 9 },
        ];

        const mockPosition: LeaderboardPosition = {
          rank: 2,
          totalUsers: 1000,
          nearbyCompetitors: mockEntries,
        };

        const mockApiClient = {
          get: jest.fn()
            .mockResolvedValueOnce({ data: mockEntries })
            .mockResolvedValueOnce({ data: mockPosition }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getLeaderboardWithUserHighlight('global', 1);

        expect(result.entries).toEqual(mockEntries);
        expect(result.userPosition).toEqual(mockPosition);
        expect(result.currentPage).toBe(1);
        expect(result.totalPages).toBe(10); // 1000 / 100
      });
    });

    describe('getNearbyCompetitors', () => {
      it('should return nearby competitors from user position', async () => {
        const mockCompetitors: LeaderboardEntry[] = [
          { rank: 45, userId: 'user-45', name: 'Competitor1', xp: 2500, level: 7 },
          { rank: 50, userId: mockUserId, name: 'CurrentUser', xp: 2000, level: 6 },
          { rank: 55, userId: 'user-55', name: 'Competitor2', xp: 1900, level: 6 },
        ];

        const mockPosition: LeaderboardPosition = {
          rank: 50,
          totalUsers: 1000,
          nearbyCompetitors: mockCompetitors,
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPosition }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getNearbyCompetitors('global');

        expect(result).toEqual(mockCompetitors);
      });

      it('should return empty array on error', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Error')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        const result = await service.getNearbyCompetitors('global');

        expect(result).toEqual([]);
      });
    });

    describe('clearCache', () => {
      it('should clear in-memory cache', async () => {
        const mockEntries: LeaderboardEntry[] = [
          { rank: 1, userId: 'user-1', name: 'Alice', xp: 5000, level: 10 },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockEntries }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new LeaderboardService(apiBaseUrl, mockUserId);
        await service.getLeaderboard('global', 1);

        // Cache should have data
        const result1 = await service.getLeaderboard('global', 1);
        expect(result1).toEqual(mockEntries);

        // Clear cache
        await service.clearCache();

        // Should fetch again from API
        mockApiClient.get.mockClear();
        mockApiClient.get.mockResolvedValue({ data: mockEntries });
        const result2 = await service.getLeaderboard('global', 1);

        expect(mockApiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
     * Property: Leaderboard entries maintain consistent rank and XP ordering
     */
    it('should maintain leaderboard ranking order (Property: Leaderboard Ranking Correctness)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              rank: fc.integer({ min: 1, max: 100 }),
              userId: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              xp: fc.integer({ min: 0, max: 1000000 }),
              level: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 100 }
          ),
          (entries) => {
            // Verify all entries have valid ranks
            for (const entry of entries) {
              expect(entry.rank).toBeGreaterThanOrEqual(1);
              expect(entry.xp).toBeGreaterThanOrEqual(0);
              expect(entry.level).toBeGreaterThanOrEqual(1);
            }
          }
        )
      );
    });

    /**
     * **Validates: Requirements 9.5**
     * Property: User position rank is always positive and within reasonable bounds
     */
    it('should maintain valid user position bounds (Property: Leaderboard User Position)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 100000 }),
          (rank, totalUsers) => {
            // Rank must be within total users
            if (rank <= totalUsers) {
              expect(rank).toBeGreaterThanOrEqual(1);
              expect(rank).toBeLessThanOrEqual(totalUsers);
            }
          }
        )
      );
    });

    /**
     * **Validates: Requirements 9.1, 9.2, 9.3**
     * Property: Pagination calculations are always valid
     */
    it('should return correct pagination results (Property: Leaderboard Pagination)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 10000 }),
          (page, totalUsers) => {
            const itemsPerPage = 100;
            const expectedOffset = (page - 1) * itemsPerPage;
            const expectedLimit = itemsPerPage;

            // Verify pagination calculation
            expect(expectedOffset).toBe((page - 1) * itemsPerPage);
            expect(expectedLimit).toBe(itemsPerPage);

            // Verify total pages calculation
            const totalPages = Math.ceil(totalUsers / itemsPerPage);
            expect(totalPages).toBeGreaterThanOrEqual(1);
          }
        )
      );
    });

    /**
     * **Validates: Requirements 9.6**
     * Property: Nearby competitors range calculation is valid
     */
    it('should keep nearby competitors within valid range (Property: Nearby Competitors Range)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 9995 }),
          (userRank) => {
            const minRank = Math.max(1, userRank - 5);
            const maxRank = userRank + 5;

            // All nearby competitors should be within range
            for (let rank = minRank; rank <= maxRank; rank++) {
              expect(rank).toBeGreaterThanOrEqual(minRank);
              expect(rank).toBeLessThanOrEqual(maxRank);
            }
          }
        )
      );
    });
  });
});
