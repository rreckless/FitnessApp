import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export interface Friend {
  userId: string;
  name: string;
  level: number;
  streak: number;
  email?: string;
}

export interface FriendRequest {
  requestId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface UserSearchResult {
  userId: string;
  name: string;
  email: string;
  level: number;
  streak: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DB_NAME = 'fitquest.db';
const FRIENDS_TABLE = 'friends_cache';
const FRIEND_REQUESTS_TABLE = 'friend_requests_cache';
const SEARCH_RESULTS_TABLE = 'search_results_cache';

export class FriendService {
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
        CREATE TABLE IF NOT EXISTS ${FRIENDS_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          level INTEGER NOT NULL,
          streak INTEGER NOT NULL,
          email TEXT,
          timestamp INTEGER NOT NULL
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${FRIEND_REQUESTS_TABLE} (
          id TEXT PRIMARY KEY,
          requestId TEXT NOT NULL UNIQUE,
          fromUserId TEXT NOT NULL,
          fromUserName TEXT NOT NULL,
          toUserId TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${SEARCH_RESULTS_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          level INTEGER NOT NULL,
          streak INTEGER NOT NULL,
          isFriend INTEGER NOT NULL,
          hasPendingRequest INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to initialize friend database:', error);
    }
  }

  /**
   * Search for users by username or email
   */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    try {
      const cacheKey = `search_${query}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<UserSearchResult[]>(
        '/users/search',
        {
          params: { query },
        }
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheSearchResults(data);

      return data;
    } catch (error) {
      console.warn('Failed to search users, using cached data:', error);
      return this.getSearchResultsFromCache(query);
    }
  }

  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(toUserId: string): Promise<FriendRequest | null> {
    try {
      const response = await this.apiClient.post<FriendRequest>(
        '/friends/request',
        { toUserId }
      );

      const request = response.data;

      // Cache the request locally
      await this.cacheFriendRequest(request);

      return request;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      return null;
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<Friend | null> {
    try {
      const response = await this.apiClient.post<Friend>(
        `/friends/request/${requestId}/accept`
      );

      const friend = response.data;

      // Update local cache
      await this.cacheFriend(friend);
      await this.removeFriendRequest(requestId);

      return friend;
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      return null;
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<boolean> {
    try {
      await this.apiClient.post(`/friends/request/${requestId}/decline`);

      // Remove from local cache
      await this.removeFriendRequest(requestId);

      return true;
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      return false;
    }
  }

  /**
   * Get list of friends
   */
  async getFriendsList(): Promise<Friend[]> {
    try {
      const cacheKey = 'friends_list';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<Friend[]>('/friends');

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheFriendsList(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch friends list, using cached data:', error);
      return this.getFriendsListFromCache();
    }
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendUserId: string): Promise<boolean> {
    try {
      await this.apiClient.delete(`/friends/${friendUserId}`);

      // Remove from local cache
      await this.removeFriendFromCache(friendUserId);

      // Invalidate friends list cache
      this.cache.delete('friends_list');

      return true;
    } catch (error) {
      console.error('Failed to remove friend:', error);
      return false;
    }
  }

  /**
   * Get pending friend requests
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const cacheKey = 'pending_requests';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<FriendRequest[]>(
        '/friends/requests/pending'
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cachePendingRequests(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch pending requests, using cached data:', error);
      return this.getPendingRequestsFromCache();
    }
  }

  /**
   * Cache friend locally
   */
  private async cacheFriend(friend: Friend): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${FRIENDS_TABLE} 
         (id, userId, name, level, streak, email, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid.v4(),
          friend.userId,
          friend.name,
          friend.level,
          friend.streak,
          friend.email || '',
          timestamp,
        ]
      );
    } catch (error) {
      console.error('Failed to cache friend:', error);
    }
  }

  /**
   * Cache friends list locally
   */
  private async cacheFriendsList(friends: Friend[]): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old entries
      await this.db.executeSql(`DELETE FROM ${FRIENDS_TABLE}`);

      // Insert new entries
      const timestamp = Date.now();
      for (const friend of friends) {
        await this.db.executeSql(
          `INSERT INTO ${FRIENDS_TABLE} 
           (id, userId, name, level, streak, email, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid.v4(),
            friend.userId,
            friend.name,
            friend.level,
            friend.streak,
            friend.email || '',
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache friends list:', error);
    }
  }

  /**
   * Get friends list from cache
   */
  private async getFriendsListFromCache(): Promise<Friend[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT userId, name, level, streak, email FROM ${FRIENDS_TABLE} 
         ORDER BY name ASC`
      );

      const friends: Friend[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        friends.push(result[0].rows.item(i));
      }

      return friends;
    } catch (error) {
      console.error('Failed to retrieve friends list from cache:', error);
      return [];
    }
  }

  /**
   * Remove friend from cache
   */
  private async removeFriendFromCache(friendUserId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${FRIENDS_TABLE} WHERE userId = ?`,
        [friendUserId]
      );
    } catch (error) {
      console.error('Failed to remove friend from cache:', error);
    }
  }

  /**
   * Cache friend request locally
   */
  private async cacheFriendRequest(request: FriendRequest): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${FRIEND_REQUESTS_TABLE} 
         (id, requestId, fromUserId, fromUserName, toUserId, status, createdAt, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid.v4(),
          request.requestId,
          request.fromUserId,
          request.fromUserName,
          request.toUserId,
          request.status,
          request.createdAt,
          timestamp,
        ]
      );
    } catch (error) {
      console.error('Failed to cache friend request:', error);
    }
  }

  /**
   * Cache pending requests locally
   */
  private async cachePendingRequests(requests: FriendRequest[]): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old entries
      await this.db.executeSql(`DELETE FROM ${FRIEND_REQUESTS_TABLE}`);

      // Insert new entries
      const timestamp = Date.now();
      for (const request of requests) {
        await this.db.executeSql(
          `INSERT INTO ${FRIEND_REQUESTS_TABLE} 
           (id, requestId, fromUserId, fromUserName, toUserId, status, createdAt, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid.v4(),
            request.requestId,
            request.fromUserId,
            request.fromUserName,
            request.toUserId,
            request.status,
            request.createdAt,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache pending requests:', error);
    }
  }

  /**
   * Get pending requests from cache
   */
  private async getPendingRequestsFromCache(): Promise<FriendRequest[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT requestId, fromUserId, fromUserName, toUserId, status, createdAt 
         FROM ${FRIEND_REQUESTS_TABLE} 
         WHERE status = 'pending' 
         ORDER BY createdAt DESC`
      );

      const requests: FriendRequest[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        requests.push(result[0].rows.item(i));
      }

      return requests;
    } catch (error) {
      console.error('Failed to retrieve pending requests from cache:', error);
      return [];
    }
  }

  /**
   * Remove friend request from cache
   */
  private async removeFriendRequest(requestId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${FRIEND_REQUESTS_TABLE} WHERE requestId = ?`,
        [requestId]
      );
    } catch (error) {
      console.error('Failed to remove friend request from cache:', error);
    }
  }

  /**
   * Cache search results locally
   */
  private async cacheSearchResults(results: UserSearchResult[]): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      for (const result of results) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${SEARCH_RESULTS_TABLE} 
           (id, userId, name, email, level, streak, isFriend, hasPendingRequest, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid.v4(),
            result.userId,
            result.name,
            result.email,
            result.level,
            result.streak,
            result.isFriend ? 1 : 0,
            result.hasPendingRequest ? 1 : 0,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache search results:', error);
    }
  }

  /**
   * Get search results from cache
   */
  private async getSearchResultsFromCache(query: string): Promise<UserSearchResult[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT userId, name, email, level, streak, isFriend, hasPendingRequest 
         FROM ${SEARCH_RESULTS_TABLE} 
         WHERE name LIKE ? OR email LIKE ? 
         ORDER BY name ASC`,
        [`%${query}%`, `%${query}%`]
      );

      const results: UserSearchResult[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        results.push({
          ...row,
          isFriend: row.isFriend === 1,
          hasPendingRequest: row.hasPendingRequest === 1,
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to retrieve search results from cache:', error);
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
      await this.db.executeSql(`DELETE FROM ${FRIENDS_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${FRIEND_REQUESTS_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${SEARCH_RESULTS_TABLE}`);
    } catch (error) {
      console.error('Failed to clear friend cache:', error);
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
        console.error('Failed to close friend database:', error);
      }
    }
  }
}
