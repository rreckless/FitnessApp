import { query } from '../database/connection';
import { logger } from '../logging/logger';
import Redis from 'ioredis';
import { config } from '../config/config';

const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', err);
});

export interface ActivityFeedEntry {
  id: string;
  userId: string;
  activityType: 'WORKOUT_COMPLETED' | 'LEVEL_UP' | 'ACHIEVEMENT_UNLOCKED' | 'STREAK_MILESTONE' | 'FRIEND_ADDED';
  relatedEntityId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Create an activity feed entry and fan-out to friends
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**
 */
export async function createActivityFeedEntry(
  userId: string,
  activityType: ActivityFeedEntry['activityType'],
  relatedEntityId?: string,
  metadata?: Record<string, any>
): Promise<ActivityFeedEntry> {
  try {
    // Create entry in database
    const result = await query(
      `INSERT INTO activity_feed (user_id, activity_type, related_entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, user_id, activity_type, related_entity_id, metadata, created_at`,
      [userId, activityType, relatedEntityId || null, JSON.stringify(metadata || {})]
    );

    const row = result.rows[0];
    const entry: ActivityFeedEntry = {
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      relatedEntityId: row.related_entity_id,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
    };

    // Fan-out to friends' Redis feeds
    await fanOutToFriends(userId, entry);

    return entry;
  } catch (error) {
    logger.error('Error creating activity feed entry', error as Error);
    throw error;
  }
}

/**
 * Fan-out activity to all friends' Redis feeds
 * Enforces 1,000 friend limit per user
 */
async function fanOutToFriends(userId: string, entry: ActivityFeedEntry): Promise<void> {
  try {
    // Get user's friends (limit to 1,000)
    const friendsResult = await query(
      `SELECT CASE 
         WHEN user_id_1 = $1 THEN user_id_2
         ELSE user_id_1
       END as friend_id
       FROM friendships
       WHERE (user_id_1 = $1 OR user_id_2 = $1)
       LIMIT 1000`,
      [userId]
    );

    const friends = friendsResult.rows.map((row: any) => row.friend_id);

    // Add entry to each friend's Redis feed
    const entryJson = JSON.stringify(entry);
    for (const friendId of friends) {
      const feedKey = `activity_feed:${friendId}`;
      try {
        // Add to Redis list (keep last 1000 entries)
        await redisClient.lpush(feedKey, entryJson);
        // Trim to keep only last 1000 entries
        await redisClient.ltrim(feedKey, 0, 999);
      } catch (err) {
        logger.error(`Error adding activity to friend ${friendId}'s feed`, err as Error);
      }
    }
  } catch (error) {
    logger.error('Error fanning out activity to friends', error as Error);
    // Don't throw - fan-out is best-effort
  }
}

/**
 * Get activity feed for a user with pagination
 * 
 * **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6**
 */
export async function getActivityFeed(
  userId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ entries: ActivityFeedEntry[]; total: number }> {
  try {
    const offset = (page - 1) * pageSize;

    // Try to get from Redis first
    const feedKey = `activity_feed:${userId}`;
    let cachedEntries: string[] = [];
    try {
      cachedEntries = await redisClient.lrange(feedKey, offset, offset + pageSize - 1);
    } catch (err) {
      logger.error('Error fetching from Redis', err as Error);
    }

    let entries: ActivityFeedEntry[] = [];
    if (cachedEntries.length > 0) {
      entries = cachedEntries.map((entry) => JSON.parse(entry));
    } else {
      // Fall back to database if Redis is empty
      const result = await query(
        `SELECT id, user_id, activity_type, related_entity_id, metadata, created_at
         FROM activity_feed
         WHERE user_id IN (
           SELECT CASE 
             WHEN user_id_1 = $1 THEN user_id_2
             ELSE user_id_1
           END
           FROM friendships
           WHERE user_id_1 = $1 OR user_id_2 = $1
         )
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
      );

      entries = result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        activityType: row.activity_type,
        relatedEntityId: row.related_entity_id,
        metadata: JSON.parse(row.metadata),
        createdAt: new Date(row.created_at),
      }));
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM activity_feed
       WHERE user_id IN (
         SELECT CASE 
           WHEN user_id_1 = $1 THEN user_id_2
           ELSE user_id_1
         END
         FROM friendships
         WHERE user_id_1 = $1 OR user_id_2 = $1
       )`,
      [userId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    return { entries, total };
  } catch (error) {
    logger.error('Error fetching activity feed', error as Error);
    throw error;
  }
}

/**
 * Clear activity feed cache for a user
 */
export async function clearActivityFeedCache(userId: string): Promise<void> {
  try {
    const feedKey = `activity_feed:${userId}`;
    await redisClient.del(feedKey);
  } catch (error) {
    logger.error('Error clearing activity feed cache', error as Error);
    // Don't throw - cache clearing is best-effort
  }
}

/**
 * Get friend count for a user (for 1,000 friend limit enforcement)
 */
export async function getFriendCountForActivityFeed(userId: string): Promise<number> {
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
