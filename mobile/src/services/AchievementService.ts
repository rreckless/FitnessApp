import DatabaseManager from '@database/DatabaseManager';
import { AchievementData, AchievementError, AchievementErrorType } from '@types/index';

const RARITY_XP_REWARDS: Record<string, number> = {
  COMMON: 25,
  RARE: 50,
  EPIC: 100,
  LEGENDARY: 250,
};

export class AchievementService {
  private static instance: AchievementService;
  private dbManager = DatabaseManager;

  private constructor() {}

  static getInstance(): AchievementService {
    if (!AchievementService.instance) {
      AchievementService.instance = new AchievementService();
    }
    return AchievementService.instance;
  }

  /**
   * Get all achievements (locked and unlocked)
   */
  async getAllAchievements(userId: string): Promise<
    Array<AchievementData & { unlocked: boolean; unlockedAt?: string }>
  > {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT a.id, a.name, a.description, a.rarity, a.category, a.xpReward, 
                a.unlockedCondition, a.icon, a.createdAt, ua.unlockedAt
         FROM achievements a
         LEFT JOIN userAchievements ua ON a.id = ua.achievementId AND ua.userId = ?
         ORDER BY a.rarity DESC, a.name ASC`,
        [userId]
      );

      const achievements: Array<AchievementData & { unlocked: boolean; unlockedAt?: string }> = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        achievements.push({
          id: row.id,
          name: row.name,
          description: row.description,
          rarity: row.rarity,
          category: row.category,
          xpReward: row.xpReward,
          unlockedCondition: row.unlockedCondition,
          icon: row.icon,
          createdAt: row.createdAt,
          unlocked: !!row.unlockedAt,
          unlockedAt: row.unlockedAt,
        });
      }

      return achievements;
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to get all achievements: ${error}`
      );
    }
  }

  /**
   * Get unlocked achievements for a user
   */
  async getUnlockedAchievements(userId: string): Promise<AchievementData[]> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT a.id, a.name, a.description, a.rarity, a.category, a.xpReward, 
                a.unlockedCondition, a.icon, a.createdAt
         FROM achievements a
         JOIN userAchievements ua ON a.id = ua.achievementId
         WHERE ua.userId = ?
         ORDER BY ua.unlockedAt DESC`,
        [userId]
      );

      const achievements: AchievementData[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        achievements.push({
          id: row.id,
          name: row.name,
          description: row.description,
          rarity: row.rarity,
          category: row.category,
          xpReward: row.xpReward,
          unlockedCondition: row.unlockedCondition,
          icon: row.icon,
          createdAt: row.createdAt,
        });
      }

      return achievements;
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to get unlocked achievements: ${error}`
      );
    }
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(
    userId: string,
    category: string
  ): Promise<Array<AchievementData & { unlocked: boolean }>> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT a.id, a.name, a.description, a.rarity, a.category, a.xpReward, 
                a.unlockedCondition, a.icon, a.createdAt, ua.unlockedAt
         FROM achievements a
         LEFT JOIN userAchievements ua ON a.id = ua.achievementId AND ua.userId = ?
         WHERE a.category = ?
         ORDER BY a.rarity DESC, a.name ASC`,
        [userId, category]
      );

      const achievements: Array<AchievementData & { unlocked: boolean }> = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        achievements.push({
          id: row.id,
          name: row.name,
          description: row.description,
          rarity: row.rarity,
          category: row.category,
          xpReward: row.xpReward,
          unlockedCondition: row.unlockedCondition,
          icon: row.icon,
          createdAt: row.createdAt,
          unlocked: !!row.unlockedAt,
        });
      }

      return achievements;
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to get achievements by category: ${error}`
      );
    }
  }

  /**
   * Check if user has unlocked an achievement
   */
  async hasUnlockedAchievement(userId: string, achievementId: string): Promise<boolean> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id FROM userAchievements
         WHERE userId = ? AND achievementId = ?`,
        [userId, achievementId]
      );

      return result.rows.length > 0;
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to check if achievement unlocked: ${error}`
      );
    }
  }

  /**
   * Unlock an achievement for a user
   */
  async unlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<{ achieved: boolean; xpReward?: number }> {
    try {
      // Check if already unlocked
      const alreadyUnlocked = await this.hasUnlockedAchievement(userId, achievementId);

      if (alreadyUnlocked) {
        return { achieved: false };
      }

      // Get achievement details
      const achievementResult = await this.dbManager.executeSql(
        `SELECT xpReward FROM achievements WHERE id = ?`,
        [achievementId]
      );

      if (achievementResult.rows.length === 0) {
        throw new AchievementError(
          AchievementErrorType.AchievementNotFound,
          'Achievement not found'
        );
      }

      const xpReward = achievementResult.rows.item(0).xpReward;

      // Insert user achievement
      await this.dbManager.executeSql(
        `INSERT INTO userAchievements (userId, achievementId, unlockedAt, createdAt)
         VALUES (?, ?, ?, ?)`,
        [userId, achievementId, new Date().toISOString(), new Date().toISOString()]
      );

      return {
        achieved: true,
        xpReward,
      };
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to unlock achievement: ${error}`
      );
    }
  }

  /**
   * Get XP reward for rarity tier
   */
  getXPRewardForRarity(rarity: string): number {
    return RARITY_XP_REWARDS[rarity] || 0;
  }

  /**
   * Get all valid rarity tiers
   */
  getValidRarities(): string[] {
    return ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  }

  /**
   * Get all valid categories
   */
  getValidCategories(): string[] {
    return ['STRENGTH', 'CONSISTENCY', 'SOCIAL', 'EXPLORATION'];
  }

  /**
   * Validate achievement data
   */
  validateAchievementData(
    name: string,
    rarity: string,
    category: string,
    xpReward: number
  ): void {
    if (!name || name.length === 0) {
      throw new AchievementError(
        AchievementErrorType.InvalidData,
        'Achievement name cannot be empty'
      );
    }

    if (!this.getValidRarities().includes(rarity)) {
      throw new AchievementError(
        AchievementErrorType.InvalidData,
        'Invalid rarity tier'
      );
    }

    if (!this.getValidCategories().includes(category)) {
      throw new AchievementError(
        AchievementErrorType.InvalidData,
        'Invalid category'
      );
    }

    if (xpReward < 0) {
      throw new AchievementError(
        AchievementErrorType.InvalidData,
        'XP reward cannot be negative'
      );
    }

    // Verify XP reward matches rarity
    const expectedReward = this.getXPRewardForRarity(rarity);
    if (xpReward !== expectedReward) {
      throw new AchievementError(
        AchievementErrorType.InvalidData,
        `XP reward for ${rarity} must be ${expectedReward}`
      );
    }
  }

  /**
   * Get achievement count by rarity
   */
  async getAchievementCountByRarity(userId: string): Promise<Record<string, number>> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT a.rarity, COUNT(*) as count
         FROM userAchievements ua
         JOIN achievements a ON ua.achievementId = a.id
         WHERE ua.userId = ?
         GROUP BY a.rarity`,
        [userId]
      );

      const counts: Record<string, number> = {
        COMMON: 0,
        RARE: 0,
        EPIC: 0,
        LEGENDARY: 0,
      };

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        counts[row.rarity] = row.count;
      }

      return counts;
    } catch (error) {
      throw new AchievementError(
        AchievementErrorType.DatabaseError,
        `Failed to get achievement count by rarity: ${error}`
      );
    }
  }
}

export default AchievementService.getInstance();
