import AchievementService from '@services/AchievementService';
import DatabaseManager from '@database/DatabaseManager';
import { AchievementError, AchievementErrorType } from '@types/index';

// Mock DatabaseManager
jest.mock('@database/DatabaseManager', () => ({
  executeSql: jest.fn(),
}));

describe('AchievementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - XP Reward Tests

  describe('XP Rewards', () => {
    it('should return 25 XP for COMMON rarity', () => {
      const reward = AchievementService.getXPRewardForRarity('COMMON');
      expect(reward).toBe(25);
    });

    it('should return 50 XP for RARE rarity', () => {
      const reward = AchievementService.getXPRewardForRarity('RARE');
      expect(reward).toBe(50);
    });

    it('should return 100 XP for EPIC rarity', () => {
      const reward = AchievementService.getXPRewardForRarity('EPIC');
      expect(reward).toBe(100);
    });

    it('should return 250 XP for LEGENDARY rarity', () => {
      const reward = AchievementService.getXPRewardForRarity('LEGENDARY');
      expect(reward).toBe(250);
    });

    it('should return 0 for invalid rarity', () => {
      const reward = AchievementService.getXPRewardForRarity('INVALID');
      expect(reward).toBe(0);
    });
  });

  // MARK: - Validation Tests

  describe('Validation', () => {
    it('should validate correct achievement data', () => {
      expect(() => {
        AchievementService.validateAchievementData(
          'First Workout',
          'COMMON',
          'CONSISTENCY',
          25
        );
      }).not.toThrow();
    });

    it('should throw for empty name', () => {
      expect(() => {
        AchievementService.validateAchievementData('', 'COMMON', 'CONSISTENCY', 25);
      }).toThrow();
    });

    it('should throw for invalid rarity', () => {
      expect(() => {
        AchievementService.validateAchievementData(
          'First Workout',
          'INVALID',
          'CONSISTENCY',
          25
        );
      }).toThrow();
    });

    it('should throw for invalid category', () => {
      expect(() => {
        AchievementService.validateAchievementData(
          'First Workout',
          'COMMON',
          'INVALID',
          25
        );
      }).toThrow();
    });

    it('should throw for negative XP reward', () => {
      expect(() => {
        AchievementService.validateAchievementData(
          'First Workout',
          'COMMON',
          'CONSISTENCY',
          -25
        );
      }).toThrow();
    });

    it('should throw for mismatched XP reward', () => {
      expect(() => {
        AchievementService.validateAchievementData(
          'First Workout',
          'COMMON',
          'CONSISTENCY',
          50 // Should be 25 for COMMON
        );
      }).toThrow();
    });
  });

  // MARK: - Metadata Tests

  describe('Metadata', () => {
    it('should return valid rarities', () => {
      const rarities = AchievementService.getValidRarities();
      expect(rarities).toContain('COMMON');
      expect(rarities).toContain('RARE');
      expect(rarities).toContain('EPIC');
      expect(rarities).toContain('LEGENDARY');
      expect(rarities.length).toBe(4);
    });

    it('should return valid categories', () => {
      const categories = AchievementService.getValidCategories();
      expect(categories).toContain('STRENGTH');
      expect(categories).toContain('CONSISTENCY');
      expect(categories).toContain('SOCIAL');
      expect(categories).toContain('EXPLORATION');
      expect(categories.length).toBe(4);
    });
  });

  // MARK: - Achievement Unlock Tests

  describe('Achievement Unlock', () => {
    it('should unlock achievement for first time', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      // Mock: achievement not yet unlocked
      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: { length: 0 },
        } as any)
        // Mock: get achievement details
        .mockResolvedValueOnce({
          rows: {
            length: 1,
            item: () => ({ xpReward: 25 }),
          },
        } as any)
        // Mock: insert user achievement
        .mockResolvedValueOnce({
          rows: { length: 1 },
        } as any);

      const result = await AchievementService.unlockAchievement(
        'user123',
        'achievement456'
      );

      expect(result.achieved).toBe(true);
      expect(result.xpReward).toBe(25);
    });

    it('should not unlock achievement twice', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      // Mock: achievement already unlocked
      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: { length: 1 },
      } as any);

      const result = await AchievementService.unlockAchievement(
        'user123',
        'achievement456'
      );

      expect(result.achieved).toBe(false);
      expect(result.xpReward).toBeUndefined();
    });

    it('should throw error if achievement not found', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      // Mock: achievement not yet unlocked
      mockDbManager.executeSql
        .mockResolvedValueOnce({
          rows: { length: 0 },
        } as any)
        // Mock: achievement not found
        .mockResolvedValueOnce({
          rows: { length: 0 },
        } as any);

      await expect(
        AchievementService.unlockAchievement('user123', 'achievement456')
      ).rejects.toThrow(AchievementError);
    });
  });

  // MARK: - Achievement Retrieval Tests

  describe('Achievement Retrieval', () => {
    it('should check if achievement is unlocked', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: { length: 1 },
      } as any);

      const result = await AchievementService.hasUnlockedAchievement(
        'user123',
        'achievement456'
      );

      expect(result).toBe(true);
    });

    it('should return false if achievement not unlocked', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: { length: 0 },
      } as any);

      const result = await AchievementService.hasUnlockedAchievement(
        'user123',
        'achievement456'
      );

      expect(result).toBe(false);
    });
  });

  // MARK: - Achievement Count Tests

  describe('Achievement Count', () => {
    it('should get achievement count by rarity', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      mockDbManager.executeSql.mockResolvedValueOnce({
        rows: {
          length: 2,
          item: (index: number) => {
            if (index === 0) return { rarity: 'COMMON', count: 5 };
            return { rarity: 'RARE', count: 2 };
          },
        },
      } as any);

      const result = await AchievementService.getAchievementCountByRarity('user123');

      expect(result.COMMON).toBe(5);
      expect(result.RARE).toBe(2);
      expect(result.EPIC).toBe(0);
      expect(result.LEGENDARY).toBe(0);
    });
  });

  // MARK: - Error Handling Tests

  describe('Error Handling', () => {
    it('should throw AchievementError on database error', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      mockDbManager.executeSql.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        AchievementService.hasUnlockedAchievement('user123', 'achievement456')
      ).rejects.toThrow(AchievementError);
    });

    it('should throw AchievementError with correct type', async () => {
      const mockDbManager = DatabaseManager as jest.Mocked<typeof DatabaseManager>;

      mockDbManager.executeSql.mockRejectedValueOnce(new Error('Database error'));

      try {
        await AchievementService.hasUnlockedAchievement('user123', 'achievement456');
      } catch (error) {
        expect(error).toBeInstanceOf(AchievementError);
        expect((error as AchievementError).type).toBe(AchievementErrorType.DatabaseError);
      }
    });
  });
});
