import DatabaseManager from '@database/DatabaseManager';
import { SyncEngine } from './SyncEngine';
import axios from 'axios';
import Config from '@config/Config';

export type ActivityType =
  | 'WORKOUT_COMPLETED'
  | 'LEVEL_UP'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'STREAK_MILESTONE'
  | 'FRIEND_ADDED';

export interface ActivityFeedEntry {
  id: string;
  userId: string;
  userName: string;
  activityType: ActivityType;
  relatedEntityId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  profilePictureUrl?: string;
}

export interface ActivityFeedPage {
  entries: ActivityFeedEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export enum ActivityFeedErrorType {
  InvalidPagination = 'INVALID_PAGINATION',
  DatabaseError = 'DATABASE_ERROR',
  NetworkError = 'NETWORK_ERROR',
  InvalidActivityType = 'INVALID_ACTIVITY_TYPE',
}

export class ActivityFeedError extends Error {
  constructor(
    public type: ActivityFeedErrorType,
    message: string
  ) {
    super(message);
    this.name = 'ActivityFeedError';
  }
}

export class ActivityFeedService {
  private static instance: ActivityFeedService;
  private dbManager = DatabaseManager;
  private syncEngine: any;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    try {
      this.syncEngine = SyncEngine;
    } catch (e) {
      // SyncEngine may not be available in tests
      this.syncEngine = null;
    }
  }

  static getInstance(): ActivityFeedService {
    if (!ActivityFeedService.instance) {
      ActivityFeedService.instance = new ActivityFeedService();
    }
    return ActivityFeedService.instance;
  }

  /**
   * Get activity feed with pagination
   * Displays activities from friends in reverse chronological order
   */
  async getActivityFeed(page: number = 1, pageSize: number = 50): Promise<ActivityFeedPage> {
    try {
      this.validatePaginationParams(page, pageSize);

      // Check cache first
      const cached = await this.getCachedActivityFeed(page, pageSize);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/activity-feed`,
        {
          params: { page, pageSize },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const entries: ActivityFeedEntry[] = (response.data.entries || []).map((e: any) => ({
        id: e.id,
        userId: e.userId,
        userName: e.userName,
        activityType: e.activityType,
        relatedEntityId: e.relatedEntityId,
        metadata: e.metadata || {},
        createdAt: new Date(e.createdAt),
        profilePictureUrl: e.profilePictureUrl,
      }));

      const result: ActivityFeedPage = {
        entries,
        total: response.data.total || 0,
        page,
        pageSize,
      };

      // Cache the result
      await this.cacheActivityFeed(result);

      // Store entries locally for offline access
      await this.storeEntriesLocally(entries);

      return result;
    } catch (error) {
      // Check if it's a network error
      const isNetworkError = error instanceof Error && (
        error.message.includes('Network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout')
      );

      if (isNetworkError) {
        // Fall back to local cache on network error
        return this.getActivityFeedFromCache(page, pageSize);
      }
      throw new ActivityFeedError(
        ActivityFeedErrorType.NetworkError,
        `Failed to fetch activity feed: ${error}`
      );
    }
  }

  /**
   * Get activity feed from local cache (offline support)
   */
  private async getActivityFeedFromCache(
    page: number,
    pageSize: number
  ): Promise<ActivityFeedPage> {
    try {
      const offset = (page - 1) * pageSize;

      const result = await this.dbManager.executeSql(
        `SELECT id, user_id, user_name, activity_type, related_entity_id, metadata, created_at, profile_picture_url
         FROM activity_feed
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [pageSize, offset]
      );

      const entries: ActivityFeedEntry[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        entries.push({
          id: row.id,
          userId: row.user_id,
          userName: row.user_name,
          activityType: row.activity_type,
          relatedEntityId: row.related_entity_id,
          metadata: JSON.parse(row.metadata || '{}'),
          createdAt: new Date(row.created_at),
          profilePictureUrl: row.profile_picture_url,
        });
      }

      // Get total count
      const countResult = await this.dbManager.executeSql(
        `SELECT COUNT(*) as count FROM activity_feed`
      );

      const total = countResult.rows.item(0).count;

      return {
        entries,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      throw new ActivityFeedError(
        ActivityFeedErrorType.DatabaseError,
        `Failed to fetch activity feed from cache: ${error}`
      );
    }
  }

  /**
   * Create a local activity entry (for offline support)
   * This is called when a user completes an action locally
   */
  async createLocalActivityEntry(
    userId: string,
    userName: string,
    activityType: ActivityType,
    metadata: Record<string, any>,
    relatedEntityId?: string,
    profilePictureUrl?: string
  ): Promise<ActivityFeedEntry> {
    try {
      this.validateActivityType(activityType);

      const id = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const entry: ActivityFeedEntry = {
        id,
        userId,
        userName,
        activityType,
        relatedEntityId,
        metadata,
        createdAt: now,
        profilePictureUrl,
      };

      // Store locally
      await this.dbManager.executeSql(
        `INSERT INTO activity_feed (id, user_id, user_name, activity_type, related_entity_id, metadata, created_at, profile_picture_url, is_local)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          userId,
          userName,
          activityType,
          relatedEntityId || null,
          JSON.stringify(metadata),
          now.toISOString(),
          profilePictureUrl || null,
        ]
      );

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'CREATE',
          entityType: 'ACTIVITY_FEED_ENTRY',
          entityId: id,
          payload: JSON.stringify(entry),
        });
      }

      return entry;
    } catch (error) {
      if (error instanceof ActivityFeedError) {
        throw error;
      }
      throw new ActivityFeedError(
        ActivityFeedErrorType.DatabaseError,
        `Failed to create activity entry: ${error}`
      );
    }
  }

  /**
   * Refresh activity feed cache
   */
  async refreshActivityFeed(page: number = 1, pageSize: number = 50): Promise<ActivityFeedPage> {
    try {
      this.validatePaginationParams(page, pageSize);

      // Clear cache
      await this.clearActivityFeedCache(page);

      // Fetch fresh data
      return this.getActivityFeed(page, pageSize);
    } catch (error) {
      throw new ActivityFeedError(
        ActivityFeedErrorType.DatabaseError,
        `Failed to refresh activity feed: ${error}`
      );
    }
  }

  /**
   * Cache activity feed page
   */
  private async cacheActivityFeed(page: ActivityFeedPage): Promise<void> {
    try {
      const cacheKey = `activity_feed_${page.page}_${page.pageSize}`;
      const cacheData = {
        ...page,
        cachedAt: new Date().toISOString(),
      };

      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO cache (key, value, expires_at)
         VALUES (?, ?, ?)`,
        [
          cacheKey,
          JSON.stringify(cacheData),
          new Date(Date.now() + this.cacheExpiry).toISOString(),
        ]
      );
    } catch (error) {
      // Cache failures are non-fatal
    }
  }

  /**
   * Get cached activity feed page
   */
  private async getCachedActivityFeed(
    page: number,
    pageSize: number
  ): Promise<ActivityFeedPage | null> {
    try {
      const cacheKey = `activity_feed_${page}_${pageSize}`;
      const result = await this.dbManager.executeSql(
        `SELECT value FROM cache WHERE key = ? AND expires_at > ?`,
        [cacheKey, new Date().toISOString()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return JSON.parse(result.rows.item(0).value);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear activity feed cache
   */
  private async clearActivityFeedCache(page: number): Promise<void> {
    try {
      const cacheKey = `activity_feed_${page}_%`;
      await this.dbManager.executeSql(
        `DELETE FROM cache WHERE key LIKE ?`,
        [cacheKey]
      );
    } catch (error) {
      // Cache clearing failures are non-fatal
    }
  }

  /**
   * Store activity entries locally
   */
  private async storeEntriesLocally(entries: ActivityFeedEntry[]): Promise<void> {
    try {
      for (const entry of entries) {
        await this.dbManager.executeSql(
          `INSERT OR REPLACE INTO activity_feed (id, user_id, user_name, activity_type, related_entity_id, metadata, created_at, profile_picture_url, is_local)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            entry.id,
            entry.userId,
            entry.userName,
            entry.activityType,
            entry.relatedEntityId || null,
            JSON.stringify(entry.metadata),
            entry.createdAt.toISOString(),
            entry.profilePictureUrl || null,
          ]
        );
      }
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Validate pagination parameters
   */
  private validatePaginationParams(page: number, pageSize: number): void {
    if (page < 1) {
      throw new ActivityFeedError(
        ActivityFeedErrorType.InvalidPagination,
        'Page must be >= 1'
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      throw new ActivityFeedError(
        ActivityFeedErrorType.InvalidPagination,
        'Page size must be between 1 and 100'
      );
    }
  }

  /**
   * Validate activity type
   */
  private validateActivityType(type: string): void {
    const validTypes: ActivityType[] = [
      'WORKOUT_COMPLETED',
      'LEVEL_UP',
      'ACHIEVEMENT_UNLOCKED',
      'STREAK_MILESTONE',
      'FRIEND_ADDED',
    ];

    if (!validTypes.includes(type as ActivityType)) {
      throw new ActivityFeedError(
        ActivityFeedErrorType.InvalidActivityType,
        `Invalid activity type: ${type}`
      );
    }
  }

  /**
   * Get auth token from secure storage
   */
  private async getAuthToken(): Promise<string> {
    // This would be implemented to retrieve from secure storage
    return 'token';
  }
}

export default ActivityFeedService.getInstance();
