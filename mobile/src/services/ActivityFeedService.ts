import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export type ActivityType =
  | 'workout_completed'
  | 'level_up'
  | 'achievement_unlocked'
  | 'streak_milestone'
  | 'friend_added';

export interface ActivityFeedEntry {
  id: string;
  userId: string;
  userName: string;
  activityType: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: number;
  isMilestone?: boolean;
}

interface CacheEntry {
  data: ActivityFeedEntry[];
  timestamp: number;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const ITEMS_PER_PAGE = 50;
const DB_NAME = 'fitquest.db';
const ACTIVITY_FEED_TABLE = 'activity_feed_cache';

export class ActivityFeedService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string = '';
  private cache: Map<string, CacheEntry> = new Map();

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

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${ACTIVITY_FEED_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          userName TEXT NOT NULL,
          activityType TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata TEXT,
          createdAt INTEGER NOT NULL,
          isMilestone INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      // Create index for faster queries
      await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_activity_created_at 
        ON ${ACTIVITY_FEED_TABLE}(createdAt DESC)
      `);
    } catch (error) {
      console.error('Failed to initialize activity feed database:', error);
    }
  }

  /**
   * Fetch activity feed with pagination
   */
  async getActivityFeed(page: number = 1): Promise<ActivityFeedEntry[]> {
    try {
      const cacheKey = `feed_page_${page}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<ActivityFeedEntry[]>(
        '/activity-feed',
        {
          params: {
            limit: ITEMS_PER_PAGE,
            offset: (page - 1) * ITEMS_PER_PAGE,
          },
        }
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheActivityFeed(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch activity feed, using cached data:', error);
      return this.getActivityFeedFromCache(page);
    }
  }

  /**
   * Get all cached activity feed entries (for offline support)
   */
  async getCachedActivityFeed(): Promise<ActivityFeedEntry[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, userId, userName, activityType, description, metadata, createdAt, isMilestone 
         FROM ${ACTIVITY_FEED_TABLE} 
         ORDER BY createdAt DESC 
         LIMIT 500`
      );

      const entries: ActivityFeedEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        entries.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          isMilestone: row.isMilestone === 1,
        });
      }

      return entries;
    } catch (error) {
      console.error('Failed to retrieve cached activity feed:', error);
      return [];
    }
  }

  /**
   * Get activity feed entries by type
   */
  async getActivityFeedByType(
    type: ActivityType,
    page: number = 1
  ): Promise<ActivityFeedEntry[]> {
    try {
      const cacheKey = `feed_${type}_page_${page}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<ActivityFeedEntry[]>(
        '/activity-feed',
        {
          params: {
            type,
            limit: ITEMS_PER_PAGE,
            offset: (page - 1) * ITEMS_PER_PAGE,
          },
        }
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheActivityFeed(data);

      return data;
    } catch (error) {
      console.warn(`Failed to fetch ${type} activity feed, using cached data:`, error);
      return this.getActivityFeedByTypeFromCache(type, page);
    }
  }

  /**
   * Get milestone activities (highlighted entries)
   */
  async getMilestoneActivities(): Promise<ActivityFeedEntry[]> {
    try {
      const response = await this.apiClient.get<ActivityFeedEntry[]>(
        '/activity-feed/milestones'
      );

      const data = response.data;

      // Store in local database
      await this.cacheActivityFeed(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch milestone activities, using cached data:', error);
      return this.getMilestoneActivitiesFromCache();
    }
  }

  /**
   * Cache activity feed entries locally
   */
  private async cacheActivityFeed(entries: ActivityFeedEntry[]): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      for (const entry of entries) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${ACTIVITY_FEED_TABLE} 
           (id, userId, userName, activityType, description, metadata, createdAt, isMilestone, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.userId,
            entry.userName,
            entry.activityType,
            entry.description,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.createdAt,
            entry.isMilestone ? 1 : 0,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache activity feed:', error);
    }
  }

  /**
   * Retrieve activity feed from local cache
   */
  private async getActivityFeedFromCache(page: number): Promise<ActivityFeedEntry[]> {
    if (!this.db) return [];

    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const result = await this.db.executeSql(
        `SELECT id, userId, userName, activityType, description, metadata, createdAt, isMilestone 
         FROM ${ACTIVITY_FEED_TABLE} 
         ORDER BY createdAt DESC 
         LIMIT ? OFFSET ?`,
        [ITEMS_PER_PAGE, offset]
      );

      const entries: ActivityFeedEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        entries.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          isMilestone: row.isMilestone === 1,
        });
      }

      return entries;
    } catch (error) {
      console.error('Failed to retrieve activity feed from cache:', error);
      return [];
    }
  }

  /**
   * Retrieve activity feed by type from local cache
   */
  private async getActivityFeedByTypeFromCache(
    type: ActivityType,
    page: number
  ): Promise<ActivityFeedEntry[]> {
    if (!this.db) return [];

    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const result = await this.db.executeSql(
        `SELECT id, userId, userName, activityType, description, metadata, createdAt, isMilestone 
         FROM ${ACTIVITY_FEED_TABLE} 
         WHERE activityType = ? 
         ORDER BY createdAt DESC 
         LIMIT ? OFFSET ?`,
        [type, ITEMS_PER_PAGE, offset]
      );

      const entries: ActivityFeedEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        entries.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          isMilestone: row.isMilestone === 1,
        });
      }

      return entries;
    } catch (error) {
      console.error('Failed to retrieve activity feed by type from cache:', error);
      return [];
    }
  }

  /**
   * Retrieve milestone activities from local cache
   */
  private async getMilestoneActivitiesFromCache(): Promise<ActivityFeedEntry[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, userId, userName, activityType, description, metadata, createdAt, isMilestone 
         FROM ${ACTIVITY_FEED_TABLE} 
         WHERE isMilestone = 1 
         ORDER BY createdAt DESC 
         LIMIT 50`
      );

      const entries: ActivityFeedEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        entries.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          isMilestone: row.isMilestone === 1,
        });
      }

      return entries;
    } catch (error) {
      console.error('Failed to retrieve milestone activities from cache:', error);
      return [];
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${ACTIVITY_FEED_TABLE}`);
    } catch (error) {
      console.error('Failed to clear activity feed cache:', error);
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
        console.error('Failed to close activity feed database:', error);
      }
    }
  }
}
