import { query } from '../database/connection';
import { logger } from '../logging/logger';
import Redis from 'ioredis';

// MARK: - Types

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  level: number;
  xp: number;
  profilePictureUrl?: string;
}

export interface UserRankPosition {
  userId: string;
  rank: number;
  xp: number;
  level: number;
}

export interface NearbyCompetitors {
  userPosition: UserRankPosition;
  nearby: LeaderboardEntry[];
}

export interface LeaderboardBatchResult {
  globalUpdated: number;
  weeklyUpdated: number;
  friendsUpdated: number;
  timestamp: Date;
}

// MARK: - Constants

const REDIS_GLOBAL_KEY = 'leaderboard:global';
const REDIS_WEEKLY_KEY = 'leaderboard:weekly';
const REDIS_FRIENDS_KEY_PREFIX = 'leaderboard:friends:';
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes
const BATCH_JOB_INTERVAL = 300000; // 5 minutes in milliseconds
const NEARBY_RANGE = 5; // ±5 positions

// MARK: - Redis Client

let redisClient: Redis | null = null;

/**
 * Initialize Redis client
 */
export function initializeRedis(client: Redis): void {
  redisClient = client;
  logger.info('Redis client initialized for leaderboard service');
}

/**
 * Get Redis client
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis first.');
  }
  return redisClient;
}

// MARK: - Global Leaderboard

/**
 * Get global leaderboard ranked by total XP
 * Returns top users with pagination
 */
export async function getGlobalLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedisClient();

    // Get from Redis sorted set (O(log n) lookup)
    const entries = await redis.zrevrange(REDIS_GLOBAL_KEY, offset, offset + limit - 1, 'WITHSCORES');

    if (entries.length === 0) {
      logger.warning('Global leaderboard cache empty, recalculating');
      await recalculateAllRankings();
      return getGlobalLeaderboard(limit, offset);
    }

    // Parse Redis response (alternating userId and score)
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const xp = parseInt(entries[i + 1], 10);
      const rank = offset + (i / 2) + 1;

      // Get user details from database
      const userResult = await query(
        `SELECT id, name, level, profile_picture_url FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        leaderboard.push({
          rank,
          userId: user.id,
          name: user.name,
          level: user.level,
          xp,
          profilePictureUrl: user.profile_picture_url,
        });
      }
    }

    logger.info('Global leaderboard retrieved', { limit, offset, count: leaderboard.length });
    return leaderboard;
  } catch (error) {
    logger.error('Failed to get global leaderboard', error as Error);
    throw error;
  }
}

// MARK: - Friends Leaderboard

/**
 * Get friends leaderboard for a user ranked by total XP
 */
export async function getFriendsLeaderboard(userId: string, limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedisClient();
    const friendsKey = `${REDIS_FRIENDS_KEY_PREFIX}${userId}`;

    // Get from Redis sorted set for this user's friends
    const entries = await redis.zrevrange(friendsKey, offset, offset + limit - 1, 'WITHSCORES');

    if (entries.length === 0) {
      logger.info('Friends leaderboard cache empty or no friends', { userId });
      return [];
    }

    // Parse Redis response
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const friendId = entries[i];
      const xp = parseInt(entries[i + 1], 10);
      const rank = offset + (i / 2) + 1;

      // Get friend details
      const userResult = await query(
        `SELECT id, name, level, profile_picture_url FROM users WHERE id = $1`,
        [friendId]
      );

      if (userResult.rows.length > 0) {
        const friend = userResult.rows[0];
        leaderboard.push({
          rank,
          userId: friend.id,
          name: friend.name,
          level: friend.level,
          xp,
          profilePictureUrl: friend.profile_picture_url,
        });
      }
    }

    logger.info('Friends leaderboard retrieved', { userId, limit, offset, count: leaderboard.length });
    return leaderboard;
  } catch (error) {
    logger.error('Failed to get friends leaderboard', error as Error);
    throw error;
  }
}

// MARK: - Weekly Leaderboard

/**
 * Get weekly leaderboard ranked by weekly XP
 * Resets every Monday at 00:00 UTC
 */
export async function getWeeklyLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedisClient();

    // Get from Redis sorted set
    const entries = await redis.zrevrange(REDIS_WEEKLY_KEY, offset, offset + limit - 1, 'WITHSCORES');

    if (entries.length === 0) {
      logger.warning('Weekly leaderboard cache empty, recalculating');
      await recalculateWeeklyRankings();
      return getWeeklyLeaderboard(limit, offset);
    }

    // Parse Redis response
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const weeklyXp = parseInt(entries[i + 1], 10);
      const rank = offset + (i / 2) + 1;

      // Get user details
      const userResult = await query(
        `SELECT id, name, level, profile_picture_url FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        leaderboard.push({
          rank,
          userId: user.id,
          name: user.name,
          level: user.level,
          xp: weeklyXp,
          profilePictureUrl: user.profile_picture_url,
        });
      }
    }

    logger.info('Weekly leaderboard retrieved', { limit, offset, count: leaderboard.length });
    return leaderboard;
  } catch (error) {
    logger.error('Failed to get weekly leaderboard', error as Error);
    throw error;
  }
}

// MARK: - User Ranking

/**
 * Get user's rank position on a leaderboard
 */
export async function getUserRankPosition(userId: string, leaderboardType: 'global' | 'weekly' | 'friends'): Promise<UserRankPosition> {
  try {
    const redis = getRedisClient();
    let key: string;

    if (leaderboardType === 'global') {
      key = REDIS_GLOBAL_KEY;
    } else if (leaderboardType === 'weekly') {
      key = REDIS_WEEKLY_KEY;
    } else {
      throw new Error('Invalid leaderboard type for user position query');
    }

    // Get user's score (XP)
    const score = await redis.zscore(key, userId);

    if (score === null) {
      logger.warning('User not found on leaderboard', { userId, leaderboardType });
      return {
        userId,
        rank: -1,
        xp: 0,
        level: 0,
      };
    }

    // Get user's rank (number of users with higher score + 1)
    const rank = await redis.zrevrank(key, userId);

    if (rank === null) {
      throw new Error('Failed to get user rank');
    }

    // Get user's level
    const userResult = await query(
      `SELECT level FROM users WHERE id = $1`,
      [userId]
    );

    const level = userResult.rows.length > 0 ? userResult.rows[0].level : 0;

    logger.info('User rank position retrieved', { userId, leaderboardType, rank: rank + 1, xp: score });

    return {
      userId,
      rank: rank + 1,
      xp: Math.floor(Number(score)),
      level,
    };
  } catch (error) {
    logger.error('Failed to get user rank position', error as Error);
    throw error;
  }
}

// MARK: - Nearby Competitors

/**
 * Get nearby competitors (±5 positions around user)
 */
export async function getNearbyCompetitors(userId: string, leaderboardType: 'global' | 'weekly'): Promise<NearbyCompetitors> {
  try {
    const redis = getRedisClient();
    let key: string;

    if (leaderboardType === 'global') {
      key = REDIS_GLOBAL_KEY;
    } else if (leaderboardType === 'weekly') {
      key = REDIS_WEEKLY_KEY;
    } else {
      throw new Error('Invalid leaderboard type');
    }

    // Get user's position
    const userPosition = await getUserRankPosition(userId, leaderboardType);

    if (userPosition.rank === -1) {
      return {
        userPosition,
        nearby: [],
      };
    }

    // Calculate range (±5 positions)
    const startRank = Math.max(0, userPosition.rank - NEARBY_RANGE - 1);
    const endRank = userPosition.rank + NEARBY_RANGE - 1;

    // Get nearby entries
    const entries = await redis.zrevrange(key, startRank, endRank, 'WITHSCORES');

    const nearby: LeaderboardEntry[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const nearbyUserId = entries[i];
      const xp = parseInt(entries[i + 1], 10);
      const rank = startRank + (i / 2) + 1;

      // Get user details
      const userResult = await query(
        `SELECT id, name, level, profile_picture_url FROM users WHERE id = $1`,
        [nearbyUserId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        nearby.push({
          rank,
          userId: user.id,
          name: user.name,
          level: user.level,
          xp,
          profilePictureUrl: user.profile_picture_url,
        });
      }
    }

    logger.info('Nearby competitors retrieved', { userId, leaderboardType, count: nearby.length });

    return {
      userPosition,
      nearby,
    };
  } catch (error) {
    logger.error('Failed to get nearby competitors', error as Error);
    throw error;
  }
}

// MARK: - Ranking Updates

/**
 * Update user's ranking after workout completion
 */
export async function updateUserRanking(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();

    // Get user's total XP
    const userResult = await query(
      `SELECT total_xp FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const totalXp = userResult.rows[0].total_xp;

    // Update global leaderboard
    await redis.zadd(REDIS_GLOBAL_KEY, totalXp, userId);

    // Update weekly leaderboard (calculate weekly XP)
    const weeklyXp = await calculateWeeklyXP(userId);
    await redis.zadd(REDIS_WEEKLY_KEY, weeklyXp, userId);

    // Update friends leaderboards for all friends
    await updateFriendsLeaderboards(userId);

    logger.info('User ranking updated', { userId, totalXp, weeklyXp });
  } catch (error) {
    logger.error('Failed to update user ranking', error as Error);
    throw error;
  }
}

/**
 * Calculate weekly XP for a user (XP earned since Monday 00:00 UTC)
 */
async function calculateWeeklyXP(userId: string): Promise<number> {
  try {
    // Get Monday 00:00 UTC of current week
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayUTC = new Date(now);
    mondayUTC.setUTCDate(mondayUTC.getUTCDate() - daysToMonday);
    mondayUTC.setUTCHours(0, 0, 0, 0);

    // Sum XP from workouts completed since Monday
    const result = await query(
      `SELECT COALESCE(SUM(total_xp), 0) as weekly_xp
       FROM workouts
       WHERE user_id = $1
         AND created_at >= $2
         AND deleted_at IS NULL`,
      [userId, mondayUTC.toISOString()]
    );

    return result.rows[0].weekly_xp || 0;
  } catch (error) {
    logger.error('Failed to calculate weekly XP', error as Error);
    throw error;
  }
}

/**
 * Update friends leaderboards for all friends of a user
 */
async function updateFriendsLeaderboards(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();

    // Get all friends of this user
    const friendsResult = await query(
      `SELECT user_id_1, user_id_2 FROM friendships
       WHERE (user_id_1 = $1 OR user_id_2 = $1)
         AND status = 'ACCEPTED'`,
      [userId]
    );

    // Get user's total XP
    const userResult = await query(
      `SELECT total_xp FROM users WHERE id = $1`,
      [userId]
    );

    const totalXp = userResult.rows[0].total_xp;

    // Update leaderboard for each friend
    for (const friendship of friendsResult.rows) {
      const friendId = friendship.user_id_1 === userId ? friendship.user_id_2 : friendship.user_id_1;
      const friendsKey = `${REDIS_FRIENDS_KEY_PREFIX}${friendId}`;

      // Add/update user in friend's leaderboard
      await redis.zadd(friendsKey, totalXp, userId);

      // Set expiration (5 minutes)
      await redis.expire(friendsKey, LEADERBOARD_CACHE_TTL);
    }

    logger.info('Friends leaderboards updated', { userId, friendCount: friendsResult.rows.length });
  } catch (error) {
    logger.error('Failed to update friends leaderboards', error as Error);
    throw error;
  }
}

// MARK: - Batch Recalculation

/**
 * Recalculate all rankings (global, weekly, friends)
 * Should be run every 5 minutes as a batch job
 */
export async function recalculateAllRankings(): Promise<LeaderboardBatchResult> {
  try {
    const redis = getRedisClient();
    const startTime = Date.now();

    // Clear existing leaderboards
    await redis.del(REDIS_GLOBAL_KEY);
    await redis.del(REDIS_WEEKLY_KEY);

    // Recalculate global leaderboard
    const globalCount = await recalculateGlobalRankings();

    // Recalculate weekly leaderboard
    const weeklyCount = await recalculateWeeklyRankings();

    // Recalculate friends leaderboards
    const friendsCount = await recalculateFriendsLeaderboards();

    const duration = Date.now() - startTime;

    logger.info('All rankings recalculated', {
      globalCount,
      weeklyCount,
      friendsCount,
      duration: `${duration}ms`,
    });

    return {
      globalUpdated: globalCount,
      weeklyUpdated: weeklyCount,
      friendsUpdated: friendsCount,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to recalculate all rankings', error as Error);
    throw error;
  }
}

/**
 * Recalculate global leaderboard rankings
 */
async function recalculateGlobalRankings(): Promise<number> {
  try {
    const redis = getRedisClient();

    // Get all users with their total XP
    const result = await query(
      `SELECT id, total_xp FROM users WHERE deleted_at IS NULL ORDER BY total_xp DESC`
    );

    // Add to Redis sorted set
    for (const user of result.rows) {
      await redis.zadd(REDIS_GLOBAL_KEY, user.total_xp, user.id);
    }

    // Set expiration
    await redis.expire(REDIS_GLOBAL_KEY, LEADERBOARD_CACHE_TTL);

    logger.info('Global rankings recalculated', { count: result.rows.length });
    return result.rows.length;
  } catch (error) {
    logger.error('Failed to recalculate global rankings', error as Error);
    throw error;
  }
}

/**
 * Recalculate weekly leaderboard rankings
 */
async function recalculateWeeklyRankings(): Promise<number> {
  try {
    const redis = getRedisClient();

    // Get Monday 00:00 UTC of current week
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayUTC = new Date(now);
    mondayUTC.setUTCDate(mondayUTC.getUTCDate() - daysToMonday);
    mondayUTC.setUTCHours(0, 0, 0, 0);

    // Get all users with their weekly XP
    const result = await query(
      `SELECT u.id, COALESCE(SUM(w.total_xp), 0) as weekly_xp
       FROM users u
       LEFT JOIN workouts w ON u.id = w.user_id
         AND w.created_at >= $1
         AND w.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
       GROUP BY u.id
       ORDER BY weekly_xp DESC`,
      [mondayUTC.toISOString()]
    );

    // Add to Redis sorted set
    for (const user of result.rows) {
      await redis.zadd(REDIS_WEEKLY_KEY, user.weekly_xp, user.id);
    }

    // Set expiration
    await redis.expire(REDIS_WEEKLY_KEY, LEADERBOARD_CACHE_TTL);

    logger.info('Weekly rankings recalculated', { count: result.rows.length });
    return result.rows.length;
  } catch (error) {
    logger.error('Failed to recalculate weekly rankings', error as Error);
    throw error;
  }
}

/**
 * Recalculate friends leaderboards for all users
 */
async function recalculateFriendsLeaderboards(): Promise<number> {
  try {
    const redis = getRedisClient();

    // Get all users
    const usersResult = await query(
      `SELECT id FROM users WHERE deleted_at IS NULL`
    );

    let totalUpdated = 0;

    // For each user, recalculate their friends leaderboard
    for (const user of usersResult.rows) {
      const userId = user.id;
      const friendsKey = `${REDIS_FRIENDS_KEY_PREFIX}${userId}`;

      // Get all friends of this user
      const friendsResult = await query(
        `SELECT CASE
           WHEN user_id_1 = $1 THEN user_id_2
           ELSE user_id_1
         END as friend_id
         FROM friendships
         WHERE (user_id_1 = $1 OR user_id_2 = $1)
           AND status = 'ACCEPTED'`,
        [userId]
      );

      // Get friends' XP and add to sorted set
      for (const friendship of friendsResult.rows) {
        const friendId = friendship.friend_id;
        const friendResult = await query(
          `SELECT total_xp FROM users WHERE id = $1`,
          [friendId]
        );

        if (friendResult.rows.length > 0) {
          await redis.zadd(friendsKey, friendResult.rows[0].total_xp, friendId);
        }
      }

      // Set expiration
      if (friendsResult.rows.length > 0) {
        await redis.expire(friendsKey, LEADERBOARD_CACHE_TTL);
        totalUpdated += friendsResult.rows.length;
      }
    }

    logger.info('Friends leaderboards recalculated', { totalUpdated });
    return totalUpdated;
  } catch (error) {
    logger.error('Failed to recalculate friends leaderboards', error as Error);
    throw error;
  }
}

// MARK: - Batch Job Management

let batchJobInterval: NodeJS.Timeout | null = null;

/**
 * Start the batch job for recalculating rankings every 5 minutes
 */
export function startBatchJob(): void {
  if (batchJobInterval) {
    logger.warning('Batch job already running');
    return;
  }

  batchJobInterval = setInterval(async () => {
    try {
      await recalculateAllRankings();
    } catch (error) {
      logger.error('Batch job failed', error as Error);
    }
  }, BATCH_JOB_INTERVAL);

  logger.info('Leaderboard batch job started', { interval: `${BATCH_JOB_INTERVAL}ms` });
}

/**
 * Stop the batch job
 */
export function stopBatchJob(): void {
  if (batchJobInterval) {
    clearInterval(batchJobInterval);
    batchJobInterval = null;
    logger.info('Leaderboard batch job stopped');
  }
}

// MARK: - Validation

/**
 * Validate leaderboard parameters
 */
export function validateLeaderboardParams(limit: number, offset: number): void {
  if (limit < 1 || limit > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  if (offset < 0) {
    throw new Error('Offset cannot be negative');
  }
}
