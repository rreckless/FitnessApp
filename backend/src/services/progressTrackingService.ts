import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger';

// MARK: - Types

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  weight: number; // in lbs
  reps: number;
  recordedAt: string;
  createdAt: string;
}

export interface VolumeData {
  period: 'workout' | 'week' | 'month';
  totalVolume: number;
  startDate: string;
  endDate: string;
  exerciseBreakdown: Array<{
    exerciseId: string;
    exerciseName: string;
    volume: number;
  }>;
}

export interface VolumeTrend {
  date: string;
  volume: number;
}

// MARK: - Personal Records

/**
 * Get or create a personal record for an exercise
 */
export async function getOrCreatePersonalRecord(
  userId: string,
  exerciseId: string
): Promise<PersonalRecord | null> {
  try {
    const result = await query(
      `SELECT pr.id, pr.user_id, pr.exercise_id, e.name as exercise_name, 
              pr.weight, pr.reps, pr.recorded_at, pr.created_at
       FROM personal_records pr
       JOIN exercises e ON pr.exercise_id = e.id
       WHERE pr.user_id = $1 AND pr.exercise_id = $2
       ORDER BY pr.weight DESC, pr.reps DESC
       LIMIT 1`,
      [userId, exerciseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapPersonalRecordRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get personal record', error as Error);
    throw error;
  }
}

/**
 * Update personal record if new weight/reps exceed previous
 */
export async function updatePersonalRecordIfNeeded(
  userId: string,
  exerciseId: string,
  weight: number,
  reps: number
): Promise<{ updated: boolean; pr: PersonalRecord }> {
  try {
    const existingPR = await getOrCreatePersonalRecord(userId, exerciseId);

    // Check if new weight exceeds existing PR
    const shouldUpdate =
      !existingPR || weight > existingPR.weight || (weight === existingPR.weight && reps > existingPR.reps);

    if (shouldUpdate) {
      const prId = existingPR?.id || uuidv4();
      const now = new Date().toISOString();

      if (existingPR) {
        // Update existing PR
        await query(
          `UPDATE personal_records 
           SET weight = $1, reps = $2, recorded_at = $3, updated_at = $4
           WHERE id = $5`,
          [weight, reps, now, now, prId]
        );
      } else {
        // Create new PR
        await query(
          `INSERT INTO personal_records (id, user_id, exercise_id, weight, reps, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [prId, userId, exerciseId, weight, reps, now, now]
        );
      }

      const updatedPR = await getOrCreatePersonalRecord(userId, exerciseId);
      logger.info('Personal record updated', { userId, exerciseId, weight, reps });

      return { updated: true, pr: updatedPR! };
    }

    return { updated: false, pr: existingPR! };
  } catch (error) {
    logger.error('Failed to update personal record', error as Error);
    throw error;
  }
}

/**
 * Get all personal records for a user
 */
export async function getUserPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  try {
    const result = await query(
      `SELECT pr.id, pr.user_id, pr.exercise_id, e.name as exercise_name,
              pr.weight, pr.reps, pr.recorded_at, pr.created_at
       FROM personal_records pr
       JOIN exercises e ON pr.exercise_id = e.id
       WHERE pr.user_id = $1
       ORDER BY pr.recorded_at DESC`,
      [userId]
    );

    return result.rows.map(mapPersonalRecordRow);
  } catch (error) {
    logger.error('Failed to get user personal records', error as Error);
    throw error;
  }
}

/**
 * Get PR history for a specific exercise
 */
export async function getExercisePRHistory(userId: string, exerciseId: string): Promise<PersonalRecord[]> {
  try {
    const result = await query(
      `SELECT pr.id, pr.user_id, pr.exercise_id, e.name as exercise_name,
              pr.weight, pr.reps, pr.recorded_at, pr.created_at
       FROM personal_records pr
       JOIN exercises e ON pr.exercise_id = e.id
       WHERE pr.user_id = $1 AND pr.exercise_id = $2
       ORDER BY pr.recorded_at DESC`,
      [userId, exerciseId]
    );

    return result.rows.map(mapPersonalRecordRow);
  } catch (error) {
    logger.error('Failed to get exercise PR history', error as Error);
    throw error;
  }
}

// MARK: - Volume Calculations

/**
 * Calculate total volume for a workout
 */
export async function calculateWorkoutVolume(workoutId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COALESCE(SUM(total_volume), 0) as total_volume
       FROM workout_exercises
       WHERE workout_id = $1`,
      [workoutId]
    );

    return result.rows[0].total_volume || 0;
  } catch (error) {
    logger.error('Failed to calculate workout volume', error as Error);
    throw error;
  }
}

/**
 * Calculate total volume for a week
 */
export async function calculateWeeklyVolume(userId: string, startDate: string): Promise<VolumeData> {
  try {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const result = await query(
      `SELECT 
        e.id as exercise_id,
        e.name as exercise_name,
        COALESCE(SUM(we.total_volume), 0) as volume
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY e.id, e.name
       ORDER BY volume DESC`,
      [userId, start.toISOString(), end.toISOString()]
    );

    const totalVolume = result.rows.reduce((sum: number, row: any) => sum + (row.volume || 0), 0);

    return {
      period: 'week',
      totalVolume,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      exerciseBreakdown: result.rows.map((row: any) => ({
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        volume: row.volume,
      })),
    };
  } catch (error) {
    logger.error('Failed to calculate weekly volume', error as Error);
    throw error;
  }
}

/**
 * Calculate total volume for a month
 */
export async function calculateMonthlyVolume(userId: string, year: number, month: number): Promise<VolumeData> {
  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const result = await query(
      `SELECT 
        e.id as exercise_id,
        e.name as exercise_name,
        COALESCE(SUM(we.total_volume), 0) as volume
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY e.id, e.name
       ORDER BY volume DESC`,
      [userId, start.toISOString(), end.toISOString()]
    );

    const totalVolume = result.rows.reduce((sum: number, row: any) => sum + (row.volume || 0), 0);

    return {
      period: 'month',
      totalVolume,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      exerciseBreakdown: result.rows.map((row: any) => ({
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        volume: row.volume,
      })),
    };
  } catch (error) {
    logger.error('Failed to calculate monthly volume', error as Error);
    throw error;
  }
}

/**
 * Get volume trends over time (daily aggregation)
 */
export async function getVolumeTrends(
  userId: string,
  startDate: string,
  endDate: string
): Promise<VolumeTrend[]> {
  try {
    const result = await query(
      `SELECT 
        DATE(w.start_time) as date,
        COALESCE(SUM(we.total_volume), 0) as volume
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY DATE(w.start_time)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    return result.rows.map((row: any) => ({
      date: row.date,
      volume: row.volume,
    }));
  } catch (error) {
    logger.error('Failed to get volume trends', error as Error);
    throw error;
  }
}

/**
 * Get volume by muscle group for a date range
 */
export async function getVolumeByMuscleGroup(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ muscleGroup: string; volume: number }>> {
  try {
    const result = await query(
      `SELECT 
        e.primary_muscle_group as muscle_group,
        COALESCE(SUM(we.total_volume), 0) as volume
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY e.primary_muscle_group
       ORDER BY volume DESC`,
      [userId, startDate, endDate]
    );

    return result.rows.map((row: any) => ({
      muscleGroup: row.muscle_group,
      volume: row.volume,
    }));
  } catch (error) {
    logger.error('Failed to get volume by muscle group', error as Error);
    throw error;
  }
}

// MARK: - Helpers

function mapPersonalRecordRow(row: any): PersonalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    weight: row.weight,
    reps: row.reps,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}


// MARK: - Chart Generation

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }>;
}

/**
 * Generate a line chart for XP progression over time
 */
export async function generateXPProgressionChart(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ChartData> {
  try {
    const result = await query(
      `SELECT 
        DATE(w.start_time) as date,
        COALESCE(SUM(w.total_xp), 0) as daily_xp,
        COALESCE(SUM(SUM(w.total_xp)) OVER (ORDER BY DATE(w.start_time)), 0) as cumulative_xp
       FROM workouts w
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY DATE(w.start_time)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    const labels = result.rows.map((row: any) => row.date);
    const dailyXP = result.rows.map((row: any) => row.daily_xp);
    const cumulativeXP = result.rows.map((row: any) => row.cumulative_xp);

    return {
      type: 'line',
      title: 'XP Progression Over Time',
      labels,
      datasets: [
        {
          label: 'Daily XP',
          data: dailyXP,
          borderColor: '#3b82f6',
          fill: false,
        },
        {
          label: 'Cumulative XP',
          data: cumulativeXP,
          borderColor: '#10b981',
          fill: false,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to generate XP progression chart', error as Error);
    throw error;
  }
}

/**
 * Generate a bar chart for volume by muscle group
 */
export async function generateVolumeMuscleGroupChart(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ChartData> {
  try {
    const volumeByMuscleGroup = await getVolumeByMuscleGroup(userId, startDate, endDate);

    const colors = [
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#22c55e', // green
      '#3b82f6', // blue
      '#8b5cf6', // purple
    ];

    return {
      type: 'bar',
      title: 'Volume by Muscle Group',
      labels: volumeByMuscleGroup.map((mg) => mg.muscleGroup),
      datasets: [
        {
          label: 'Volume (lbs)',
          data: volumeByMuscleGroup.map((mg) => mg.volume),
          backgroundColor: volumeByMuscleGroup.map((_, i) => colors[i % colors.length]),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to generate volume muscle group chart', error as Error);
    throw error;
  }
}

/**
 * Generate a pie chart for exercise distribution
 */
export async function generateExerciseDistributionChart(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ChartData> {
  try {
    const result = await query(
      `SELECT 
        e.name as exercise_name,
        COALESCE(SUM(we.total_volume), 0) as volume
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       WHERE w.user_id = $1 
         AND w.start_time >= $2 
         AND w.start_time < $3
         AND w.deleted_at IS NULL
       GROUP BY e.name
       ORDER BY volume DESC
       LIMIT 10`,
      [userId, startDate, endDate]
    );

    const colors = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f59e0b',
      '#6366f1',
    ];

    return {
      type: 'pie',
      title: 'Top 10 Exercises by Volume',
      labels: result.rows.map((row: any) => row.exercise_name),
      datasets: [
        {
          label: 'Volume (lbs)',
          data: result.rows.map((row: any) => row.volume),
          backgroundColor: result.rows.map((_: any, i: number) => colors[i % colors.length]),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to generate exercise distribution chart', error as Error);
    throw error;
  }
}

/**
 * Generate a line chart for PR progression for a specific exercise
 */
export async function generatePRProgressionChart(userId: string, exerciseId: string): Promise<ChartData> {
  try {
    const history = await getExercisePRHistory(userId, exerciseId);

    if (history.length === 0) {
      return {
        type: 'line',
        title: 'No PR History',
        labels: [],
        datasets: [],
      };
    }

    const labels = history.map((pr) => new Date(pr.recordedAt).toLocaleDateString());
    const weights = history.map((pr) => pr.weight);

    return {
      type: 'line',
      title: `PR Progression - ${history[0].exerciseName}`,
      labels,
      datasets: [
        {
          label: 'Weight (lbs)',
          data: weights,
          borderColor: '#ef4444',
          fill: false,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to generate PR progression chart', error as Error);
    throw error;
  }
}
