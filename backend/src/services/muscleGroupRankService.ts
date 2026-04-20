import { query } from '../database/connection';
import { logger } from '../logging/logger';

// MARK: - Types

export interface MuscleGroupRankData {
  userId: string;
  muscleGroup: string;
  rank: number;
  totalVolume: number;
  percentile: number;
  updatedAt: string;
}

export interface MuscleGroupRankUpdate {
  userId: string;
  muscleGroup: string;
  volumeAdded: number;
}

// MARK: - Constants

const MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'ARMS',
  'LEGS',
  'CORE',
];

// Percentile-based rank thresholds
// Rank 1: Bottom 80% (0-20th percentile)
// Rank 2: 20-40th percentile
// Rank 3: 40-60th percentile
// Rank 4: 60-80th percentile
// Rank 5: Top 20% (80-100th percentile)

// MARK: - Muscle Group Rank Tracking

/**
 * Update muscle group rank after workout
 */
export async function updateMuscleGroupRank(
  userId: string,
  muscleGroup: string,
  volumeAdded: number
): Promise<MuscleGroupRankData> {
  try {
    // Validate muscle group
    if (!MUSCLE_GROUPS.includes(muscleGroup)) {
      throw new Error(`Invalid muscle group: ${muscleGroup}`);
    }

    // Get or create muscle group rank entry
    const existingResult = await query(
      `SELECT id, total_volume FROM muscle_group_ranks
       WHERE user_id = $1 AND muscle_group = $2`,
      [userId, muscleGroup]
    );

    let newTotalVolume = volumeAdded;

    if (existingResult.rows.length > 0) {
      newTotalVolume = existingResult.rows[0].total_volume + volumeAdded;
    }

    // Upsert muscle group rank
    const upsertResult = await query(
      `INSERT INTO muscle_group_ranks (user_id, muscle_group, total_volume, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, muscle_group) DO UPDATE
       SET total_volume = $3, updated_at = NOW()
       RETURNING id, user_id, muscle_group, total_volume, updated_at`,
      [userId, muscleGroup, newTotalVolume]
    );

    const rankData = upsertResult.rows[0];

    logger.info('Muscle group rank updated', {
      userId,
      muscleGroup,
      totalVolume: newTotalVolume,
    });

    return {
      userId: rankData.user_id,
      muscleGroup: rankData.muscle_group,
      rank: 1, // Will be calculated by batch job
      totalVolume: rankData.total_volume,
      percentile: 0, // Will be calculated by batch job
      updatedAt: rankData.updated_at,
    };
  } catch (error) {
    logger.error('Failed to update muscle group rank', error as Error);
    throw error;
  }
}

/**
 * Get muscle group rank for a user
 */
export async function getMuscleGroupRank(
  userId: string,
  muscleGroup: string
): Promise<MuscleGroupRankData | null> {
  try {
    const result = await query(
      `SELECT user_id, muscle_group, rank, total_volume, percentile, updated_at
       FROM muscle_group_ranks
       WHERE user_id = $1 AND muscle_group = $2`,
      [userId, muscleGroup]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      userId: row.user_id,
      muscleGroup: row.muscle_group,
      rank: row.rank || 1,
      totalVolume: row.total_volume,
      percentile: row.percentile || 0,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get muscle group rank', error as Error);
    throw error;
  }
}

/**
 * Get all muscle group ranks for a user
 */
export async function getAllMuscleGroupRanks(userId: string): Promise<MuscleGroupRankData[]> {
  try {
    const result = await query(
      `SELECT user_id, muscle_group, rank, total_volume, percentile, updated_at
       FROM muscle_group_ranks
       WHERE user_id = $1
       ORDER BY muscle_group ASC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      userId: row.user_id,
      muscleGroup: row.muscle_group,
      rank: row.rank || 1,
      totalVolume: row.total_volume,
      percentile: row.percentile || 0,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('Failed to get all muscle group ranks', error as Error);
    throw error;
  }
}

// MARK: - Percentile Calculation

/**
 * Calculate rank from percentile
 * Rank 1: 0-20th percentile
 * Rank 2: 20-40th percentile
 * Rank 3: 40-60th percentile
 * Rank 4: 60-80th percentile
 * Rank 5: 80-100th percentile
 */
export function calculateRankFromPercentile(percentile: number): number {
  if (percentile < 20) return 1;
  if (percentile < 40) return 2;
  if (percentile < 60) return 3;
  if (percentile < 80) return 4;
  return 5;
}

/**
 * Batch job to recalculate percentiles and ranks for all users
 * This should be run weekly
 */
export async function batchRecalculatePercentiles(): Promise<number> {
  try {
    let updatedCount = 0;

    // For each muscle group, calculate percentiles
    for (const muscleGroup of MUSCLE_GROUPS) {
      // Get all users' volumes for this muscle group
      const volumesResult = await query(
        `SELECT user_id, total_volume
         FROM muscle_group_ranks
         WHERE muscle_group = $1
         ORDER BY total_volume ASC`,
        [muscleGroup]
      );

      if (volumesResult.rows.length === 0) {
        continue;
      }

      const totalUsers = volumesResult.rows.length;

      // Calculate percentile for each user
      for (let i = 0; i < volumesResult.rows.length; i++) {
        const row: any = volumesResult.rows[i];
        const percentile = (i / totalUsers) * 100;
        const rank = calculateRankFromPercentile(percentile);

        // Update rank and percentile
        await query(
          `UPDATE muscle_group_ranks
           SET rank = $1, percentile = $2, updated_at = NOW()
           WHERE user_id = $3 AND muscle_group = $4`,
          [rank, percentile, row.user_id, muscleGroup]
        );

        updatedCount++;
      }
    }

    logger.info('Batch recalculated percentiles', { updatedCount });

    return updatedCount;
  } catch (error) {
    logger.error('Failed to batch recalculate percentiles', error as Error);
    throw error;
  }
}

/**
 * Get user's rank for a muscle group compared to all users
 */
export async function getUserMuscleGroupRankPosition(
  userId: string,
  muscleGroup: string
): Promise<{ rank: number; totalUsers: number; percentile: number } | null> {
  try {
    // Get user's volume
    const userResult = await query(
      `SELECT total_volume FROM muscle_group_ranks
       WHERE user_id = $1 AND muscle_group = $2`,
      [userId, muscleGroup]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const userVolume = userResult.rows[0].total_volume;

    // Count users with higher volume
    const countResult = await query(
      `SELECT COUNT(*) as count FROM muscle_group_ranks
       WHERE muscle_group = $1 AND total_volume > $2`,
      [muscleGroup, userVolume]
    );

    const usersWithHigherVolume = parseInt(countResult.rows[0].count, 10);

    // Get total users for this muscle group
    const totalResult = await query(
      `SELECT COUNT(*) as count FROM muscle_group_ranks
       WHERE muscle_group = $1`,
      [muscleGroup]
    );

    const totalUsers = parseInt(totalResult.rows[0].count, 10);
    const rank = usersWithHigherVolume + 1;
    const percentile = ((totalUsers - usersWithHigherVolume) / totalUsers) * 100;

    return {
      rank,
      totalUsers,
      percentile,
    };
  } catch (error) {
    logger.error('Failed to get user muscle group rank position', error as Error);
    throw error;
  }
}

// MARK: - Validation

/**
 * Validate muscle group rank data
 */
export function validateMuscleGroupRankData(
  muscleGroup: string,
  totalVolume: number,
  rank: number
): void {
  if (!MUSCLE_GROUPS.includes(muscleGroup)) {
    throw new Error(`Invalid muscle group: ${muscleGroup}`);
  }

  if (totalVolume < 0) {
    throw new Error('Total volume cannot be negative');
  }

  if (rank < 1 || rank > 5) {
    throw new Error('Rank must be between 1 and 5');
  }
}

/**
 * Get all valid muscle groups
 */
export function getValidMuscleGroups(): string[] {
  return MUSCLE_GROUPS;
}
