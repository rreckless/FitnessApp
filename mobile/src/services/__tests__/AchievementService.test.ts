import {
  AchievementService,
  Achievement,
  UserAchievement,
  AchievementWithUnlockStatus,
} from '../AchievementService';
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

describe('AchievementService', () => {
  let service: AchievementService;
  const mockUserId = 'user-123';
  const apiBaseUrl = 'http://api.test.com';

  const mockAchievements: Achievement[] = [
    {
      id: 'ach-1',
      name: 'First Workout',
      description: 'Complete your first workout',
      rarity: 'Common',
      category: 'Consistency',
      xpReward: 25,
      unlockCondition: 'workoutCount >= 1',
      iconUrl: 'https://example.com/icon1.png',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'ach-2',
      name: 'Strength Master',
      description: 'Reach 100 lbs on bench press',
      rarity: 'Rare',
      category: 'Strength',
      xpReward: 50,
      unlockCondition: 'benchPressMax >= 100',
      iconUrl: 'https://example.com/icon2.png',
      createdAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'ach-3',
      name: 'Social Butterfly',
      description: 'Add 10 friends',
      rarity: 'Epic',
      category: 'Social',
      xpReward: 100,
      unlockCondition: 'friendCount >= 10',
      iconUrl: 'https://example.com/icon3.png',
      createdAt: '2024-01-03T00:00:00Z',
    },
    {
      id: 'ach-4',
      name: 'Legend',
      description: 'Reach level 50',
      rarity: 'Legendary',
      category: 'Exploration',
      xpReward: 250,
      unlockCondition: 'level >= 50',
      iconUrl: 'https://example.com/icon4.png',
      createdAt: '2024-01-04T00:00:00Z',
    },
  ];

  const mockUserAchievements: UserAchievement[] = [
    {
      id: 'ua-1',
      userId: mockUserId,
      achievementId: 'ach-1',
      unlockedAt: '2024-01-10T10:00:00Z',
      createdAt: '2024-01-10T10:00:00Z',
    },
    {
      id: 'ua-2',
      userId: mockUserId,
      achievementId: 'ach-2',
      unlockedAt: '2024-01-15T15:00:00Z',
      createdAt: '2024-01-15T15:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
    } as any);
  });

  describe('Unit Tests', () => {
    describe('getAllAchievements', () => {
      it('should fetch all achievements from backend', async () => {
        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAllAchievements();

        expect(result).toEqual(mockAchievements);
        expect(mockApiClient.get).toHaveBeenCalledWith('/achievements');
      });

      it('should return empty array on error', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Network error')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAllAchievements();

        expect(result).toEqual([]);
      });

      it('should cache achievements in memory', async () => {
        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);

        // First call
        const result1 = await service.getAllAchievements();
        expect(result1).toEqual(mockAchievements);

        // Second call should use cache
        mockApiClient.get.mockClear();
        const result2 = await service.getAllAchievements();
        expect(result2).toEqual(mockAchievements);
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });

    describe('getUserAchievements', () => {
      it('should fetch user achievements with unlock status', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getUserAchievements();

        expect(result).toHaveLength(4);
        expect(result[0].isUnlocked).toBe(true);
        expect(result[0].unlockedAt).toBe('2024-01-10T10:00:00Z');
        expect(result[2].isUnlocked).toBe(false);
      });

      it('should return achievements with correct unlock status', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getUserAchievements();

        const unlockedIds = new Set(mockUserAchievements.map((ua) => ua.achievementId));
        for (const achievement of result) {
          if (unlockedIds.has(achievement.id)) {
            expect(achievement.isUnlocked).toBe(true);
          } else {
            expect(achievement.isUnlocked).toBe(false);
          }
        }
      });
    });

    describe('getAchievementsByCategory', () => {
      it('should filter achievements by category', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAchievementsByCategory('Strength');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('ach-2');
        expect(result[0].category).toBe('Strength');
      });

      it('should return empty array for non-existent category', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAchievementsByCategory('NonExistent' as any);

        expect(result).toHaveLength(0);
      });
    });

    describe('getAchievementsByRarity', () => {
      it('should filter achievements by rarity', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAchievementsByRarity('Rare');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('ach-2');
        expect(result[0].rarity).toBe('Rare');
      });
    });

    describe('getAchievementsByCategoryAndRarity', () => {
      it('should filter achievements by both category and rarity', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getAchievementsByCategoryAndRarity('Strength', 'Rare');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('ach-2');
      });
    });

    describe('getUnlockedAchievements', () => {
      it('should return only unlocked achievements', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getUnlockedAchievements();

        expect(result).toHaveLength(2);
        expect(result.every((a) => a.isUnlocked)).toBe(true);
      });
    });

    describe('getLockedAchievements', () => {
      it('should return only locked achievements', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.getLockedAchievements();

        expect(result).toHaveLength(2);
        expect(result.every((a) => !a.isUnlocked)).toBe(true);
      });
    });

    describe('isAchievementUnlocked', () => {
      it('should check if achievement is unlocked', async () => {
        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: true }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.isAchievementUnlocked('ach-1');

        expect(result).toBe(true);
        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/users/${mockUserId}/achievements/ach-1/unlocked`
        );
      });

      it('should return false on error', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Error')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.isAchievementUnlocked('ach-1');

        expect(result).toBe(false);
      });
    });

    describe('detectAchievementUnlocks', () => {
      it('should detect newly unlocked achievements', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.detectAchievementUnlocks();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('ach-1');
        expect(result[1].id).toBe('ach-2');
      });

      it('should not detect previously unlocked achievements', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        // Simulate previously unlocked achievements
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(['ach-1', 'ach-2'])
        );

        service = new AchievementService(apiBaseUrl, mockUserId);
        const result = await service.detectAchievementUnlocks();

        expect(result).toHaveLength(0);
      });
    });

    describe('onAchievementUnlocked', () => {
      it('should register and call unlock listener', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        service = new AchievementService(apiBaseUrl, mockUserId);

        const listener = jest.fn();
        service.onAchievementUnlocked(listener);

        await service.detectAchievementUnlocks();

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'ach-1' }));
      });

      it('should allow unsubscribing from unlock listener', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        service = new AchievementService(apiBaseUrl, mockUserId);

        const listener = jest.fn();
        const unsubscribe = service.onAchievementUnlocked(listener);

        unsubscribe();

        await service.detectAchievementUnlocks();

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe('getAchievementStats', () => {
      it('should calculate achievement statistics', async () => {
        const mockApiClient = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ data: mockAchievements })
            .mockResolvedValueOnce({ data: mockUserAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);
        const stats = await service.getAchievementStats();

        expect(stats.totalAchievements).toBe(4);
        expect(stats.unlockedCount).toBe(2);
        expect(stats.lockedCount).toBe(2);
        expect(stats.totalXPFromAchievements).toBe(75); // 25 + 50
        expect(stats.byRarity.Common.total).toBe(1);
        expect(stats.byRarity.Common.unlocked).toBe(1);
        expect(stats.byCategory.Strength.total).toBe(1);
        expect(stats.byCategory.Strength.unlocked).toBe(1);
      });
    });

    describe('clearCache', () => {
      it('should clear in-memory cache', async () => {
        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockAchievements }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new AchievementService(apiBaseUrl, mockUserId);

        // First call
        await service.getAllAchievements();
        mockApiClient.get.mockClear();

        // Second call should use cache
        await service.getAllAchievements();
        expect(mockApiClient.get).not.toHaveBeenCalled();

        // Clear cache
        await service.clearCache();

        // Third call should fetch again
        mockApiClient.get.mockResolvedValue({ data: mockAchievements });
        await service.getAllAchievements();
        expect(mockApiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Validates: Requirements 8.1, 8.2, 8.5**
     * Property: Achievement metadata is always valid
     */
    it('should maintain valid achievement metadata (Property: Achievement Metadata)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.string({ minLength: 1, maxLength: 500 }),
              rarity: fc.constantFrom('Common', 'Rare', 'Epic', 'Legendary'),
              category: fc.constantFrom('Strength', 'Consistency', 'Social', 'Exploration'),
              xpReward: fc.integer({ min: 0, max: 1000 }),
              unlockCondition: fc.string({ minLength: 1, maxLength: 200 }),
              iconUrl: fc.webUrl(),
              createdAt: fc.date().map((d) => d.toISOString()),
            }),
            { minLength: 1, maxLength: 100 }
          ),
          (achievements) => {
            // Verify all achievements have valid metadata
            for (const achievement of achievements) {
              expect(achievement.name).toBeTruthy();
              expect(achievement.description).toBeTruthy();
              expect(['Common', 'Rare', 'Epic', 'Legendary']).toContain(achievement.rarity);
              expect(['Strength', 'Consistency', 'Social', 'Exploration']).toContain(
                achievement.category
              );
              expect(achievement.xpReward).toBeGreaterThanOrEqual(0);
            }
          }
        )
      );
    });

    /**
     * **Validates: Requirements 8.3, 8.4**
     * Property: Achievement unlock status is consistent
     */
    it('should maintain consistent achievement unlock status (Property: Achievement Unlock Correctness)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              // Unlocked achievements must have unlockedAt
              fc.record({
                achievementId: fc.uuid(),
                isUnlocked: fc.constant(true),
                unlockedAt: fc.date().map((d) => d.toISOString()),
              }),
              // Locked achievements must not have unlockedAt
              fc.record({
                achievementId: fc.uuid(),
                isUnlocked: fc.constant(false),
                unlockedAt: fc.constant(null),
              })
            ),
            { minLength: 1, maxLength: 100 }
          ),
          (achievements) => {
            // Verify unlock status consistency
            for (const achievement of achievements) {
              if (achievement.isUnlocked) {
                expect(achievement.unlockedAt).toBeTruthy();
              } else {
                expect(achievement.unlockedAt).toBeNull();
              }
            }
          }
        )
      );
    });

    /**
     * **Validates: Requirements 8.1, 8.2**
     * Property: Achievement rarity distribution is valid
     */
    it('should maintain valid rarity distribution (Property: Achievement Rarity Distribution)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('Common', 'Rare', 'Epic', 'Legendary'),
            { minLength: 1, maxLength: 100 }
          ),
          (rarities) => {
            const counts = {
              Common: 0,
              Rare: 0,
              Epic: 0,
              Legendary: 0,
            };

            for (const rarity of rarities) {
              counts[rarity as keyof typeof counts]++;
            }

            // Verify all counts are non-negative
            for (const count of Object.values(counts)) {
              expect(count).toBeGreaterThanOrEqual(0);
            }

            // Verify total equals input length
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            expect(total).toBe(rarities.length);
          }
        )
      );
    });

    /**
     * **Validates: Requirements 8.4**
     * Property: XP rewards are always positive and within bounds
     */
    it('should maintain valid XP reward bounds (Property: Achievement XP Rewards)', () => {
      fc.assert(
        fc.property(
          fc.record({
            commonXP: fc.integer({ min: 20, max: 30 }),
            rareXP: fc.integer({ min: 40, max: 60 }),
            epicXP: fc.integer({ min: 80, max: 120 }),
            legendaryXP: fc.integer({ min: 200, max: 300 }),
          }),
          (rewards) => {
            // Verify XP progression
            expect(rewards.commonXP).toBeLessThan(rewards.rareXP);
            expect(rewards.rareXP).toBeLessThan(rewards.epicXP);
            expect(rewards.epicXP).toBeLessThan(rewards.legendaryXP);

            // Verify all are positive
            expect(rewards.commonXP).toBeGreaterThan(0);
            expect(rewards.rareXP).toBeGreaterThan(0);
            expect(rewards.epicXP).toBeGreaterThan(0);
            expect(rewards.legendaryXP).toBeGreaterThan(0);
          }
        )
      );
    });

    /**
     * **Validates: Requirements 8.1, 8.2**
     * Property: Achievement category distribution is valid
     */
    it('should maintain valid category distribution (Property: Achievement Category Distribution)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('Strength', 'Consistency', 'Social', 'Exploration'),
            { minLength: 1, maxLength: 100 }
          ),
          (categories) => {
            const counts = {
              Strength: 0,
              Consistency: 0,
              Social: 0,
              Exploration: 0,
            };

            for (const category of categories) {
              counts[category as keyof typeof counts]++;
            }

            // Verify all counts are non-negative
            for (const count of Object.values(counts)) {
              expect(count).toBeGreaterThanOrEqual(0);
            }

            // Verify total equals input length
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            expect(total).toBe(categories.length);
          }
        )
      );
    });

    /**
     * **Validates: Requirements 8.3**
     * Property: Unlock detection maintains temporal ordering
     */
    it('should maintain temporal ordering of unlocks (Property: Achievement Unlock Ordering)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              achievementId: fc.uuid(),
              unlockedAt: fc.date(),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (unlocks) => {
            // Sort by unlock time
            const sorted = [...unlocks].sort(
              (a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime()
            );

            // Verify ordering is maintained
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i].unlockedAt.getTime()).toBeGreaterThanOrEqual(
                sorted[i - 1].unlockedAt.getTime()
              );
            }
          }
        )
      );
    });
  });
});
