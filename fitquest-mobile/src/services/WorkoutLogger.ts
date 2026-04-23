/**
 * WorkoutLogger Service - Handles workout logging with offline-first support
 * Manages workout creation, exercise tracking, set/rep/weight entry, and sync queue integration
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/DatabaseService';
import { SyncEngine } from './SyncEngine';
import { SyncOperation, SyncEntityType } from '../models/SyncModels';
import {
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutStatus,
  StartWorkoutRequest,
  AddExerciseRequest,
  AddSetRequest,
  UpdateSetRequest,
  CompleteWorkoutRequest,
  WorkoutResponse,
  WorkoutHistoryResponse,
  PaginationParams,
  ValidationResult,
  WorkoutLoggerException,
  WorkoutLoggerError,
  ANTI_CHEAT_CONSTRAINTS,
} from '../models/WorkoutModels';

export class WorkoutLogger {
  private static instance: WorkoutLogger;
  private currentWorkout: Workout | null = null;
  private db: DatabaseService;
  private syncEngine: SyncEngine;

  private constructor(db: DatabaseService, syncEngine: SyncEngine) {
    this.db = db;
    this.syncEngine = syncEngine;
  }

  static getInstance(db?: DatabaseService, syncEngine?: SyncEngine): WorkoutLogger {
    if (!WorkoutLogger.instance) {
      if (!db || !syncEngine) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.DATABASE_ERROR,
          'DatabaseService and SyncEngine are required for initialization'
        );
      }
      WorkoutLogger.instance = new WorkoutLogger(db, syncEngine);
    }
    return WorkoutLogger.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    WorkoutLogger.instance = null as any;
  }

  /**
   * Start a new workout session
   */
  async startWorkout(request: StartWorkoutRequest): Promise<Workout> {
    try {
      // Check if there's already an active workout
      if (this.currentWorkout && this.currentWorkout.status === WorkoutStatus.IN_PROGRESS) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.WORKOUT_ALREADY_STARTED,
          'A workout is already in progress. Complete or cancel it first.'
        );
      }

      const now = new Date().toISOString();
      const workoutId = uuidv4();

      const workout: Workout = {
        id: workoutId,
        userId: request.userId,
        startTime: now,
        totalVolume: 0,
        exercises: [],
        status: WorkoutStatus.IN_PROGRESS,
        notes: request.notes,
        createdAt: now,
        updatedAt: now,
      };

      // Save to local database
      await this.db.insert('workouts', {
        id: workout.id,
        userId: workout.userId,
        startTime: workout.startTime,
        totalVolume: workout.totalVolume,
        status: workout.status,
        notes: workout.notes || null,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt,
      });

      this.currentWorkout = workout;
      return workout;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to start workout',
        error
      );
    }
  }

  /**
   * Add an exercise to the current workout
   */
  async addExercise(request: AddExerciseRequest): Promise<WorkoutExercise> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout. Start a workout first.'
        );
      }

      const exerciseId = uuidv4();
      const now = new Date().toISOString();

      const exercise: WorkoutExercise = {
        id: exerciseId,
        workoutId: this.currentWorkout.id,
        exerciseId: request.exerciseId,
        exerciseName: request.exerciseName,
        sets: [],
        createdAt: now,
        updatedAt: now,
      };

      // Save to local database
      await this.db.insert('workout_exercises', {
        id: exercise.id,
        workoutId: exercise.workoutId,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sets: 0,
        reps: 0,
        weight: null,
        createdAt: exercise.createdAt,
        updatedAt: exercise.updatedAt,
      });

      // Add to current workout in memory
      this.currentWorkout.exercises.push(exercise);
      this.currentWorkout.updatedAt = now;

      return exercise;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to add exercise',
        error
      );
    }
  }

  /**
   * Add a set/rep/weight entry to an exercise
   */
  async addSet(request: AddSetRequest): Promise<WorkoutSet> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout. Start a workout first.'
        );
      }

      // Validate reps and weight
      const validation = this.validateSetEntry(request.reps, request.weight);
      if (!validation.isValid) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_SET,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      // Find the exercise
      const exercise = this.currentWorkout.exercises.find(
        (e) => e.exerciseId === request.exerciseId
      );
      if (!exercise) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_EXERCISE,
          'Exercise not found in current workout'
        );
      }

      // Check anti-cheat constraints for exercise
      const totalRepsForExercise = exercise.sets.reduce((sum, set) => sum + set.reps, 0);
      if (totalRepsForExercise + request.reps > ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_EXERCISE) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_REPS,
          `Total reps for this exercise would exceed ${ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_EXERCISE}`,
          { maxReps: ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_EXERCISE }
        );
      }

      const setId = uuidv4();
      const now = new Date().toISOString();
      const volume = request.weight * request.reps;

      const set: WorkoutSet = {
        id: setId,
        reps: request.reps,
        weight: request.weight,
        volume,
        notes: request.notes,
        createdAt: now,
      };

      // Save to local database
      await this.db.insert('workout_sets', {
        id: set.id,
        exerciseId: exercise.id,
        reps: set.reps,
        weight: set.weight,
        volume: set.volume,
        notes: set.notes || null,
        createdAt: set.createdAt,
      });

      // Update exercise in memory
      exercise.sets.push(set);
      exercise.updatedAt = now;

      // Update workout total volume
      this.currentWorkout.totalVolume += volume;
      this.currentWorkout.updatedAt = now;

      // Update workout in database
      await this.db.update(
        'workouts',
        { totalVolume: this.currentWorkout.totalVolume, updatedAt: now },
        'id = ?',
        [this.currentWorkout.id]
      );

      return set;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to add set',
        error
      );
    }
  }

  /**
   * Update a set entry
   */
  async updateSet(request: UpdateSetRequest): Promise<WorkoutSet> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout. Start a workout first.'
        );
      }

      // Find the set
      let targetSet: WorkoutSet | null = null;
      let targetExercise: WorkoutExercise | null = null;

      for (const exercise of this.currentWorkout.exercises) {
        const set = exercise.sets.find((s) => s.id === request.setId);
        if (set) {
          targetSet = set;
          targetExercise = exercise;
          break;
        }
      }

      if (!targetSet || !targetExercise) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_SET,
          'Set not found in current workout'
        );
      }

      const reps = request.reps ?? targetSet.reps;
      const weight = request.weight ?? targetSet.weight;

      // Validate new values
      const validation = this.validateSetEntry(reps, weight);
      if (!validation.isValid) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_SET,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      // Calculate old and new volumes
      const oldVolume = targetSet.volume;
      const newVolume = weight * reps;
      const volumeDifference = newVolume - oldVolume;

      const now = new Date().toISOString();

      // Update set in memory
      targetSet.reps = reps;
      targetSet.weight = weight;
      targetSet.volume = newVolume;
      if (request.notes !== undefined) {
        targetSet.notes = request.notes;
      }

      // Update in database
      await this.db.update(
        'workout_sets',
        { reps, weight, volume: newVolume, notes: targetSet.notes || null },
        'id = ?',
        [targetSet.id]
      );

      // Update workout total volume
      this.currentWorkout.totalVolume += volumeDifference;
      this.currentWorkout.updatedAt = now;

      await this.db.update(
        'workouts',
        { totalVolume: this.currentWorkout.totalVolume, updatedAt: now },
        'id = ?',
        [this.currentWorkout.id]
      );

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.WORKOUT,
        targetSet.id,
        targetSet
      );

      return targetSet;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to update set',
        error
      );
    }
  }

  /**
   * Delete a set entry
   */
  async deleteSet(setId: string): Promise<void> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout. Start a workout first.'
        );
      }

      // Find and remove the set
      let targetSet: WorkoutSet | null = null;
      let targetExercise: WorkoutExercise | null = null;

      for (const exercise of this.currentWorkout.exercises) {
        const setIndex = exercise.sets.findIndex((s) => s.id === setId);
        if (setIndex !== -1) {
          targetSet = exercise.sets[setIndex];
          targetExercise = exercise;
          exercise.sets.splice(setIndex, 1);
          break;
        }
      }

      if (!targetSet || !targetExercise) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.INVALID_SET,
          'Set not found in current workout'
        );
      }

      const now = new Date().toISOString();

      // Delete from database
      await this.db.delete('workout_sets', 'id = ?', [setId]);

      // Update workout total volume
      this.currentWorkout.totalVolume -= targetSet.volume;
      this.currentWorkout.updatedAt = now;

      await this.db.update(
        'workouts',
        { totalVolume: this.currentWorkout.totalVolume, updatedAt: now },
        'id = ?',
        [this.currentWorkout.id]
      );

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.DELETE,
        SyncEntityType.WORKOUT,
        setId,
        { id: setId }
      );
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to delete set',
        error
      );
    }
  }

  /**
   * Complete the current workout
   */
  async completeWorkout(request?: CompleteWorkoutRequest): Promise<Workout> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout to complete'
        );
      }

      const now = new Date().toISOString();
      const endTime = now;
      const startTime = new Date(this.currentWorkout.startTime);
      const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);

      // Update workout
      this.currentWorkout.endTime = endTime;
      this.currentWorkout.duration = duration;
      this.currentWorkout.status = WorkoutStatus.COMPLETED;
      if (request?.notes) {
        this.currentWorkout.notes = request.notes;
      }
      this.currentWorkout.updatedAt = now;

      // Save to database
      await this.db.update(
        'workouts',
        {
          endTime: this.currentWorkout.endTime,
          duration: this.currentWorkout.duration,
          status: this.currentWorkout.status,
          notes: this.currentWorkout.notes || null,
          updatedAt: this.currentWorkout.updatedAt,
        },
        'id = ?',
        [this.currentWorkout.id]
      );

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.CREATE,
        SyncEntityType.WORKOUT,
        this.currentWorkout.id,
        this.currentWorkout
      );

      const completedWorkout = { ...this.currentWorkout };
      this.currentWorkout = null;

      return completedWorkout;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to complete workout',
        error
      );
    }
  }

  /**
   * Cancel the current workout without saving
   */
  async cancelWorkout(): Promise<void> {
    try {
      if (!this.currentWorkout) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.NO_ACTIVE_WORKOUT,
          'No active workout to cancel'
        );
      }

      // Delete from database
      await this.db.delete('workouts', 'id = ?', [this.currentWorkout.id]);

      // Delete associated exercises and sets
      for (const exercise of this.currentWorkout.exercises) {
        await this.db.delete('workout_sets', 'exerciseId = ?', [exercise.id]);
        await this.db.delete('workout_exercises', 'id = ?', [exercise.id]);
      }

      this.currentWorkout = null;
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to cancel workout',
        error
      );
    }
  }

  /**
   * Get the current active workout
   */
  getCurrentWorkout(): Workout | null {
    return this.currentWorkout;
  }

  /**
   * Get workout history with pagination
   */
  async getWorkoutHistory(params: PaginationParams): Promise<WorkoutHistoryResponse> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new WorkoutLoggerException(
          WorkoutLoggerError.DATABASE_ERROR,
          'No authenticated user'
        );
      }

      // Get total count
      const countResult = await this.db.queryAll(
        `SELECT COUNT(*) as count FROM workouts WHERE userId = ? AND status = ?`,
        [userId, WorkoutStatus.COMPLETED]
      );
      const total = countResult[0]?.count || 0;

      // Get paginated workouts
      const results = await this.db.queryAll(
        `SELECT * FROM workouts 
         WHERE userId = ? AND status = ? 
         ORDER BY createdAt DESC 
         LIMIT ? OFFSET ?`,
        [userId, WorkoutStatus.COMPLETED, params.limit, params.offset]
      );

      const workouts: Workout[] = [];
      for (const row of results) {
        const workout = await this.loadWorkoutWithExercises(row.id);
        if (workout) {
          workouts.push(workout);
        }
      }

      return {
        workouts,
        total,
        limit: params.limit,
        offset: params.offset,
      };
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to get workout history',
        error
      );
    }
  }

  /**
   * Get a specific workout by ID
   */
  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    try {
      return await this.loadWorkoutWithExercises(workoutId);
    } catch (error) {
      if (error instanceof WorkoutLoggerException) {
        throw error;
      }
      throw new WorkoutLoggerException(
        WorkoutLoggerError.DATABASE_ERROR,
        'Failed to get workout',
        error
      );
    }
  }

  /**
   * Validate set entry (reps and weight)
   */
  private validateSetEntry(reps: number, weight: number): ValidationResult {
    const errors: string[] = [];

    if (!Number.isInteger(reps) || reps < 1) {
      errors.push('Reps must be a positive integer');
    }

    if (reps > ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_SET) {
      errors.push(
        `Reps cannot exceed ${ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_SET} per set`
      );
    }

    if (weight < ANTI_CHEAT_CONSTRAINTS.MIN_WEIGHT) {
      errors.push(
        `Weight must be at least ${ANTI_CHEAT_CONSTRAINTS.MIN_WEIGHT} lbs`
      );
    }

    if (weight > ANTI_CHEAT_CONSTRAINTS.MAX_WEIGHT) {
      errors.push(
        `Weight cannot exceed ${ANTI_CHEAT_CONSTRAINTS.MAX_WEIGHT} lbs`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load a workout with all its exercises and sets
   */
  private async loadWorkoutWithExercises(workoutId: string): Promise<Workout | null> {
    const workoutRows = await this.db.queryAll(
      `SELECT * FROM workouts WHERE id = ?`,
      [workoutId]
    );

    if (workoutRows.length === 0) {
      return null;
    }

    const workoutRow = workoutRows[0];

    // Load exercises
    const exerciseRows = await this.db.queryAll(
      `SELECT * FROM workout_exercises WHERE workoutId = ?`,
      [workoutId]
    );

    const exercises: WorkoutExercise[] = [];
    for (const exerciseRow of exerciseRows) {
      // Load sets for this exercise
      const setRows = await this.db.queryAll(
        `SELECT * FROM workout_sets WHERE exerciseId = ?`,
        [exerciseRow.id]
      );

      const sets: WorkoutSet[] = setRows.map((setRow) => ({
        id: setRow.id,
        reps: setRow.reps,
        weight: setRow.weight,
        volume: setRow.volume,
        notes: setRow.notes,
        createdAt: setRow.createdAt,
      }));

      exercises.push({
        id: exerciseRow.id,
        workoutId: exerciseRow.workoutId,
        exerciseId: exerciseRow.exerciseId,
        exerciseName: exerciseRow.exerciseName,
        sets,
        createdAt: exerciseRow.createdAt,
        updatedAt: exerciseRow.updatedAt,
      });
    }

    return {
      id: workoutRow.id,
      userId: workoutRow.userId,
      startTime: workoutRow.startTime,
      endTime: workoutRow.endTime,
      duration: workoutRow.duration,
      totalVolume: workoutRow.totalVolume,
      totalXP: workoutRow.totalXP,
      exercises,
      status: workoutRow.status,
      notes: workoutRow.notes,
      createdAt: workoutRow.createdAt,
      updatedAt: workoutRow.updatedAt,
      syncedAt: workoutRow.syncedAt,
    };
  }

  /**
   * Get current user ID from session
   */
  private async getCurrentUserId(): Promise<string | null> {
    // This would be implemented to get from AuthenticationService
    // For now, return from current workout if available
    return this.currentWorkout?.userId || null;
  }
}

export default WorkoutLogger;
