import DatabaseManager from '@database/DatabaseManager';
import { StreakData, StreakMilestone, StreakError, StreakErrorType } from '@types/index';

const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, xpReward: 50 },
  { days: 14, xpReward: 100 },
  { days: 30, xpReward: 250 },
  { days: 60, xpReward: 500 },
  { days: 100, xpReward: 1000 },
];

const STREAK_WINDOW_HOURS = 24;

export class StreakService {
  private static instance: StreakService;
  private dbManager = DatabaseManager;

  private constructor() {}

  static getInstance(): StreakService {
    if (!StreakService.instance) {
      StreakService.instance = new StreakService();
    }
    return StreakService.instance;
  }

  /**
   * Increment streak for a user after workout completion
   * Uses UTC timezone for 24-hour window
   */
  async incrementStreak(userId: string, workoutDate: Date): Promise<StreakData> {
    try {
      // Get current user streak data
      const result = await this.dbManager.executeSql(
        `SELECT currentStreak, longestStreak, lastSyncAt FROM users WHERE id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new StreakError(StreakErrorType.UserNotFound, 'User not found');
      }

      const user = result.rows.item(0);
      const lastSyncAt = user.lastSyncAt ? new Date(user.lastSyncAt) : null;
      const workoutDateUTC = new Date(workoutDate.toISOString());

      // Check if streak should be incremented or reset
      let newStreak = user.currentStreak || 0;

      if (lastSyncAt) {
        const hoursSinceLastWorkout = (workoutDateUTC.getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastWorkout <= STREAK_WINDOW_HOURS) {
          // Within 24-hour window, increment streak
          newStreak = user.currentStreak + 1;
        } else {
          // Outside 24-hour window, reset streak
          newStreak = 1;
        }
      } else {
        // First workout
        newStreak = 1;
      }

      // Update longest streak if necessary
      const newLongestStreak = Math.max(user.longestStreak || 0, newStreak);

      // Update user
      await this.dbManager.executeSql(
        `UPDATE users
         SET currentStreak = ?, longestStreak = ?, lastSyncAt = ?, updatedAt = ?
         WHERE id = ?`,
        [newStreak, newLongestStreak, workoutDateUTC.toISOString(), new Date().toISOString(), userId]
      );

      return {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastWorkoutDate: workoutDateUTC,
      };
    } catch (error) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        `Failed to increment streak: ${error}`
      );
    }
  }

  /**
   * Reset streak if no workout in 24 hours
   */
  async checkAndResetStreak(userId: string): Promise<StreakData | null> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT currentStreak, longestStreak, lastSyncAt FROM users WHERE id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new StreakError(StreakErrorType.UserNotFound, 'User not found');
      }

      const user = result.rows.item(0);
      const lastSyncAt = user.lastSyncAt ? new Date(user.lastSyncAt) : null;
      const now = new Date();

      if (!lastSyncAt) {
        return null;
      }

      const hoursSinceLastWorkout = (now.getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastWorkout > STREAK_WINDOW_HOURS && user.currentStreak > 0) {
        // Reset streak
        await this.dbManager.executeSql(
          `UPDATE users SET currentStreak = 0, updatedAt = ? WHERE id = ?`,
          [new Date().toISOString(), userId]
        );

        return {
          currentStreak: 0,
          longestStreak: user.longestStreak || 0,
          lastWorkoutDate: lastSyncAt,
        };
      }

      return null;
    } catch (error) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        `Failed to check and reset streak: ${error}`
      );
    }
  }

  /**
   * Get streak data for a user
   */
  async getStreakData(userId: string): Promise<StreakData> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id, currentStreak, longestStreak, lastSyncAt FROM users WHERE id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new StreakError(StreakErrorType.UserNotFound, 'User not found');
      }

      const user = result.rows.item(0);

      return {
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        lastWorkoutDate: user.lastSyncAt ? new Date(user.lastSyncAt) : undefined,
      };
    } catch (error) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        `Failed to get streak data: ${error}`
      );
    }
  }

  /**
   * Check if streak has reached a milestone
   */
  checkStreakMilestone(currentStreak: number): StreakMilestone | null {
    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak === milestone.days) {
        return milestone;
      }
    }
    return null;
  }

  /**
   * Get next milestone for a streak
   */
  getNextMilestone(currentStreak: number): StreakMilestone | null {
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
  daysUntilNextMilestone(currentStreak: number): number | null {
    const nextMilestone = this.getNextMilestone(currentStreak);
    if (!nextMilestone) {
      return null;
    }
    return nextMilestone.days - currentStreak;
  }

  /**
   * Get reset time in user's local timezone
   */
  getStreakResetTimeInTimezone(userTimezone: string): Date {
    const now = new Date();
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

    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

    // Get next midnight in user's timezone
    const nextMidnight = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return nextMidnight;
  }

  /**
   * Validate streak data
   */
  validateStreakData(streak: number, longestStreak: number): void {
    if (streak < 0) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        'Current streak cannot be negative'
      );
    }

    if (longestStreak < 0) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        'Longest streak cannot be negative'
      );
    }

    if (streak > longestStreak) {
      throw new StreakError(
        StreakErrorType.DatabaseError,
        'Current streak cannot exceed longest streak'
      );
    }
  }
}

export default StreakService.getInstance();
