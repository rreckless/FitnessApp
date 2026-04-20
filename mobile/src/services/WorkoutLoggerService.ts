import uuid from 'react-native-uuid';
import DatabaseManager from '@database/DatabaseManager';
import SyncEngine from './SyncEngine';
import type {
  ExerciseSet,
  WorkoutExerciseEntry,
  WorkoutSession,
} from '@types/index';
import { WorkoutLoggerError, WorkoutLoggerErrorType } from '@types/index';

const uuidv4 = uuid.v4;

export class WorkoutLoggerService {
  private static instance: WorkoutLoggerService;
  private dbManager = DatabaseManager;
  private syncEngine = SyncEngine;

  private constructor() {}

  static getInstance(): WorkoutLoggerService {
    if (!WorkoutLoggerService.instance) {
      WorkoutLoggerService.instance = new WorkoutLoggerService();
    }
    return WorkoutLoggerService.instance;
  }

  /**
   * Start a new workout session
   */
  startWorkout(userId: string): WorkoutSession {
    const workoutId = uuidv4() as string;
    const now = new Date();

    return {
      id: workoutId,
      userId,
      startTime: now,
      endTime: undefined,
      exercises: [],
      notes: undefined,
      isOfflineCreated: true,
      syncedAt: undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    };
  }

  /**
   * Add an exercise to the current workout
   */
  addExercise(
    workout: WorkoutSession,
    exerciseId: string,
    exerciseName: string,
    primaryMuscleGroup: string,
    difficulty: string
  ): WorkoutSession {
    const entry: WorkoutExerciseEntry = {
      exerciseId,
      exerciseName,
      primaryMuscleGroup,
      difficulty,
      sets: [],
    };

    return {
      ...workout,
      exercises: [...workout.exercises, entry],
      updatedAt: new Date(),
    };
  }

  /**
   * Add a set to an exercise in the workout
   */
  addSet(
    workout: WorkoutSession,
    exerciseIndex: number,
    reps: number,
    weight: number,
    rpe?: number,
    notes?: string
  ): WorkoutSession {
    if (exerciseIndex < 0 || exerciseIndex >= workout.exercises.length) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.InvalidExerciseIndex,
        'Invalid exercise index'
      );
    }

    // Validate anti-cheat constraints
    this.validateSetData(reps, weight);

    const set: ExerciseSet = { reps, weight, rpe, notes };
    const updatedExercises = [...workout.exercises];
    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      sets: [...updatedExercises[exerciseIndex].sets, set],
    };

    return {
      ...workout,
      exercises: updatedExercises,
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate total volume for a workout
   */
  calculateTotalVolume(workout: WorkoutSession): number {
    return workout.exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      return total + exerciseVolume;
    }, 0);
  }

  /**
   * Calculate duration in seconds
   */
  calculateDuration(workout: WorkoutSession): number | undefined {
    if (!workout.endTime) return undefined;
    return Math.floor((workout.endTime.getTime() - workout.startTime.getTime()) / 1000);
  }

  /**
   * Complete a workout session
   */
  async completeWorkout(workout: WorkoutSession): Promise<WorkoutSession> {
    if (workout.exercises.length === 0) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.NoExercisesLogged,
        'No exercises logged in workout'
      );
    }

    const now = new Date();
    const completedWorkout: WorkoutSession = {
      ...workout,
      endTime: now,
      updatedAt: now,
    };

    // Save to local database
    await this.saveWorkoutLocally(completedWorkout);

    // Add to sync queue
    await this.syncEngine.queueOperation(
      workout.userId,
      'CREATE',
      'WORKOUT',
      workout.id,
      JSON.stringify(completedWorkout)
    );

    return completedWorkout;
  }

  /**
   * Save workout to local database
   */
  private async saveWorkoutLocally(workout: WorkoutSession): Promise<void> {
    try {
      const totalVolume = this.calculateTotalVolume(workout);
      const duration = this.calculateDuration(workout);

      // Insert workout
      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO workouts (
          id, userId, startTime, endTime, duration, totalVolume, totalXP,
          notes, isOfflineCreated, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workout.id,
          workout.userId,
          workout.startTime.toISOString(),
          workout.endTime?.toISOString() || null,
          duration || 0,
          totalVolume,
          0, // XP will be calculated on server
          workout.notes || null,
          workout.isOfflineCreated ? 1 : 0,
          workout.createdAt.toISOString(),
          workout.updatedAt.toISOString(),
        ]
      );

      // Insert workout exercises
      for (let index = 0; index < workout.exercises.length; index++) {
        const exercise = workout.exercises[index];
        const exerciseId = uuidv4() as string;
        const setsJSON = JSON.stringify(exercise.sets);
        const exerciseVolume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

        await this.dbManager.executeSql(
          `INSERT INTO workout_exercises (
            id, workoutId, exerciseId, exerciseOrder, sets, totalVolume, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exerciseId,
            workout.id,
            exercise.exerciseId,
            index,
            setsJSON,
            exerciseVolume,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }
    } catch (error) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.DatabaseError,
        `Failed to save workout: ${error}`
      );
    }
  }

  /**
   * Retrieve a workout by ID
   */
  async getWorkout(id: string, userId: string): Promise<WorkoutSession | null> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id, userId, startTime, endTime, duration, totalVolume, totalXP,
                notes, isOfflineCreated, syncedAt, createdAt, updatedAt, deletedAt
         FROM workouts
         WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0);

      // Fetch exercises for this workout
      const exercisesResult = await this.dbManager.executeSql(
        `SELECT we.id, we.exerciseId, e.name, e.primaryMuscleGroup, e.difficulty, we.sets
         FROM workout_exercises we
         JOIN exercises e ON we.exerciseId = e.id
         WHERE we.workoutId = ?
         ORDER BY we.exerciseOrder`,
        [id]
      );

      const exercises: WorkoutExerciseEntry[] = [];
      for (let i = 0; i < exercisesResult.rows.length; i++) {
        const exerciseRow = exercisesResult.rows.item(i);
        const sets = JSON.parse(exerciseRow.sets || '[]');

        exercises.push({
          exerciseId: exerciseRow.exerciseId,
          exerciseName: exerciseRow.name,
          primaryMuscleGroup: exerciseRow.primaryMuscleGroup,
          difficulty: exerciseRow.difficulty,
          sets,
        });
      }

      return {
        id: row.id,
        userId: row.userId,
        startTime: new Date(row.startTime),
        endTime: row.endTime ? new Date(row.endTime) : undefined,
        exercises,
        notes: row.notes,
        isOfflineCreated: row.isOfflineCreated === 1,
        syncedAt: row.syncedAt ? new Date(row.syncedAt) : undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : undefined,
      };
    } catch (error) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.DatabaseError,
        `Failed to get workout: ${error}`
      );
    }
  }

  /**
   * Get all workouts for a user
   */
  async getWorkouts(userId: string, limit: number = 50, offset: number = 0): Promise<WorkoutSession[]> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id, userId, startTime, endTime, duration, totalVolume, totalXP,
                notes, isOfflineCreated, syncedAt, createdAt, updatedAt, deletedAt
         FROM workouts
         WHERE userId = ? AND deletedAt IS NULL
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const workouts: WorkoutSession[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        const workoutId = row.id;

        // Fetch exercises for this workout
        const exercisesResult = await this.dbManager.executeSql(
          `SELECT we.id, we.exerciseId, e.name, e.primaryMuscleGroup, e.difficulty, we.sets
           FROM workout_exercises we
           JOIN exercises e ON we.exerciseId = e.id
           WHERE we.workoutId = ?
           ORDER BY we.exerciseOrder`,
          [workoutId]
        );

        const exercises: WorkoutExerciseEntry[] = [];
        for (let j = 0; j < exercisesResult.rows.length; j++) {
          const exerciseRow = exercisesResult.rows.item(j);
          const sets = JSON.parse(exerciseRow.sets || '[]');

          exercises.push({
            exerciseId: exerciseRow.exerciseId,
            exerciseName: exerciseRow.name,
            primaryMuscleGroup: exerciseRow.primaryMuscleGroup,
            difficulty: exerciseRow.difficulty,
            sets,
          });
        }

        workouts.push({
          id: row.id,
          userId: row.userId,
          startTime: new Date(row.startTime),
          endTime: row.endTime ? new Date(row.endTime) : undefined,
          exercises,
          notes: row.notes,
          isOfflineCreated: row.isOfflineCreated === 1,
          syncedAt: row.syncedAt ? new Date(row.syncedAt) : undefined,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          deletedAt: row.deletedAt ? new Date(row.deletedAt) : undefined,
        });
      }

      return workouts;
    } catch (error) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.DatabaseError,
        `Failed to get workouts: ${error}`
      );
    }
  }

  /**
   * Update a workout
   */
  async updateWorkout(workout: WorkoutSession): Promise<void> {
    try {
      const totalVolume = this.calculateTotalVolume(workout);
      const duration = this.calculateDuration(workout);

      await this.dbManager.executeSql(
        `UPDATE workouts SET
          endTime = ?, duration = ?, totalVolume = ?, notes = ?, updatedAt = ?
         WHERE id = ? AND userId = ?`,
        [
          workout.endTime?.toISOString() || null,
          duration || 0,
          totalVolume,
          workout.notes || null,
          new Date().toISOString(),
          workout.id,
          workout.userId,
        ]
      );

      // Queue for sync
      await this.syncEngine.queueOperation(
        workout.userId,
        'UPDATE',
        'WORKOUT',
        workout.id,
        JSON.stringify(workout)
      );
    } catch (error) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.DatabaseError,
        `Failed to update workout: ${error}`
      );
    }
  }

  /**
   * Delete a workout (soft delete)
   */
  async deleteWorkout(id: string, userId: string): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `UPDATE workouts SET deletedAt = ? WHERE id = ? AND userId = ?`,
        [new Date().toISOString(), id, userId]
      );

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'DELETE', 'WORKOUT', id);
    } catch (error) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.DatabaseError,
        `Failed to delete workout: ${error}`
      );
    }
  }

  /**
   * Validate set data against anti-cheat constraints
   */
  private validateSetData(reps: number, weight: number): void {
    // Reps must be at least 1
    if (reps < 1) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.AntiCheatViolation,
        'Reps must be at least 1'
      );
    }

    // Max 50 reps per set
    if (reps > 50) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.AntiCheatViolation,
        'Max 50 reps per set'
      );
    }

    // Weight between 1-1000 lbs
    if (weight < 1 || weight > 1000) {
      throw new WorkoutLoggerError(
        WorkoutLoggerErrorType.AntiCheatViolation,
        'Weight must be between 1-1000 lbs'
      );
    }
  }
}

export default WorkoutLoggerService.getInstance();
