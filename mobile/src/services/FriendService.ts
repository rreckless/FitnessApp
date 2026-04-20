import DatabaseManager from '@database/DatabaseManager';
import { SyncEngine } from './SyncEngine';
import axios from 'axios';
import Config from '@config/Config';

export interface FriendInfo {
  id: string;
  name: string;
  level: number;
  currentStreak: number;
  profilePictureUrl?: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  name: string;
  level: number;
  currentStreak: number;
  profilePictureUrl?: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

export enum FriendServiceErrorType {
  InvalidUserId = 'INVALID_USER_ID',
  InvalidRequestId = 'INVALID_REQUEST_ID',
  InvalidSearchQuery = 'INVALID_SEARCH_QUERY',
  DatabaseError = 'DATABASE_ERROR',
  NetworkError = 'NETWORK_ERROR',
  UserNotFound = 'USER_NOT_FOUND',
  AlreadyFriends = 'ALREADY_FRIENDS',
  RequestAlreadyExists = 'REQUEST_ALREADY_EXISTS',
}

export class FriendServiceError extends Error {
  constructor(
    public type: FriendServiceErrorType,
    message: string
  ) {
    super(message);
    this.name = 'FriendServiceError';
  }
}

export class FriendService {
  private static instance: FriendService;
  private dbManager = DatabaseManager;
  private syncEngine: any;

  private constructor() {
    try {
      this.syncEngine = SyncEngine;
    } catch (e) {
      // SyncEngine may not be available in tests
      this.syncEngine = null;
    }
  }

  static getInstance(): FriendService {
    if (!FriendService.instance) {
      FriendService.instance = new FriendService();
    }
    return FriendService.instance;
  }

  /**
   * Search for users by username or email
   */
  async searchUsers(query: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidSearchQuery,
          'Search query cannot be empty'
        );
      }

      if (query.length > 100) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidSearchQuery,
          'Search query too long'
        );
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/friends/search`,
        {
          params: { query, limit },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const results: SearchResult[] = response.data.results || [];

      // Enrich with local friendship status
      const userId = await this.getCurrentUserId();
      for (const result of results) {
        result.isFriend = await this.isFriendLocally(userId, result.id);
        result.hasPendingRequest = await this.hasPendingRequestLocally(userId, result.id);
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new FriendServiceError(
          FriendServiceErrorType.NetworkError,
          `Failed to search users: ${error.message}`
        );
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to search users: ${error}`
      );
    }
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(recipientId: string): Promise<FriendRequest> {
    try {
      if (!recipientId || recipientId.trim().length === 0) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidUserId,
          'Recipient ID cannot be empty'
        );
      }

      const userId = await this.getCurrentUserId();

      // Check if already friends
      const isFriend = await this.isFriendLocally(userId, recipientId);
      if (isFriend) {
        throw new FriendServiceError(
          FriendServiceErrorType.AlreadyFriends,
          'Already friends with this user'
        );
      }

      // Check if request already exists
      const hasPending = await this.hasPendingRequestLocally(userId, recipientId);
      if (hasPending) {
        throw new FriendServiceError(
          FriendServiceErrorType.RequestAlreadyExists,
          'Friend request already sent'
        );
      }

      // Send request to API
      const response = await axios.post(
        `${Config.apiBaseURL}/friends/request`,
        { recipientId },
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const request: FriendRequest = {
        id: response.data.id,
        senderId: response.data.senderId,
        recipientId: response.data.recipientId,
        status: response.data.status,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
      };

      // Store locally
      await this.storeFriendRequestLocally(request);

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'CREATE',
          entityType: 'FRIEND_REQUEST',
          entityId: request.id,
          payload: JSON.stringify(request),
        });
      }

      return request;
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new FriendServiceError(
          FriendServiceErrorType.NetworkError,
          `Failed to send friend request: ${error.message}`
        );
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to send friend request: ${error}`
      );
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      if (!requestId || requestId.trim().length === 0) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidRequestId,
          'Request ID cannot be empty'
        );
      }

      // Send to API
      await axios.post(
        `${Config.apiBaseURL}/friends/request/${requestId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      // Update locally
      await this.dbManager.executeSql(
        `UPDATE friend_requests SET status = 'ACCEPTED', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), requestId]
      );

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'UPDATE',
          entityType: 'FRIEND_REQUEST',
          entityId: requestId,
          payload: JSON.stringify({ status: 'ACCEPTED' }),
        });
      }
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new FriendServiceError(
          FriendServiceErrorType.NetworkError,
          `Failed to accept friend request: ${error.message}`
        );
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to accept friend request: ${error}`
      );
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<void> {
    try {
      if (!requestId || requestId.trim().length === 0) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidRequestId,
          'Request ID cannot be empty'
        );
      }

      // Send to API
      await axios.post(
        `${Config.apiBaseURL}/friends/request/${requestId}/decline`,
        {},
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      // Update locally
      await this.dbManager.executeSql(
        `UPDATE friend_requests SET status = 'DECLINED', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), requestId]
      );

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'UPDATE',
          entityType: 'FRIEND_REQUEST',
          entityId: requestId,
          payload: JSON.stringify({ status: 'DECLINED' }),
        });
      }
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new FriendServiceError(
          FriendServiceErrorType.NetworkError,
          `Failed to decline friend request: ${error.message}`
        );
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to decline friend request: ${error}`
      );
    }
  }

  /**
   * Get list of friends
   */
  async getFriendsList(): Promise<FriendInfo[]> {
    try {
      const userId = await this.getCurrentUserId();

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/friends`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const friends: FriendInfo[] = response.data.friends || [];

      // Store locally
      await this.storeFriendsLocally(userId, friends);

      return friends;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Fall back to local cache on network error
        const userId = await this.getCurrentUserId();
        return this.getFriendsFromCache(userId);
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to fetch friends list: ${error}`
      );
    }
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendId: string): Promise<void> {
    try {
      if (!friendId || friendId.trim().length === 0) {
        throw new FriendServiceError(
          FriendServiceErrorType.InvalidUserId,
          'Friend ID cannot be empty'
        );
      }

      const userId = await this.getCurrentUserId();

      // Send to API
      await axios.delete(
        `${Config.apiBaseURL}/friends/${friendId}`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      // Remove locally
      await this.dbManager.executeSql(
        `DELETE FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)`,
        [userId, friendId, friendId, userId]
      );

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'DELETE',
          entityType: 'FRIENDSHIP',
          entityId: `${userId}_${friendId}`,
        });
      }
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new FriendServiceError(
          FriendServiceErrorType.NetworkError,
          `Failed to remove friend: ${error.message}`
        );
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to remove friend: ${error}`
      );
    }
  }

  /**
   * Get pending friend requests
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const userId = await this.getCurrentUserId();

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/friends/requests/pending`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const requests: FriendRequest[] = (response.data.requests || []).map((r: any) => ({
        id: r.id,
        senderId: r.senderId,
        recipientId: r.recipientId,
        status: r.status,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }));

      // Store locally
      for (const request of requests) {
        await this.storeFriendRequestLocally(request);
      }

      return requests;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Fall back to local cache
        return this.getPendingRequestsFromCache();
      }
      throw new FriendServiceError(
        FriendServiceErrorType.DatabaseError,
        `Failed to fetch pending requests: ${error}`
      );
    }
  }

  /**
   * Check if two users are friends (local)
   */
  private async isFriendLocally(userId: string, friendId: string): Promise<boolean> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)`,
        [userId, friendId, friendId, userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if pending request exists (local)
   */
  private async hasPendingRequestLocally(userId: string, recipientId: string): Promise<boolean> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id FROM friend_requests WHERE sender_id = ? AND recipient_id = ? AND status = 'PENDING'`,
        [userId, recipientId]
      );
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store friend request locally
   */
  private async storeFriendRequestLocally(request: FriendRequest): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO friend_requests (id, sender_id, recipient_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          request.id,
          request.senderId,
          request.recipientId,
          request.status,
          request.createdAt.toISOString(),
          request.updatedAt.toISOString(),
        ]
      );
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Store friends list locally
   */
  private async storeFriendsLocally(userId: string, friends: FriendInfo[]): Promise<void> {
    try {
      for (const friend of friends) {
        await this.dbManager.executeSql(
          `INSERT OR REPLACE INTO friendships (user_id_1, user_id_2, created_at)
           VALUES (?, ?, ?)`,
          [userId, friend.id, new Date().toISOString()]
        );
      }
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Get friends from local cache
   */
  private async getFriendsFromCache(userId: string): Promise<FriendInfo[]> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT user_id_2 as id FROM friendships WHERE user_id_1 = ?
         UNION
         SELECT user_id_1 as id FROM friendships WHERE user_id_2 = ?`,
        [userId, userId]
      );

      const friends: FriendInfo[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const friendId = result.rows.item(i).id;
        // In a real implementation, would fetch friend details from users table
        friends.push({
          id: friendId,
          name: 'Friend',
          level: 1,
          currentStreak: 0,
        });
      }

      return friends;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get pending requests from local cache
   */
  private async getPendingRequestsFromCache(): Promise<FriendRequest[]> {
    try {
      const userId = await this.getCurrentUserId();
      const result = await this.dbManager.executeSql(
        `SELECT id, sender_id, recipient_id, status, created_at, updated_at
         FROM friend_requests
         WHERE recipient_id = ? AND status = 'PENDING'
         ORDER BY created_at DESC`,
        [userId]
      );

      const requests: FriendRequest[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        requests.push({
          id: row.id,
          senderId: row.sender_id,
          recipientId: row.recipient_id,
          status: row.status,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        });
      }

      return requests;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get current user ID
   */
  private async getCurrentUserId(): Promise<string> {
    // This would be implemented to retrieve from auth context
    return 'current-user-id';
  }

  /**
   * Get auth token from secure storage
   */
  private async getAuthToken(): Promise<string> {
    // This would be implemented to retrieve from secure storage
    return 'token';
  }
}

export default FriendService.getInstance();
