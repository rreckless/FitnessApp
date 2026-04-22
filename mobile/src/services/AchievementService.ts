import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export type AchievementRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type AchievementCategory = 'Strength' | 'Consistency' | 'Social' | 'Exploration';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  category: AchievementCategory;
  xpReward: number;
  unlockCondition: string;
  iconUrl: string;
  createdAt: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  createdAt: string;
}

export interface AchievementWithUnlockStatus extends Achievement {
  isUnlocked: boolean;
  unlockedAt?: string;
}

interface CacheEntry {
  data: Achievement[];
  timestamp: number;
}

interface UnlockNotification {
  achievementId: string;
  achievementName: string;
  rarity: AchievementRarity;
  xpReward: number;
  timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const DB_NAME = 'fitquest.db';
const ACHIEVEMENTS_TABLE = 'achievements_cache';
const USER_ACHIEVEMENTS_TABLE = 'user_achievements_cache';
const UNLOCK_NOTIFICATIONS_TABLE = 'achievement_notifications';

export class AchievementService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string = '';
  private cache: Map<string, CacheEntry> = new Map();
  private unlockListeners: Set<(achievement: AchievementWithUnlockStatus) => void> = new Set();

  constructor(apiBaseUrl: string, userId: string) {
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
    });
    this.currentUserId = userId;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });

      // Create achievements cache table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${ACHIEVEMENTS_TABLE} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          rarity TEXT NOT NULL,
          category TEXT NOT NULL,
          xpReward INTEGER NOT NULL,
          unlockCondition TEXT NOT NULL,
          iconUrl TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      // Create user achievements table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${USER_ACHIEVEMENTS_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          achievementId TEXT NOT NULL,
          unlockedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(userId, achievementId)
        )
      `);

      // Create unlock notifications table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${UNLOCK_NOTIFICATIONS_TABLE} (
          id TEXT PRIMARY KEY,
          achievementId TEXT NOT NULL,
          achievementName TEXT NOT NULL,
          rarity TEXT NOT NULL,
          xpReward INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to initialize achievement database:', error);
    }
  }

  /**
   * Fetch all achievement definitions from backend
   */
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      // Check cache first
      const cacheKey = 'all_achievements';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      // Fetch from backend
      const response = await this.apiClient.get<Achievement[]>('/achievements');
      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheAchievementsLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch achievements, using cached data:', error);
      return this.getAchievementsFromCache();
    }
  }

  /**
   * Get user's achievements with unlock status
   */
  async getUserAchievements(): Promise<AchievementWithUnlockStatus[]> {
    try {
      // Get all achievements
      const allAchievements = await this.getAllAchievements();

      // Get user's unlocked achievements
      const response = await this.apiClient.get<UserAchievement[]>(
        `/users/${this.currentUserId}/achievements`
      );
      const unlockedAchievements = response.data;

      // Create a map of unlocked achievement IDs for quick lookup
      const unlockedMap = new Map<string, UserAchievement>();
      for (const ua of unlockedAchievements) {
        unlockedMap.set(ua.achievementId, ua);
      }

      // Combine achievements with unlock status
      const result: AchievementWithUnlockStatus[] = allAchievements.map((achievement) => {
        const unlocked = unlockedMap.get(achievement.id);
        return {
          ...achievement,
          isUnlocked: !!unlocked,
          unlockedAt: unlocked?.unlockedAt,
        };
      });

      // Cache user achievements locally
      await this.cacheUserAchievementsLocally(unlockedAchievements);

      return result;
    } catch (error) {
      console.warn('Failed to fetch user achievements, using cached data:', error);
      return this.getUserAchievementsFromCache();
    }
  }

  /**
   * Get achievements filtered by category
   */
  async getAchievementsByCategory(
    category: AchievementCategory
  ): Promise<AchievementWithUnlockStatus[]> {
    const allAchievements = await this.getUserAchievements();
    return allAchievements.filter((a) => a.category === category);
  }

  /**
   * Get achievements filtered by rarity
   */
  async getAchievementsByRarity(
    rarity: AchievementRarity
  ): Promise<AchievementWithUnlockStatus[]> {
    const allAchievements = await this.getUserAchievements();
    return allAchievements.filter((a) => a.rarity === rarity);
  }

  /**
   * Get achievements filtered by both category and rarity
   */
  async getAchievementsByCategoryAndRarity(
    category: AchievementCategory,
    rarity: AchievementRarity
  ): Promise<AchievementWithUnlockStatus[]> {
    const allAchievements = await this.getUserAchievements();
    return allAchievements.filter((a) => a.category === category && a.rarity === rarity);
  }

  /**
   * Get only unlocked achievements
   */
  async getUnlockedAchievements(): Promise<AchievementWithUnlockStatus[]> {
    const allAchievements = await this.getUserAchievements();
    return allAchievements.filter((a) => a.isUnlocked);
  }

  /**
   * Get only locked achievements
   */
  async getLockedAchievements(): Promise<AchievementWithUnlockStatus[]> {
    const allAchievements = await this.getUserAchievements();
    return allAchievements.filter((a) => !a.isUnlocked);
  }

  /**
   * Check if a specific achievement is unlocked
   */
  async isAchievementUnlocked(achievementId: string): Promise<boolean> {
    try {
      const response = await this.apiClient.get<boolean>(
        `/users/${this.currentUserId}/achievements/${achievementId}/unlocked`
      );
      return response.data;
    } catch (error) {
      console.warn(`Failed to check achievement unlock status:`, error);
      return this.isAchievementUnlockedFromCache(achievementId);
    }
  }

  /**
   * Detect and handle achievement unlocks
   * Called when user completes a workout or reaches a milestone
   */
  async detectAchievementUnlocks(): Promise<AchievementWithUnlockStatus[]> {
    try {
      // Get current user achievements
      const userAchievements = await this.getUserAchievements();

      // Get previously unlocked achievements from local storage
      const previouslyUnlocked = await this.getPreviouslyUnlockedAchievements();
      const previouslyUnlockedSet = new Set(previouslyUnlocked);

      // Find newly unlocked achievements
      const newlyUnlocked: AchievementWithUnlockStatus[] = [];
      for (const achievement of userAchievements) {
        if (achievement.isUnlocked && !previouslyUnlockedSet.has(achievement.id)) {
          newlyUnlocked.push(achievement);
          // Store notification
          await this.storeUnlockNotification({
            achievementId: achievement.id,
            achievementName: achievement.name,
            rarity: achievement.rarity,
            xpReward: achievement.xpReward,
            timestamp: Date.now(),
          });
        }
      }

      // Update previously unlocked list
      if (newlyUnlocked.length > 0) {
        const allUnlocked = userAchievements
          .filter((a) => a.isUnlocked)
          .map((a) => a.id);
        await this.savePreviouslyUnlockedAchievements(allUnlocked);

        // Notify listeners
        for (const achievement of newlyUnlocked) {
          this.notifyUnlockListeners(achievement);
        }
      }

      return newlyUnlocked;
    } catch (error) {
      console.error('Failed to detect achievement unlocks:', error);
      return [];
    }
  }

  /**
   * Get pending unlock notifications
   */
  async getPendingNotifications(): Promise<UnlockNotification[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT achievementId, achievementName, rarity, xpReward, timestamp 
         FROM ${UNLOCK_NOTIFICATIONS_TABLE} 
         ORDER BY timestamp DESC`
      );

      const notifications: UnlockNotification[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        notifications.push(result[0].rows.item(i));
      }

      return notifications;
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  }

  /**
   * Clear a notification after displaying it
   */
  async clearNotification(achievementId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${UNLOCK_NOTIFICATIONS_TABLE} WHERE achievementId = ?`,
        [achievementId]
      );
    } catch (error) {
      console.error('Failed to clear notification:', error);
    }
  }

  /**
   * Register a listener for achievement unlocks
   */
  onAchievementUnlocked(
    listener: (achievement: AchievementWithUnlockStatus) => void
  ): () => void {
    this.unlockListeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<{
    totalAchievements: number;
    unlockedCount: number;
    lockedCount: number;
    totalXPFromAchievements: number;
    byRarity: Record<AchievementRarity, { total: number; unlocked: number }>;
    byCategory: Record<AchievementCategory, { total: number; unlocked: number }>;
  }> {
    const allAchievements = await this.getUserAchievements();

    const stats = {
      totalAchievements: allAchievements.length,
      unlockedCount: 0,
      lockedCount: 0,
      totalXPFromAchievements: 0,
      byRarity: {
        Common: { total: 0, unlocked: 0 },
        Rare: { total: 0, unlocked: 0 },
        Epic: { total: 0, unlocked: 0 },
        Legendary: { total: 0, unlocked: 0 },
      },
      byCategory: {
        Strength: { total: 0, unlocked: 0 },
        Consistency: { total: 0, unlocked: 0 },
        Social: { total: 0, unlocked: 0 },
        Exploration: { total: 0, unlocked: 0 },
      },
    };

    for (const achievement of allAchievements) {
      if (achievement.isUnlocked) {
        stats.unlockedCount++;
        stats.totalXPFromAchievements += achievement.xpReward;
      } else {
        stats.lockedCount++;
      }

      stats.byRarity[achievement.rarity].total++;
      if (achievement.isUnlocked) {
        stats.byRarity[achievement.rarity].unlocked++;
      }

      stats.byCategory[achievement.category].total++;
      if (achievement.isUnlocked) {
        stats.byCategory[achievement.category].unlocked++;
      }
    }

    return stats;
  }

  /**
   * Cache achievements locally
   */
  private async cacheAchievementsLocally(achievements: Achievement[]): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old entries
      await this.db.executeSql(`DELETE FROM ${ACHIEVEMENTS_TABLE}`);

      // Insert new entries
      const timestamp = Date.now();
      for (const achievement of achievements) {
        await this.db.executeSql(
          `INSERT INTO ${ACHIEVEMENTS_TABLE} 
           (id, name, description, rarity, category, xpReward, unlockCondition, iconUrl, createdAt, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            achievement.id,
            achievement.name,
            achievement.description,
            achievement.rarity,
            achievement.category,
            achievement.xpReward,
            achievement.unlockCondition,
            achievement.iconUrl,
            achievement.createdAt,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache achievements locally:', error);
    }
  }

  /**
   * Cache user achievements locally
   */
  private async cacheUserAchievementsLocally(
    userAchievements: UserAchievement[]
  ): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old entries for this user
      await this.db.executeSql(
        `DELETE FROM ${USER_ACHIEVEMENTS_TABLE} WHERE userId = ?`,
        [this.currentUserId]
      );

      // Insert new entries
      const timestamp = Date.now();
      for (const ua of userAchievements) {
        await this.db.executeSql(
          `INSERT INTO ${USER_ACHIEVEMENTS_TABLE} 
           (id, userId, achievementId, unlockedAt, createdAt, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ua.id, ua.userId, ua.achievementId, ua.unlockedAt, ua.createdAt, timestamp]
        );
      }
    } catch (error) {
      console.error('Failed to cache user achievements locally:', error);
    }
  }

  /**
   * Retrieve achievements from local cache
   */
  private async getAchievementsFromCache(): Promise<Achievement[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, name, description, rarity, category, xpReward, unlockCondition, iconUrl, createdAt 
         FROM ${ACHIEVEMENTS_TABLE} 
         ORDER BY createdAt ASC`
      );

      const achievements: Achievement[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        achievements.push(result[0].rows.item(i));
      }

      return achievements;
    } catch (error) {
      console.error('Failed to retrieve achievements from cache:', error);
      return [];
    }
  }

  /**
   * Retrieve user achievements from local cache
   */
  private async getUserAchievementsFromCache(): Promise<AchievementWithUnlockStatus[]> {
    if (!this.db) return [];

    try {
      // Get all achievements
      const allAchievements = await this.getAchievementsFromCache();

      // Get user's unlocked achievements
      const result = await this.db.executeSql(
        `SELECT achievementId, unlockedAt FROM ${USER_ACHIEVEMENTS_TABLE} WHERE userId = ?`,
        [this.currentUserId]
      );

      const unlockedMap = new Map<string, string>();
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        unlockedMap.set(row.achievementId, row.unlockedAt);
      }

      // Combine achievements with unlock status
      return allAchievements.map((achievement) => {
        const unlockedAt = unlockedMap.get(achievement.id);
        return {
          ...achievement,
          isUnlocked: !!unlockedAt,
          unlockedAt,
        };
      });
    } catch (error) {
      console.error('Failed to retrieve user achievements from cache:', error);
      return [];
    }
  }

  /**
   * Check if achievement is unlocked from cache
   */
  private async isAchievementUnlockedFromCache(achievementId: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const result = await this.db.executeSql(
        `SELECT COUNT(*) as count FROM ${USER_ACHIEVEMENTS_TABLE} 
         WHERE userId = ? AND achievementId = ?`,
        [this.currentUserId, achievementId]
      );

      return result[0].rows.item(0).count > 0;
    } catch (error) {
      console.error('Failed to check achievement unlock status from cache:', error);
      return false;
    }
  }

  /**
   * Store unlock notification
   */
  private async storeUnlockNotification(notification: UnlockNotification): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT INTO ${UNLOCK_NOTIFICATIONS_TABLE} 
         (id, achievementId, achievementName, rarity, xpReward, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuid.v4(),
          notification.achievementId,
          notification.achievementName,
          notification.rarity,
          notification.xpReward,
          notification.timestamp,
        ]
      );
    } catch (error) {
      console.error('Failed to store unlock notification:', error);
    }
  }

  /**
   * Get previously unlocked achievements from AsyncStorage
   */
  private async getPreviouslyUnlockedAchievements(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(
        `achievement_unlocked_${this.currentUserId}`
      );
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get previously unlocked achievements:', error);
      return [];
    }
  }

  /**
   * Save previously unlocked achievements to AsyncStorage
   */
  private async savePreviouslyUnlockedAchievements(achievementIds: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `achievement_unlocked_${this.currentUserId}`,
        JSON.stringify(achievementIds)
      );
    } catch (error) {
      console.error('Failed to save previously unlocked achievements:', error);
    }
  }

  /**
   * Notify all listeners of achievement unlock
   */
  private notifyUnlockListeners(achievement: AchievementWithUnlockStatus): void {
    for (const listener of this.unlockListeners) {
      try {
        listener(achievement);
      } catch (error) {
        console.error('Error in achievement unlock listener:', error);
      }
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${ACHIEVEMENTS_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${USER_ACHIEVEMENTS_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${UNLOCK_NOTIFICATIONS_TABLE}`);
    } catch (error) {
      console.error('Failed to clear achievement cache:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
      } catch (error) {
        console.error('Failed to close achievement database:', error);
      }
    }
  }
}
