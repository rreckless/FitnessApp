import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logging/logger';

// MARK: - Types

export interface ExerciseSet {
  reps: number;
  weight: number; // in lbs
  rpe?: number; // Rate of Perceived Exertion (1-10)
  notes?: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroup: string;
  difficulty: string;
  sets: ExerciseSet[];
  totalVolume: number;
}

export interface Workout {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in seconds
  totalVolume: number;
  totalXP: number;
  exercises: WorkoutExercise[];
  notes?: string;
  isOfflineCreated: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkoutListResult {
  workouts: Workout[];
  total: number;
  page: number;
  pageSize: number;
}

// MARK: - Workout CRUD

/**
 * Create a new workout
 */
export async function createWorkout(data: {
  userId: string;
  startTime: string;
  exercises?: WorkoutExercise[];
  notes?: string;
  isOfflineCreated?: boolean;
}): Promise<Workout> {
  try {
    const workoutId = uuidv4();
    const now = new Date().toISOString();

    const result = await query(
      `INSERT INTO workouts (id, user_id, start_time, total_volume, total_xp, notes, 
                             is_offline_created, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id, start_time, end_time, duration, total_volume, total_xp,
                 notes, is_offline_created, synced_at, created_at, updated_at, deleted_at`,
      [
        workoutId,
        data.userId,
        data.startTime,
        0, // totalVolume
        0, // totalXP
        data.notes || null,
        data.isOfflineCreated ? true : false,
        now,
        now,
      ]
    );

    const workout = mapWorkoutRow(result.rows[0]);
    logger.info('Workout created', { workoutId, userId: data.userId });

    return workout;
  } catch (error) {
    logger.error('Failed to create workout', error as Error);
    throw error;
  }
}

/**
 * Get workout by ID
 */
export async function getWorkout(workoutId: string, userId: string): Promise<Workout | null> {
  try {
    const result = await query(
      `SELECT id, user_id, start_time, end_time, duration, total_volume, total_xp,
              notes, is_offline_created, synced_at, created_at, updated_at, deleted_at
       FROM workouts
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [workoutId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const workout = mapWorkoutRow(result.rows[0]);

    // Fetch exercises
    const exercisesResult = await query(
      `SELECT we.id, we.exercise_id, e.name, e.primary_muscle_group, e.difficulty, 
              we.sets, we.total_volume
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = $1
       ORDER BY we.exercise_order ASC`,
      [workoutId]
    );

    workout.exercises = exercisesResult.rows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseName: row.name,
      primaryMuscleGroup: row.primary_muscle_group,
      difficulty: row.difficulty,
      sets: row.sets || [],
      totalVolume: row.total_volume || 0,
    }));

    return workout;
  } catch (error) {
    logger.error('Failed to get workout', error as Error);
    throw error;
  }
}

/**
 * Get all workouts for a user
 */
export async function getWorkouts(
  userId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<WorkoutListResult> {
  try {
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM workouts WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const result = await query(
      `SELECT id, user_id, start_time, end_time, duration, total_volume, total_xp,
              notes, is_offline_created, synced_at, created_at, updated_at, deleted_at
       FROM workouts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    const workouts: Workout[] = [];

    for (const row of result.rows) {
      const workout = mapWorkoutRow(row);

      // Fetch exercises for each workout
      const exercisesResult = await query(
        `SELECT we.id, we.exercise_id, e.name, e.primary_muscle_group, e.difficulty, 
                we.sets, we.total_volume
         FROM workout_exercises we
         JOIN exercises e ON we.exercise_id = e.id
         WHERE we.workout_id = $1
         ORDER BY we.exercise_order ASC`,
        [workout.id]
      );

      workout.exercises = exercisesResult.rows.map((exRow) => ({
        id: exRow.id,
        exerciseId: exRow.exercise_id,
        exerciseName: exRow.name,
        primaryMuscleGroup: exRow.primary_muscle_group,
        difficulty: exRow.difficulty,
        sets: exRow.sets || [],
        totalVolume: exRow.total_volume || 0,
      }));

      workouts.push(workout);
    }

    return {
      workouts,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    logger.error('Failed to get workouts', error as Error);
    throw error;
  }
}

/**
 * Update a workout
 */
export async function updateWorkout(
  workoutId: string,
  userId: string,
  data: {
    endTime?: string;
    notes?: string;
  }
): Promise<Workout> {
  try {
    const now = new Date().toISOString();

    const result = await query(
      `UPDATE workouts
       SET end_time = COALESCE($1, end_time),
           notes = COALESCE($2, notes),
           updated_at = $3
       WHERE id = $4 AND user_id = $5 AND deleted_at IS NULL
       RETURNING id, user_id, start_time, end_time, duration, total_volume, total_xp,
                 notes, is_offline_created, synced_at, created_at, updated_at, deleted_at`,
      [data.endTime || null, data.notes || null, now, workoutId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Workout not found');
    }

    const workout = mapWorkoutRow(result.rows[0]);

    // Fetch exercises
    const exercisesResult = await query(
      `SELECT we.id, we.exercise_id, e.name, e.primary_muscle_group, e.difficulty, 
              we.sets, we.total_volume
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = $1
       ORDER BY we.exercise_order ASC`,
      [workoutId]
    );

    workout.exercises = exercisesResult.rows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseName: row.name,
      primaryMuscleGroup: row.primary_muscle_group,
      difficulty: row.difficulty,
      sets: row.sets || [],
      totalVolume: row.total_volume || 0,
    }));

    logger.info('Workout updated', { workoutId, userId });

    return workout;
  } catch (error) {
    logger.error('Failed to update workout', error as Error);
    throw error;
  }
}

/**
 * Delete a workout (soft delete)
 */
export async function deleteWorkout(workoutId: string, userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();

    const result = await query(
      `UPDATE workouts
       SET deleted_at = $1, updated_at = $2
       WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
       RETURNING id`,
      [now, now, workoutId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Workout not found');
    }

    logger.info('Workout deleted', { workoutId, userId });
  } catch (error) {
    logger.error('Failed to delete workout', error as Error);
    throw error;
  }
}

/**
 * Add exercise to workout
 */
export async function addExerciseToWorkout(
  workoutId: string,
  userId: string,
  data: {
    exerciseId: string;
    sets: ExerciseSet[];
  }
): Promise<WorkoutExercise> {
  try {
    // Verify workout exists
    const workoutResult = await query(
      'SELECT id FROM workouts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [workoutId, userId]
    );

    if (workoutResult.rows.length === 0) {
      throw new Error('Workout not found');
    }

    // Get exercise details
    const exerciseResult = await query(
      `SELECT id, name, primary_muscle_group, difficulty FROM exercises WHERE id = $1`,
      [data.exerciseId]
    );

    if (exerciseResult.rows.length === 0) {
      throw new Error('Exercise not found');
    }

    const exercise = exerciseResult.rows[0];

    // Calculate total volume
    const totalVolume = data.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

    // Get current exercise order
    const orderResult = await query(
      'SELECT MAX(exercise_order) as max_order FROM workout_exercises WHERE workout_id = $1',
      [workoutId]
    );

    const nextOrder = (orderResult.rows[0]?.max_order || -1) + 1;

    // Insert workout exercise
    const workoutExerciseId = uuidv4();
    const result = await query(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_order, sets, total_volume, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, exercise_id, total_volume`,
      [
        workoutExerciseId,
        workoutId,
        data.exerciseId,
        nextOrder,
        JSON.stringify(data.sets),
        totalVolume,
      ]
    );

    // Update workout total volume
    await query(
      `UPDATE workouts
       SET total_volume = total_volume + $1, updated_at = NOW()
       WHERE id = $2`,
      [totalVolume, workoutId]
    );

    logger.info('Exercise added to workout', { workoutId, exerciseId: data.exerciseId });

    return {
      id: result.rows[0].id,
      exerciseId: data.exerciseId,
      exerciseName: exercise.name,
      primaryMuscleGroup: exercise.primary_muscle_group,
      difficulty: exercise.difficulty,
      sets: data.sets,
      totalVolume,
    };
  } catch (error) {
    logger.error('Failed to add exercise to workout', error as Error);
    throw error;
  }
}

/**
 * Complete a workout (mark as finished and calculate XP)
 */
export async function completeWorkout(workoutId: string, userId: string): Promise<Workout> {
  try {
    const now = new Date().toISOString();

    // Get workout
    const workoutResult = await query(
      `SELECT id, total_volume FROM workouts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [workoutId, userId]
    );

    if (workoutResult.rows.length === 0) {
      throw new Error('Workout not found');
    }

    const totalVolume = workoutResult.rows[0].total_volume;

    // Calculate XP (will be done in a separate service)
    const xpEarned = Math.max(Math.floor(totalVolume / 100), 10);

    // Update workout
    const result = await query(
      `UPDATE workouts
       SET end_time = $1, total_xp = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, start_time, end_time, duration, total_volume, total_xp,
                 notes, is_offline_created, synced_at, created_at, updated_at, deleted_at`,
      [now, xpEarned, now, workoutId, userId]
    );

    const workout = mapWorkoutRow(result.rows[0]);

    // Fetch exercises
    const exercisesResult = await query(
      `SELECT we.id, we.exercise_id, e.name, e.primary_muscle_group, e.difficulty, 
              we.sets, we.total_volume
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = $1
       ORDER BY we.exercise_order ASC`,
      [workoutId]
    );

    workout.exercises = exercisesResult.rows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseName: row.name,
      primaryMuscleGroup: row.primary_muscle_group,
      difficulty: row.difficulty,
      sets: row.sets || [],
      totalVolume: row.total_volume || 0,
    }));

    logger.info('Workout completed', { workoutId, userId, xpEarned });

    return workout;
  } catch (error) {
    logger.error('Failed to complete workout', error as Error);
    throw error;
  }
}

// MARK: - Validation

/**
 * Validate set data against anti-cheat constraints
 */
export function validateSetData(set: ExerciseSet): void {
  // Max 50 reps per set
  if (set.reps > 50) {
    throw new Error('Max 50 reps per set');
  }

  // Weight between 1-1000 lbs
  if (set.weight < 1 || set.weight > 1000) {
    throw new Error('Weight must be between 1-1000 lbs');
  }

  // RPE between 1-10 if provided
  if (set.rpe !== undefined && (set.rpe < 1 || set.rpe > 10)) {
    throw new Error('RPE must be between 1-10');
  }
}

/**
 * Validate all sets in an exercise
 */
export function validateExerciseSets(sets: ExerciseSet[]): void {
  let totalReps = 0;

  for (const set of sets) {
    validateSetData(set);
    totalReps += set.reps;
  }

  // Max 100 reps per exercise
  if (totalReps > 100) {
    throw new Error('Max 100 reps per exercise');
  }
}

// MARK: - Helper Functions

/**
 * Map database row to Workout object
 */
function mapWorkoutRow(row: any): Workout {
  return {
    id: row.id,
    userId: row.user_id,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    totalVolume: row.total_volume || 0,
    totalXP: row.total_xp || 0,
    exercises: [],
    notes: row.notes,
    isOfflineCreated: row.is_offline_created || false,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
