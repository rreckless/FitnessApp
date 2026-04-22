import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  level: number;
}

export interface LeaderboardPosition {
  rank: number;
  totalUsers: number;
  nearbyCompetitors: LeaderboardEntry[];
}

export type LeaderboardType = 'global' | 'friends' | 'weekly';

interface CacheEntry {
  type: LeaderboardType;
  data: LeaderboardEntry[];
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 100;
const DB_NAME = 'fitquest.db';
const LEADERBOARD_TABLE = 'leaderboard_cache';

export class LeaderboardService {
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
        CREATE TABLE IF NOT EXISTS ${LEADERBOARD_TABLE} (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          rank INTEGER NOT NULL,
          userId TEXT NOT NULL,
          name TEXT NOT NULL,
          xp INTEGER NOT NULL,
          level INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(type, rank)
        )
      `);
    } catch (error) {
      console.error('Failed to initialize leaderboard database:', error);
    }
  }

  /**
   * Fetch leaderboard data from backend with pagination
   */
  async getLeaderboard(
    type: LeaderboardType,
    page: number = 1
  ): Promise<LeaderboardEntry[]> {
    try {
      // Check cache first
      const cacheKey = `${type}_page_${page}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      // Fetch from backend
      const response = await this.apiClient.get<LeaderboardEntry[]>(
        `/leaderboards/${type}`,
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
        type,
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheLeaderboardLocally(type, data);

      return data;
    } catch (error) {
      console.warn(`Failed to fetch ${type} leaderboard, using cached data:`, error);
      return this.getLeaderboardFromCache(type, page);
    }
  }

  /**
   * Get user's position on leaderboard with nearby competitors
   */
  async getUserPosition(type: LeaderboardType): Promise<LeaderboardPosition | null> {
    try {
      const response = await this.apiClient.get<LeaderboardPosition>(
        `/leaderboards/${type}/position/${this.currentUserId}`
      );

      return response.data;
    } catch (error) {
      console.warn(`Failed to fetch user position for ${type} leaderboard:`, error);
      return this.getUserPositionFromCache(type);
    }
  }

  /**
   * Get paginated leaderboard with user position highlighted
   */
  async getLeaderboardWithUserHighlight(
    type: LeaderboardType,
    page: number = 1
  ): Promise<{
    entries: LeaderboardEntry[];
    userPosition: LeaderboardPosition | null;
    currentPage: number;
    totalPages: number;
  }> {
    const entries = await this.getLeaderboard(type, page);
    const userPosition = await this.getUserPosition(type);

    return {
      entries,
      userPosition,
      currentPage: page,
      totalPages: Math.ceil((userPosition?.totalUsers || 0) / ITEMS_PER_PAGE),
    };
  }

  /**
   * Get nearby competitors (users ranked near current user)
   */
  async getNearbyCompetitors(type: LeaderboardType): Promise<LeaderboardEntry[]> {
    try {
      const position = await this.getUserPosition(type);
      return position?.nearbyCompetitors || [];
    } catch (error) {
      console.warn(`Failed to fetch nearby competitors for ${type}:`, error);
      return [];
    }
  }

  /**
   * Cache leaderboard data locally
   */
  private async cacheLeaderboardLocally(
    type: LeaderboardType,
    entries: LeaderboardEntry[]
  ): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old entries for this type
      await this.db.executeSql(
        `DELETE FROM ${LEADERBOARD_TABLE} WHERE type = ?`,
        [type]
      );

      // Insert new entries
      const timestamp = Date.now();
      for (const entry of entries) {
        await this.db.executeSql(
          `INSERT INTO ${LEADERBOARD_TABLE} 
           (id, type, rank, userId, name, xp, level, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid.v4(),
            type,
            entry.rank,
            entry.userId,
            entry.name,
            entry.xp,
            entry.level,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache leaderboard locally:', error);
    }
  }

  /**
   * Retrieve leaderboard from local cache
   */
  private async getLeaderboardFromCache(
    type: LeaderboardType,
    page: number
  ): Promise<LeaderboardEntry[]> {
    if (!this.db) return [];

    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const result = await this.db.executeSql(
        `SELECT rank, userId, name, xp, level FROM ${LEADERBOARD_TABLE} 
         WHERE type = ? 
         ORDER BY rank ASC 
         LIMIT ? OFFSET ?`,
        [type, ITEMS_PER_PAGE, offset]
      );

      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        entries.push(result[0].rows.item(i));
      }

      return entries;
    } catch (error) {
      console.error('Failed to retrieve leaderboard from cache:', error);
      return [];
    }
  }

  /**
   * Retrieve user position from local cache
   */
  private async getUserPositionFromCache(
    type: LeaderboardType
  ): Promise<LeaderboardPosition | null> {
    if (!this.db) return null;

    try {
      // Get user's rank
      const rankResult = await this.db.executeSql(
        `SELECT rank FROM ${LEADERBOARD_TABLE} 
         WHERE type = ? AND userId = ?`,
        [type, this.currentUserId]
      );

      if (rankResult[0].rows.length === 0) return null;

      const userRank = rankResult[0].rows.item(0).rank;

      // Get total users
      const totalResult = await this.db.executeSql(
        `SELECT COUNT(*) as count FROM ${LEADERBOARD_TABLE} WHERE type = ?`,
        [type]
      );

      const totalUsers = totalResult[0].rows.item(0).count;

      // Get nearby competitors (5 above, 5 below)
      const nearbyResult = await this.db.executeSql(
        `SELECT rank, userId, name, xp, level FROM ${LEADERBOARD_TABLE} 
         WHERE type = ? AND rank BETWEEN ? AND ? 
         ORDER BY rank ASC`,
        [type, Math.max(1, userRank - 5), userRank + 5]
      );

      const nearbyCompetitors: LeaderboardEntry[] = [];
      for (let i = 0; i < nearbyResult[0].rows.length; i++) {
        nearbyCompetitors.push(nearbyResult[0].rows.item(i));
      }

      return {
        rank: userRank,
        totalUsers,
        nearbyCompetitors,
      };
    } catch (error) {
      console.error('Failed to retrieve user position from cache:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${LEADERBOARD_TABLE}`);
    } catch (error) {
      console.error('Failed to clear leaderboard cache:', error);
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
        console.error('Failed to close leaderboard database:', error);
      }
    }
  }
}
