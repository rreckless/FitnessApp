import DatabaseManager from '@database/DatabaseManager';
import { MuscleGroupRankData, MuscleGroupRankError, MuscleGroupRankErrorType } from '@types/index';

const MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'ARMS',
  'LEGS',
  'CORE',
];

export class MuscleGroupRankService {
  private static instance: MuscleGroupRankService;
  private dbManager = DatabaseManager;

  private constructor() {}

  static getInstance(): MuscleGroupRankService {
    if (!MuscleGroupRankService.instance) {
      MuscleGroupRankService.instance = new MuscleGroupRankService();
    }
    return MuscleGroupRankService.instance;
  }

  /**
   * Update muscle group rank after workout
   */
  async updateMuscleGroupRank(
    userId: string,
    muscleGroup: string,
    volumeAdded: number
  ): Promise<MuscleGroupRankData> {
    try {
      // Validate muscle group
      if (!MUSCLE_GROUPS.includes(muscleGroup)) {
        throw new MuscleGroupRankError(
          MuscleGroupRankErrorType.InvalidMuscleGroup,
          `Invalid muscle group: ${muscleGroup}`
        );
      }

      // Get or create muscle group rank entry
      const existingResult = await this.dbManager.executeSql(
        `SELECT id, totalVolume FROM muscleGroupRanks
         WHERE userId = ? AND muscleGroup = ?`,
        [userId, muscleGroup]
      );

      let newTotalVolume = volumeAdded;

      if (existingResult.rows.length > 0) {
        newTotalVolume = existingResult.rows.item(0).totalVolume + volumeAdded;
      }

      // Upsert muscle group rank
      if (existingResult.rows.length > 0) {
        await this.dbManager.executeSql(
          `UPDATE muscleGroupRanks
           SET totalVolume = ?, updatedAt = ?
           WHERE userId = ? AND muscleGroup = ?`,
          [newTotalVolume, new Date().toISOString(), userId, muscleGroup]
        );
      } else {
        await this.dbManager.executeSql(
          `INSERT INTO muscleGroupRanks (userId, muscleGroup, rank, totalVolume, percentile, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, muscleGroup, 1, newTotalVolume, 0, new Date().toISOString(), new Date().toISOString()]
        );
      }

      return {
        userId,
        muscleGroup,
        rank: 1,
        totalVolume: newTotalVolume,
        percentile: 0,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.DatabaseError,
        `Failed to update muscle group rank: ${error}`
      );
    }
  }

  /**
   * Get muscle group rank for a user
   */
  async getMuscleGroupRank(
    userId: string,
    muscleGroup: string
  ): Promise<MuscleGroupRankData | null> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT userId, muscleGroup, rank, totalVolume, percentile, updatedAt
         FROM muscleGroupRanks
         WHERE userId = ? AND muscleGroup = ?`,
        [userId, muscleGroup]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0);

      return {
        userId: row.userId,
        muscleGroup: row.muscleGroup,
        rank: row.rank || 1,
        totalVolume: row.totalVolume,
        percentile: row.percentile || 0,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.DatabaseError,
        `Failed to get muscle group rank: ${error}`
      );
    }
  }

  /**
   * Get all muscle group ranks for a user
   */
  async getAllMuscleGroupRanks(userId: string): Promise<MuscleGroupRankData[]> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT userId, muscleGroup, rank, totalVolume, percentile, updatedAt
         FROM muscleGroupRanks
         WHERE userId = ?
         ORDER BY muscleGroup ASC`,
        [userId]
      );

      const ranks: MuscleGroupRankData[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        ranks.push({
          userId: row.userId,
          muscleGroup: row.muscleGroup,
          rank: row.rank || 1,
          totalVolume: row.totalVolume,
          percentile: row.percentile || 0,
          updatedAt: row.updatedAt,
        });
      }

      return ranks;
    } catch (error) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.DatabaseError,
        `Failed to get all muscle group ranks: ${error}`
      );
    }
  }

  /**
   * Calculate rank from percentile
   */
  calculateRankFromPercentile(percentile: number): number {
    if (percentile < 20) return 1;
    if (percentile < 40) return 2;
    if (percentile < 60) return 3;
    if (percentile < 80) return 4;
    return 5;
  }

  /**
   * Validate muscle group rank data
   */
  validateMuscleGroupRankData(
    muscleGroup: string,
    totalVolume: number,
    rank: number
  ): void {
    if (!MUSCLE_GROUPS.includes(muscleGroup)) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.InvalidMuscleGroup,
        `Invalid muscle group: ${muscleGroup}`
      );
    }

    if (totalVolume < 0) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.InvalidVolume,
        'Total volume cannot be negative'
      );
    }

    if (rank < 1 || rank > 5) {
      throw new MuscleGroupRankError(
        MuscleGroupRankErrorType.InvalidRank,
        'Rank must be between 1 and 5'
      );
    }
  }

  /**
   * Get all valid muscle groups
   */
  getValidMuscleGroups(): string[] {
    return MUSCLE_GROUPS;
  }
}

export default MuscleGroupRankService.getInstance();
