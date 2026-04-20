import DatabaseManager from '@database/DatabaseManager';

export interface WidgetData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalXP: number;
  level: number;
  xpToNextLevel: number;
  xpProgress: number; // percentage 0-100
}

export interface WorkoutStatusData {
  hasWorkoutToday: boolean;
  workoutCount: number;
  nextMilestone: string;
  daysUntilMilestone: number;
}

export interface LeaderboardWidgetData {
  userPosition: number;
  userXP: number;
  topThreeUsers: Array<{
    rank: number;
    name: string;
    xp: number;
    level: number;
  }>;
  friendsActivity: Array<{
    friendName: string;
    activity: string;
    timestamp: Date;
  }>;
}

export enum WidgetErrorType {
  UserNotFound = 'USER_NOT_FOUND',
  DatabaseError = 'DATABASE_ERROR',
  InvalidData = 'INVALID_DATA',
  NetworkError = 'NETWORK_ERROR',
}

export class WidgetError extends Error {
  constructor(
    public type: WidgetErrorType,
    message: string
  ) {
    super(message);
    this.name = 'WidgetError';
  }
}

export class WidgetService {
  private static instance: WidgetService;
  private dbManager = DatabaseManager;
  private readonly REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  private constructor() {}

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  /**
   * Get widget data for small widget (streak + XP)
   */
  async getSmallWidgetData(userId: string): Promise<WidgetData> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id, level, totalXP, currentStreak, longestStreak FROM users WHERE id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new WidgetError(WidgetErrorType.UserNotFound, 'User not found');
      }

      const user = result.rows.item(0);
      const xpData = this.calculateXPProgress(user.totalXP, user.level);

      return {
        userId,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        totalXP: user.totalXP || 0,
        level: user.level || 1,
        xpToNextLevel: xpData.xpToNextLevel,
        xpProgress: xpData.xpProgress,
      };
    } catch (error) {
      if (error instanceof WidgetError) {
        throw error;
      }
      throw new WidgetError(
        WidgetErrorType.DatabaseError,
        `Failed to get small widget data: ${error}`
      );
    }
  }

  /**
   * Get widget data for medium widget (workout status + milestone)
   */
  async getMediumWidgetData(userId: string): Promise<WorkoutStatusData> {
    try {
      // Check if user has workout today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const workoutResult = await this.dbManager.executeSql(
        `SELECT COUNT(*) as count FROM workouts 
         WHERE userId = ? AND createdAt >= ? AND createdAt < ?`,
        [userId, today.toISOString(), tomorrow.toISOString()]
      );

      const workoutCount = workoutResult.rows.item(0).count || 0;
      const hasWorkoutToday = workoutCount > 0;

      // Get streak milestone info
      const userResult = await this.dbManager.executeSql(
        `SELECT currentStreak FROM users WHERE id = ?`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new WidgetError(WidgetErrorType.UserNotFound, 'User not found');
      }

      const currentStreak = userResult.rows.item(0).currentStreak || 0;
      const milestoneData = this.getNextStreakMilestone(currentStreak);

      return {
        hasWorkoutToday,
        workoutCount,
        nextMilestone: milestoneData.milestone,
        daysUntilMilestone: milestoneData.daysUntil,
      };
    } catch (error) {
      if (error instanceof WidgetError) {
        throw error;
      }
      throw new WidgetError(
        WidgetErrorType.DatabaseError,
        `Failed to get medium widget data: ${error}`
      );
    }
  }

  /**
   * Get widget data for large widget (leaderboard + friends activity)
   */
  async getLargeWidgetData(userId: string): Promise<LeaderboardWidgetData> {
    try {
      // Get user's XP for position calculation
      const userResult = await this.dbManager.executeSql(
        `SELECT totalXP FROM users WHERE id = ?`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new WidgetError(WidgetErrorType.UserNotFound, 'User not found');
      }

      const userXP = userResult.rows.item(0).totalXP || 0;

      // Get top 3 users (simulated leaderboard)
      const topUsersResult = await this.dbManager.executeSql(
        `SELECT id, name, totalXP, level FROM users 
         ORDER BY totalXP DESC LIMIT 3`
      );

      const topThreeUsers = [];
      for (let i = 0; i < topUsersResult.rows.length; i++) {
        const user = topUsersResult.rows.item(i);
        topThreeUsers.push({
          rank: i + 1,
          name: user.name || 'Unknown',
          xp: user.totalXP || 0,
          level: user.level || 1,
        });
      }

      // Calculate user position
      const positionResult = await this.dbManager.executeSql(
        `SELECT COUNT(*) as position FROM users WHERE totalXP > ?`,
        [userXP]
      );

      const userPosition = (positionResult.rows.item(0).position || 0) + 1;

      // Get recent friends activity (simulated)
      const friendsActivityResult = await this.dbManager.executeSql(
        `SELECT u.name, 'completed a workout' as activity, w.createdAt as timestamp
         FROM workouts w
         JOIN users u ON w.userId = u.id
         WHERE w.userId != ?
         ORDER BY w.createdAt DESC
         LIMIT 5`,
        [userId]
      );

      const friendsActivity = [];
      for (let i = 0; i < friendsActivityResult.rows.length; i++) {
        const activity = friendsActivityResult.rows.item(i);
        friendsActivity.push({
          friendName: activity.name || 'Unknown',
          activity: activity.activity || 'completed a workout',
          timestamp: new Date(activity.timestamp),
        });
      }

      return {
        userPosition,
        userXP,
        topThreeUsers,
        friendsActivity,
      };
    } catch (error) {
      if (error instanceof WidgetError) {
        throw error;
      }
      throw new WidgetError(
        WidgetErrorType.DatabaseError,
        `Failed to get large widget data: ${error}`
      );
    }
  }

  /**
   * Refresh all widget data
   */
  async refreshAllWidgets(userId: string): Promise<{
    small: WidgetData;
    medium: WorkoutStatusData;
    large: LeaderboardWidgetData;
  }> {
    try {
      const [small, medium, large] = await Promise.all([
        this.getSmallWidgetData(userId),
        this.getMediumWidgetData(userId),
        this.getLargeWidgetData(userId),
      ]);

      return { small, medium, large };
    } catch (error) {
      throw new WidgetError(
        WidgetErrorType.DatabaseError,
        `Failed to refresh all widgets: ${error}`
      );
    }
  }

  /**
   * Calculate XP progress to next level
   */
  private calculateXPProgress(totalXP: number, level: number): { xpToNextLevel: number; xpProgress: number } {
    // Level thresholds: Level 1: 0, Level 2: 500, Level 3: 1500, Level 4: 3000, etc.
    const getLevelThreshold = (lvl: number): number => {
      if (lvl === 1) return 0;
      let threshold = 0;
      for (let i = 2; i <= lvl; i++) {
        threshold += 500 + (i - 2) * 250;
      }
      return threshold;
    };

    const currentLevelThreshold = getLevelThreshold(level);
    const nextLevelThreshold = getLevelThreshold(level + 1);
    const xpInCurrentLevel = Math.max(0, totalXP - currentLevelThreshold);
    const xpNeededForLevel = nextLevelThreshold - currentLevelThreshold;
    const xpToNextLevel = Math.max(0, nextLevelThreshold - totalXP);
    const xpProgress = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100)));

    return { xpToNextLevel, xpProgress };
  }

  /**
   * Get next streak milestone
   */
  private getNextStreakMilestone(currentStreak: number): { milestone: string; daysUntil: number } {
    const milestones = [7, 14, 30, 60, 100];

    for (const milestone of milestones) {
      if (currentStreak < milestone) {
        return {
          milestone: `${milestone} day streak`,
          daysUntil: milestone - currentStreak,
        };
      }
    }

    return {
      milestone: '100+ day streak',
      daysUntil: 0,
    };
  }

  /**
   * Get refresh interval in milliseconds
   */
  getRefreshInterval(): number {
    return this.REFRESH_INTERVAL_MS;
  }

  /**
   * Validate widget data
   */
  validateWidgetData(data: WidgetData): void {
    if (data.currentStreak < 0) {
      throw new WidgetError(WidgetErrorType.InvalidData, 'Current streak cannot be negative');
    }

    if (data.longestStreak < 0) {
      throw new WidgetError(WidgetErrorType.InvalidData, 'Longest streak cannot be negative');
    }

    if (data.xpProgress < 0 || data.xpProgress > 100) {
      throw new WidgetError(WidgetErrorType.InvalidData, 'XP progress must be between 0 and 100');
    }

    if (data.level < 1) {
      throw new WidgetError(WidgetErrorType.InvalidData, 'Level must be at least 1');
    }
  }
}

export default WidgetService.getInstance();
