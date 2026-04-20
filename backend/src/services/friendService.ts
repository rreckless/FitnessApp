import { query } from '../database/connection';
import { logger } from '../logging/logger';

export interface FriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Friendship {
  id: string;
  userId1: string;
  userId2: string;
  createdAt: Date;
}

export interface FriendInfo {
  id: string;
  name: string;
  level: number;
  currentStreak: number;
  profilePictureUrl?: string;
}

/**
 * Send a friend request from one user to another
 * 
 * **Validates: Requirements 10.2, 10.5**
 */
export async function sendFriendRequest(senderId: string, recipientId: string): Promise<FriendRequest> {
  try {
    // Check if users are already friends
    const existingFriendship = await query(
      `SELECT id FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [senderId, recipientId]
    );

    if (existingFriendship.rows.length > 0) {
      throw new Error('Users are already friends');
    }

    // Check if request already exists
    const existingRequest = await query(
      `SELECT id FROM friend_requests 
       WHERE sender_id = $1 AND recipient_id = $2 AND status = 'PENDING'`,
      [senderId, recipientId]
    );

    if (existingRequest.rows.length > 0) {
      throw new Error('Friend request already exists');
    }

    // Create friend request
    const result = await query(
      `INSERT INTO friend_requests (sender_id, recipient_id, status, created_at, updated_at)
       VALUES ($1, $2, 'PENDING', NOW(), NOW())
       RETURNING id, sender_id, recipient_id, status, created_at, updated_at`,
      [senderId, recipientId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    logger.error('Error sending friend request', error as Error);
    throw error;
  }
}

/**
 * Accept a friend request
 * 
 * **Validates: Requirements 10.3, 10.5**
 */
export async function acceptFriendRequest(requestId: string): Promise<Friendship> {
  try {
    // Get the friend request
    const requestResult = await query(
      `SELECT sender_id, recipient_id FROM friend_requests WHERE id = $1 AND status = 'PENDING'`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Friend request not found or already processed');
    }

    const { sender_id, recipient_id } = requestResult.rows[0];

    // Create friendship
    const friendshipResult = await query(
      `INSERT INTO friendships (user_id_1, user_id_2, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, user_id_1, user_id_2, created_at`,
      [sender_id, recipient_id]
    );

    // Update friend request status
    await query(
      `UPDATE friend_requests SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    const row = friendshipResult.rows[0];
    return {
      id: row.id,
      userId1: row.user_id_1,
      userId2: row.user_id_2,
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    logger.error('Error accepting friend request', error as Error);
    throw error;
  }
}

/**
 * Decline a friend request
 * 
 * **Validates: Requirements 10.3**
 */
export async function declineFriendRequest(requestId: string): Promise<void> {
  try {
    const result = await query(
      `UPDATE friend_requests SET status = 'DECLINED', updated_at = NOW() 
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id`,
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Friend request not found or already processed');
    }
  } catch (error) {
    logger.error('Error declining friend request', error as Error);
    throw error;
  }
}

/**
 * Remove a friend
 * 
 * **Validates: Requirements 10.4**
 */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  try {
    const result = await query(
      `DELETE FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
       RETURNING id`,
      [userId, friendId]
    );

    if (result.rows.length === 0) {
      throw new Error('Friendship not found');
    }
  } catch (error) {
    logger.error('Error removing friend', error as Error);
    throw error;
  }
}

/**
 * Get list of friends for a user
 * 
 * **Validates: Requirements 10.1, 10.5**
 */
export async function getFriends(userId: string): Promise<FriendInfo[]> {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.level, u.current_streak, u.profile_picture_url
       FROM users u
       INNER JOIN friendships f ON (
         (f.user_id_1 = $1 AND f.user_id_2 = u.id) OR
         (f.user_id_2 = $1 AND f.user_id_1 = u.id)
       )
       ORDER BY u.name ASC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      currentStreak: row.current_streak,
      profilePictureUrl: row.profile_picture_url,
    }));
  } catch (error) {
    logger.error('Error fetching friends', error as Error);
    throw error;
  }
}

/**
 * Get pending friend requests for a user
 * 
 * **Validates: Requirements 10.2**
 */
export async function getPendingFriendRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const result = await query(
      `SELECT id, sender_id, recipient_id, status, created_at, updated_at
       FROM friend_requests
       WHERE recipient_id = $1 AND status = 'PENDING'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    logger.error('Error fetching pending friend requests', error as Error);
    throw error;
  }
}

/**
 * Search for users by username or email
 * 
 * **Validates: Requirements 10.1**
 */
export async function searchUsers(query_str: string, limit: number = 20): Promise<FriendInfo[]> {
  try {
    const result = await query(
      `SELECT id, name, level, current_streak, profile_picture_url
       FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       LIMIT $2`,
      [`%${query_str}%`, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      currentStreak: row.current_streak,
      profilePictureUrl: row.profile_picture_url,
    }));
  } catch (error) {
    logger.error('Error searching users', error as Error);
    throw error;
  }
}

/**
 * Check if two users are friends
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [userId1, userId2]
    );

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking friendship', error as Error);
    throw error;
  }
}

/**
 * Get friend count for a user
 */
export async function getFriendCount(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM friendships 
       WHERE user_id_1 = $1 OR user_id_2 = $1`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Error getting friend count', error as Error);
    throw error;
  }
}
