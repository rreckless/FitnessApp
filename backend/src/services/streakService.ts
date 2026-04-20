import { query } from '../database/connection';
import logger from '../logging/logger';

// MARK: - Types

export interface StreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string;
  streakStartDate: string;
  milestoneReached?: number;
}

export interface StreakMilestone {
  days: number;
  xpReward: number;
  achievementId?: string;
}

// MARK: - Constants

const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, xpReward: 50 },
  { days: 14, xpReward: 100 },
  { days: 30, xpReward: 250 },
  { days: 60, xpReward: 500 },
  { days: 100, xpReward: 1000 },
];

const STREAK_WINDOW_HOURS = 24;

// MARK: - Streak Tracking

/**
 * Increment streak for a user after workout completion
 * Uses UTC timezone for 24-hour window
 */
export async function incrementStreak(userId: string, workoutDate: Date): Promise<StreakData> {
  try {
    // Get current user streak data
    const userResult = await query(
      `SELECT current_streak, longest_streak, last_sync_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    const lastSyncAt = user.last_sync_at ? new Date(user.last_sync_at) : null;
    const workoutDateUTC = new Date(workoutDate.toISOString());

    // Check if streak should be incremented or reset
    let newStreak = user.current_streak;
    let streakStartDate = new Date();

    if (lastSyncAt) {
      const hoursSinceLastWorkout = (workoutDateUTC.getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastWorkout <= STREAK_WINDOW_HOURS) {
        // Within 24-hour window, increment streak
        newStreak = user.current_streak + 1;
      } else {
        // Outside 24-hour window, reset streak
        newStreak = 1;
      }
    } else {
      // First workout
      newStreak = 1;
    }

    // Update longest streak if necessary
    const newLongestStreak = Math.max(user.longest_streak || 0, newStreak);

    // Update user
    const updateResult = await query(
      `UPDATE users
       SET current_streak = $1, longest_streak = $2, last_sync_at = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING current_streak, longest_streak, last_sync_at`,
      [newStreak, newLongestStreak, workoutDateUTC.toISOString(), userId]
    );

    logger.info('Streak incremented', {
      userId,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
    });

    return {
      userId,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastWorkoutDate: workoutDateUTC.toISOString(),
      streakStartDate: streakStartDate.toISOString(),
    };
  } catch (error) {
    logger.error('Failed to increment streak', error as Error);
    throw error;
  }
}

/**
 * Reset streak if no workout in 24 hours
 */
export async function checkAndResetStreak(userId: string): Promise<StreakData | null> {
  try {
    const userResult = await query(
      `SELECT current_streak, longest_streak, last_sync_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    const lastSyncAt = user.last_sync_at ? new Date(user.last_sync_at) : null;
    const now = new Date();

    if (!lastSyncAt) {
      return null;
    }

    const hoursSinceLastWorkout = (now.getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastWorkout > STREAK_WINDOW_HOURS && user.current_streak > 0) {
      // Reset streak
      const updateResult = await query(
        `UPDATE users
         SET current_streak = 0, updated_at = NOW()
         WHERE id = $1
         RETURNING current_streak, longest_streak, last_sync_at`,
        [userId]
      );

      logger.info('Streak reset', {
        userId,
        previousStreak: user.current_streak,
        longestStreak: user.longest_streak,
      });

      return {
        userId,
        currentStreak: 0,
        longestStreak: user.longest_streak || 0,
        lastWorkoutDate: lastSyncAt.toISOString(),
        streakStartDate: new Date().toISOString(),
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to check and reset streak', error as Error);
    throw error;
  }
}

/**
 * Get streak data for a user
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  try {
    const result = await query(
      `SELECT id, current_streak, longest_streak, last_sync_at FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    return {
      userId: user.id,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      lastWorkoutDate: user.last_sync_at ? new Date(user.last_sync_at).toISOString() : '',
      streakStartDate: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to get streak data', error as Error);
    throw error;
  }
}

// MARK: - Milestone Detection

/**
 * Check if streak has reached a milestone
 */
export function checkStreakMilestone(currentStreak: number): StreakMilestone | null {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak === milestone.days) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get all streak milestones
 */
export function getStreakMilestones(): StreakMilestone[] {
  return STREAK_MILESTONES;
}

/**
 * Get next milestone for a streak
 */
export function getNextMilestone(currentStreak: number): StreakMilestone | null {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak < milestone.days) {
      return milestone;
    }
  }
  return null;
}

/**
 * Calculate days until next milestone
 */
export function daysUntilNextMilestone(currentStreak: number): number | null {
  const nextMilestone = getNextMilestone(currentStreak);
  if (!nextMilestone) {
    return null;
  }
  return nextMilestone.days - currentStreak;
}

// MARK: - Streak Reset Notifications

/**
 * Get reset time in user's local timezone
 * Streak resets at 00:00 UTC, but we display in user's timezone
 */
export function getStreakResetTimeInTimezone(userTimezone: string): Date {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));

  // Get next midnight UTC
  const nextMidnightUTC = new Date(utcDate);
  nextMidnightUTC.setUTCDate(nextMidnightUTC.getUTCDate() + 1);
  nextMidnightUTC.setUTCHours(0, 0, 0, 0);

  // Convert to user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return new Date(formatter.format(nextMidnightUTC));
}

// MARK: - Batch Operations

/**
 * Batch reset streaks for users who haven't worked out in 24 hours
 * This should be run as a scheduled job
 */
export async function batchResetExpiredStreaks(): Promise<number> {
  try {
    const result = await query(
      `UPDATE users
       SET current_streak = 0, updated_at = NOW()
       WHERE current_streak > 0
         AND last_sync_at < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );

    const resetCount = result.rows.length;

    logger.info('Batch reset expired streaks', { resetCount });

    return resetCount;
  } catch (error) {
    logger.error('Failed to batch reset streaks', error as Error);
    throw error;
  }
}

// MARK: - Validation

/**
 * Validate streak data
 */
export function validateStreakData(streak: number, longestStreak: number): void {
  if (streak < 0) {
    throw new Error('Current streak cannot be negative');
  }

  if (longestStreak < 0) {
    throw new Error('Longest streak cannot be negative');
  }

  if (streak > longestStreak) {
    throw new Error('Current streak cannot exceed longest streak');
  }
}
