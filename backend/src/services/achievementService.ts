import { query } from '../database/connection';
import { logger } from '../logging/logger';

// MARK: - Types

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  category: 'STRENGTH' | 'CONSISTENCY' | 'SOCIAL' | 'EXPLORATION';
  xpReward: number;
  unlockedCondition: string; // JSON formula
  icon: string;
  createdAt: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  createdAt: string;
}

export interface AchievementUnlockResult {
  achieved: boolean;
  achievement?: Achievement;
  xpReward?: number;
}

// MARK: - Constants

const RARITY_XP_REWARDS: Record<string, number> = {
  COMMON: 25,
  RARE: 50,
  EPIC: 100,
  LEGENDARY: 250,
};

// MARK: - Achievement Definitions

/**
 * Get all achievement definitions
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  try {
    const result = await query(
      `SELECT id, name, description, rarity, category, xp_reward, unlocked_condition, icon, created_at
       FROM achievements
       ORDER BY rarity DESC, name ASC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      rarity: row.rarity,
      category: row.category,
      xpReward: row.xp_reward,
      unlockedCondition: row.unlocked_condition,
      icon: row.icon,
      createdAt: row.created_at,
    }));
  } catch (error) {
    logger.error('Failed to get all achievements', error as Error);
    throw error;
  }
}

/**
 * Get achievement by ID
 */
export async function getAchievementById(achievementId: string): Promise<Achievement | null> {
  try {
    const result = await query(
      `SELECT id, name, description, rarity, category, xp_reward, unlocked_condition, icon, created_at
       FROM achievements
       WHERE id = $1`,
      [achievementId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row: any = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      rarity: row.rarity,
      category: row.category,
      xpReward: row.xp_reward,
      unlockedCondition: row.unlocked_condition,
      icon: row.icon,
      createdAt: row.created_at,
    };
  } catch (error) {
    logger.error('Failed to get achievement by ID', error as Error);
    throw error;
  }
}

/**
 * Get achievements by category
 */
export async function getAchievementsByCategory(
  category: 'STRENGTH' | 'CONSISTENCY' | 'SOCIAL' | 'EXPLORATION'
): Promise<Achievement[]> {
  try {
    const result = await query(
      `SELECT id, name, description, rarity, category, xp_reward, unlocked_condition, icon, created_at
       FROM achievements
       WHERE category = $1
       ORDER BY rarity DESC, name ASC`,
      [category]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      rarity: row.rarity,
      category: row.category,
      xpReward: row.xp_reward,
      unlockedCondition: row.unlocked_condition,
      icon: row.icon,
      createdAt: row.created_at,
    }));
  } catch (error) {
    logger.error('Failed to get achievements by category', error as Error);
    throw error;
  }
}

// MARK: - User Achievements

/**
 * Get all achievements for a user (locked and unlocked)
 */
export async function getUserAchievements(userId: string): Promise<
  Array<Achievement & { unlocked: boolean; unlockedAt?: string }>
> {
  try {
    const result = await query(
      `SELECT a.id, a.name, a.description, a.rarity, a.category, a.xp_reward, 
              a.unlocked_condition, a.icon, a.created_at, ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       ORDER BY a.rarity DESC, a.name ASC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      rarity: row.rarity,
      category: row.category,
      xpReward: row.xp_reward,
      unlockedCondition: row.unlocked_condition,
      icon: row.icon,
      createdAt: row.created_at,
      unlocked: !!row.unlocked_at,
      unlockedAt: row.unlocked_at,
    }));
  } catch (error) {
    logger.error('Failed to get user achievements', error as Error);
    throw error;
  }
}

/**
 * Get unlocked achievements for a user
 */
export async function getUserUnlockedAchievements(userId: string): Promise<UserAchievement[]> {
  try {
    const result = await query(
      `SELECT id, user_id, achievement_id, unlocked_at, created_at
       FROM user_achievements
       WHERE user_id = $1
       ORDER BY unlocked_at DESC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      achievementId: row.achievement_id,
      unlockedAt: row.unlocked_at,
      createdAt: row.created_at,
    }));
  } catch (error) {
    logger.error('Failed to get user unlocked achievements', error as Error);
    throw error;
  }
}

/**
 * Check if user has unlocked an achievement
 */
export async function hasUserUnlockedAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM user_achievements
       WHERE user_id = $1 AND achievement_id = $2`,
      [userId, achievementId]
    );

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Failed to check if user unlocked achievement', error as Error);
    throw error;
  }
}

/**
 * Unlock an achievement for a user
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string
): Promise<AchievementUnlockResult> {
  try {
    // Check if already unlocked
    const alreadyUnlocked = await hasUserUnlockedAchievement(userId, achievementId);

    if (alreadyUnlocked) {
      return { achieved: false };
    }

    // Get achievement details
    const achievement = await getAchievementById(achievementId);

    if (!achievement) {
      throw new Error('Achievement not found');
    }

    // Insert user achievement
    await query(
      `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, created_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, user_id, achievement_id, unlocked_at, created_at`,
      [userId, achievementId]
    );

    logger.info('Achievement unlocked', {
      userId,
      achievementId,
      rarity: achievement.rarity,
      xpReward: achievement.xpReward,
    });

    return {
      achieved: true,
      achievement,
      xpReward: achievement.xpReward,
    };
  } catch (error) {
    logger.error('Failed to unlock achievement', error as Error);
    throw error;
  }
}

// MARK: - Achievement Validation

/**
 * Validate achievement data
 */
export function validateAchievementData(
  name: string,
  rarity: string,
  category: string,
  xpReward: number
): void {
  if (!name || name.length === 0) {
    throw new Error('Achievement name cannot be empty');
  }

  if (!['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(rarity)) {
    throw new Error('Invalid rarity tier');
  }

  if (!['STRENGTH', 'CONSISTENCY', 'SOCIAL', 'EXPLORATION'].includes(category)) {
    throw new Error('Invalid category');
  }

  if (xpReward < 0) {
    throw new Error('XP reward cannot be negative');
  }

  // Verify XP reward matches rarity
  const expectedReward = RARITY_XP_REWARDS[rarity];
  if (xpReward !== expectedReward) {
    throw new Error(`XP reward for ${rarity} must be ${expectedReward}`);
  }
}

/**
 * Get XP reward for rarity tier
 */
export function getXPRewardForRarity(rarity: string): number {
  return RARITY_XP_REWARDS[rarity] || 0;
}

/**
 * Get all valid rarity tiers
 */
export function getValidRarities(): string[] {
  return ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
}

/**
 * Get all valid categories
 */
export function getValidCategories(): string[] {
  return ['STRENGTH', 'CONSISTENCY', 'SOCIAL', 'EXPLORATION'];
}

// MARK: - Achievement Statistics

/**
 * Get achievement unlock statistics
 */
export async function getAchievementUnlockStats(achievementId: string): Promise<{
  totalUnlocks: number;
  unlockPercentage: number;
}> {
  try {
    // Get total unlocks for this achievement
    const unlocksResult = await query(
      `SELECT COUNT(*) as count FROM user_achievements WHERE achievement_id = $1`,
      [achievementId]
    );

    const totalUnlocks = parseInt(unlocksResult.rows[0].count, 10);

    // Get total users
    const usersResult = await query(`SELECT COUNT(*) as count FROM users`);

    const totalUsers = parseInt(usersResult.rows[0].count, 10);

    const unlockPercentage = totalUsers > 0 ? (totalUnlocks / totalUsers) * 100 : 0;

    return {
      totalUnlocks,
      unlockPercentage,
    };
  } catch (error) {
    logger.error('Failed to get achievement unlock stats', error as Error);
    throw error;
  }
}

/**
 * Get user's achievement count by rarity
 */
export async function getUserAchievementCountByRarity(userId: string): Promise<
  Record<string, number>
> {
  try {
    const result = await query(
      `SELECT a.rarity, COUNT(*) as count
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       GROUP BY a.rarity`,
      [userId]
    );

    const counts: Record<string, number> = {
      COMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    };

    for (const row of result.rows) {
      counts[row.rarity] = parseInt(row.count, 10);
    }

    return counts;
  } catch (error) {
    logger.error('Failed to get user achievement count by rarity', error as Error);
    throw error;
  }
}
