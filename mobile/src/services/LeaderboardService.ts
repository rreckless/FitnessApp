import DatabaseManager from '@database/DatabaseManager';
import { SyncEngine } from './SyncEngine';
import axios from 'axios';
import Config from '@config/Config';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  level: number;
  totalXP: number;
  profilePictureUrl?: string;
}

export interface UserPosition {
  rank: number;
  userId: string;
  totalXP: number;
}

export interface NearbyCompetitors {
  userPosition: UserPosition;
  nearby: LeaderboardEntry[];
}

export interface LeaderboardCache {
  type: 'global' | 'friends' | 'weekly';
  entries: LeaderboardEntry[];
  lastUpdated: Date;
  page: number;
}

export enum LeaderboardErrorType {
  InvalidLeaderboardType = 'INVALID_LEADERBOARD_TYPE',
  InvalidPagination = 'INVALID_PAGINATION',
  DatabaseError = 'DATABASE_ERROR',
  NetworkError = 'NETWORK_ERROR',
  UserNotFound = 'USER_NOT_FOUND',
}

export class LeaderboardError extends Error {
  constructor(
    public type: LeaderboardErrorType,
    message: string
  ) {
    super(message);
    this.name = 'LeaderboardError';
  }
}

export class LeaderboardService {
  private static instance: LeaderboardService;
  private dbManager = DatabaseManager;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  /**
   * Get global leaderboard with pagination
   * Displays top users by total XP
   */
  async getGlobalLeaderboard(
    limit: number = 100,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      this.validatePaginationParams(limit, offset);

      // Check cache first
      const cached = await this.getCachedLeaderboard('global', offset / limit);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseUrl}/leaderboards/global`,
        {
          params: { limit, offset },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const entries: LeaderboardEntry[] = response.data.entries || [];

      // Cache the result
      await this.cacheLeaderboard('global', entries, offset / limit);

      return entries;
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new LeaderboardError(
          LeaderboardErrorType.NetworkError,
          `Failed to fetch global leaderboard: ${error}`
        );
      }
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to fetch global leaderboard: ${error}`
      );
    }
  }

  /**
   * Get friends leaderboard with pagination
   * Displays friends ranked by total XP
   */
  async getFriendsLeaderboard(
    limit: number = 100,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      this.validatePaginationParams(limit, offset);

      // Check cache first
      const cached = await this.getCachedLeaderboard('friends', offset / limit);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseUrl}/leaderboards/friends`,
        {
          params: { limit, offset },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const entries: LeaderboardEntry[] = response.data.entries || [];

      // Cache the result
      await this.cacheLeaderboard('friends', entries, offset / limit);

      return entries;
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new LeaderboardError(
          LeaderboardErrorType.NetworkError,
          `Failed to fetch friends leaderboard: ${error}`
        );
      }
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to fetch friends leaderboard: ${error}`
      );
    }
  }

  /**
   * Get weekly leaderboard with pagination
   * Displays top users by XP earned this week
   */
  async getWeeklyLeaderboard(
    limit: number = 100,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      this.validatePaginationParams(limit, offset);

      // Check cache first
      const cached = await this.getCachedLeaderboard('weekly', offset / limit);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseUrl}/leaderboards/weekly`,
        {
          params: { limit, offset },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const entries: LeaderboardEntry[] = response.data.entries || [];

      // Cache the result
      await this.cacheLeaderboard('weekly', entries, offset / limit);

      return entries;
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new LeaderboardError(
          LeaderboardErrorType.NetworkError,
          `Failed to fetch weekly leaderboard: ${error}`
        );
      }
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to fetch weekly leaderboard: ${error}`
      );
    }
  }

  /**
   * Get user's position on a leaderboard
   */
  async getUserPosition(
    userId: string,
    leaderboardType: 'global' | 'weekly' | 'friends'
  ): Promise<UserPosition> {
    try {
      this.validateLeaderboardType(leaderboardType);

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseUrl}/leaderboards/${leaderboardType}/position/${userId}`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      return {
        rank: response.data.rank,
        userId: response.data.userId,
        totalXP: response.data.totalXP,
      };
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new LeaderboardError(
          LeaderboardErrorType.NetworkError,
          `Failed to fetch user position: ${error}`
        );
      }
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to fetch user position: ${error}`
      );
    }
  }

  /**
   * Get nearby competitors (±5 positions from user)
   */
  async getNearbyCompetitors(
    userId: string,
    leaderboardType: 'global' | 'weekly'
  ): Promise<NearbyCompetitors> {
    try {
      this.validateLeaderboardType(leaderboardType);

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseUrl}/leaderboards/${leaderboardType}/nearby/${userId}`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      return {
        userPosition: {
          rank: response.data.userPosition.rank,
          userId: response.data.userPosition.userId,
          totalXP: response.data.userPosition.totalXP,
        },
        nearby: response.data.nearby || [],
      };
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new LeaderboardError(
          LeaderboardErrorType.NetworkError,
          `Failed to fetch nearby competitors: ${error}`
        );
      }
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to fetch nearby competitors: ${error}`
      );
    }
  }

  /**
   * Refresh leaderboard cache
   */
  async refreshLeaderboard(
    leaderboardType: 'global' | 'friends' | 'weekly',
    page: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      this.validateLeaderboardType(leaderboardType);

      // Clear cache for this page
      await this.clearLeaderboardCache(leaderboardType, page);

      // Fetch fresh data
      const limit = 100;
      const offset = page * limit;

      if (leaderboardType === 'global') {
        return this.getGlobalLeaderboard(limit, offset);
      } else if (leaderboardType === 'friends') {
        return this.getFriendsLeaderboard(limit, offset);
      } else {
        return this.getWeeklyLeaderboard(limit, offset);
      }
    } catch (error) {
      throw new LeaderboardError(
        LeaderboardErrorType.DatabaseError,
        `Failed to refresh leaderboard: ${error}`
      );
    }
  }

  /**
   * Cache leaderboard entries locally
   */
  private async cacheLeaderboard(
    type: 'global' | 'friends' | 'weekly',
    entries: LeaderboardEntry[],
    page: number
  ): Promise<void> {
    try {
      const cacheKey = `leaderboard_${type}_${page}`;
      const cacheData: LeaderboardCache = {
        type,
        entries,
        lastUpdated: new Date(),
        page,
      };

      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO cache (key, value, expires_at)
         VALUES (?, ?, ?)`,
        [cacheKey, JSON.stringify(cacheData), new Date(Date.now() + this.cacheExpiry).toISOString()]
      );
    } catch (error) {
      // Cache failures are non-fatal
    }
  }

  /**
   * Get cached leaderboard entries
   */
  private async getCachedLeaderboard(
    type: 'global' | 'friends' | 'weekly',
    page: number
  ): Promise<LeaderboardEntry[] | null> {
    try {
      const cacheKey = `leaderboard_${type}_${page}`;
      const result = await this.dbManager.executeSql(
        `SELECT value FROM cache WHERE key = ? AND expires_at > ?`,
        [cacheKey, new Date().toISOString()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const cacheData: LeaderboardCache = JSON.parse(result.rows.item(0).value);
      return cacheData.entries;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear leaderboard cache
   */
  private async clearLeaderboardCache(
    type: 'global' | 'friends' | 'weekly',
    page: number
  ): Promise<void> {
    try {
      const cacheKey = `leaderboard_${type}_${page}`;
      await this.dbManager.executeSql(
        `DELETE FROM cache WHERE key = ?`,
        [cacheKey]
      );
    } catch (error) {
      // Cache clearing failures are non-fatal
    }
  }

  /**
   * Validate leaderboard type
   */
  private validateLeaderboardType(type: string): void {
    if (!['global', 'friends', 'weekly'].includes(type)) {
      throw new LeaderboardError(
        LeaderboardErrorType.InvalidLeaderboardType,
        `Invalid leaderboard type: ${type}`
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  private validatePaginationParams(limit: number, offset: number): void {
    if (limit < 1 || limit > 1000) {
      throw new LeaderboardError(
        LeaderboardErrorType.InvalidPagination,
        'Limit must be between 1 and 1000'
      );
    }

    if (offset < 0) {
      throw new LeaderboardError(
        LeaderboardErrorType.InvalidPagination,
        'Offset must be non-negative'
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

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    return error instanceof Error && (
      error.message.includes('Network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout') ||
      error.message.includes('ERR_')
    );
  }
}

export default LeaderboardService.getInstance();
