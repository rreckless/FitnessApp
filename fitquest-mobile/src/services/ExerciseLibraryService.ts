/**
 * Exercise Library Service
 * Handles exercise library management with local caching and fuzzy search
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/DatabaseService';
import { SyncEngine } from './SyncEngine';
import {
  Equipment,
  UserProfileException,
  UserProfileError,
} from '../models/UserProfileModels';
import { SyncOperation, SyncEntityType } from '../models/SyncModels';

/**
 * Exercise data model
 */
export interface Exercise {
  id: string;
  name: string;
  description: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  equipment?: Equipment[];
  formTips?: string[];
  videoUrl?: string;
  isCustom: boolean;
  userId?: string; // For custom exercises
  createdAt: string;
  updatedAt: string;
}

/**
 * Exercise search result
 */
export interface ExerciseSearchResult {
  exercises: Exercise[];
  totalCount: number;
  query: string;
  timestamp: string;
}

/**
 * Muscle group enum
 */
export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  SHOULDERS = 'SHOULDERS',
  ARMS = 'ARMS',
  LEGS = 'LEGS',
  CORE = 'CORE',
  CARDIO = 'CARDIO',
}

/**
 * Exercise library cache metadata
 */
export interface ExerciseLibraryCacheMetadata {
  lastUpdated: string;
  totalExercises: number;
  version: string;
}

export class ExerciseLibraryService {
  private static instance: ExerciseLibraryService;
  private db: DatabaseService;
  private syncEngine: SyncEngine;
  private currentUserId: string | null = null;
  private cacheMetadata: ExerciseLibraryCacheMetadata | null = null;

  private constructor(db: DatabaseService, syncEngine: SyncEngine) {
    this.db = db;
    this.syncEngine = syncEngine;
  }

  static getInstance(db?: DatabaseService, syncEngine?: SyncEngine): ExerciseLibraryService {
    if (!ExerciseLibraryService.instance) {
      if (!db || !syncEngine) {
        throw new UserProfileException(
          UserProfileError.DATABASE_ERROR,
          'DatabaseService and SyncEngine are required for initialization'
        );
      }
      ExerciseLibraryService.instance = new ExerciseLibraryService(db, syncEngine);
    }
    return ExerciseLibraryService.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    ExerciseLibraryService.instance = null as any;
  }

  /**
   * Set the current user ID
   */
  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Initialize exercise library with built-in exercises
   */
  async initializeLibrary(): Promise<void> {
    try {
      // Check if library is already initialized
      const results = await this.db.queryAll(
        `SELECT COUNT(*) as count FROM exercises WHERE isCustom = 0`,
        []
      );

      if (results.length > 0 && results[0].count > 0) {
        // Library already initialized
        await this.loadCacheMetadata();
        return;
      }

      // Initialize with built-in exercises
      const builtInExercises = this.getBuiltInExercises();

      for (const exercise of builtInExercises) {
        await this.db.insert('exercises', {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          primaryMuscleGroup: exercise.primaryMuscleGroup,
          secondaryMuscleGroups: JSON.stringify(exercise.secondaryMuscleGroups),
          difficulty: exercise.difficulty,
          isCustom: 0,
          createdAt: exercise.createdAt,
          updatedAt: exercise.updatedAt,
        });
      }

      // Update cache metadata
      const now = new Date().toISOString();
      this.cacheMetadata = {
        lastUpdated: now,
        totalExercises: builtInExercises.length,
        version: '1.0',
      };

      // Store metadata
      await this.db.insert('cache_metadata', {
        key: 'exercise_library',
        value: JSON.stringify(this.cacheMetadata),
        updatedAt: now,
      });
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to initialize exercise library',
        error
      );
    }
  }

  /**
   * Search exercises with fuzzy matching
   */
  async searchExercises(query: string, muscleGroup?: MuscleGroup): Promise<ExerciseSearchResult> {
    try {
      let sql = `SELECT * FROM exercises WHERE (name LIKE ? OR description LIKE ?)`;
      const params: any[] = [`%${query}%`, `%${query}%`];

      if (muscleGroup) {
        sql += ` AND (primaryMuscleGroup = ? OR secondaryMuscleGroups LIKE ?)`;
        params.push(muscleGroup, `%${muscleGroup}%`);
      }

      sql += ` ORDER BY name ASC LIMIT 50`;

      const results = await this.db.queryAll(sql, params);

      const exercises = results.map((row: any) => this.mapRowToExercise(row));

      return {
        exercises,
        totalCount: exercises.length,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to search exercises',
        error
      );
    }
  }

  /**
   * Get exercises by muscle group
   */
  async getExercisesByMuscleGroup(muscleGroup: MuscleGroup): Promise<Exercise[]> {
    try {
      const results = await this.db.queryAll(
        `SELECT * FROM exercises WHERE primaryMuscleGroup = ? OR secondaryMuscleGroups LIKE ? ORDER BY name ASC`,
        [muscleGroup, `%${muscleGroup}%`]
      );

      return results.map((row: any) => this.mapRowToExercise(row));
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get exercises by muscle group',
        error
      );
    }
  }

  /**
   * Get all exercises
   */
  async getAllExercises(): Promise<Exercise[]> {
    try {
      const results = await this.db.queryAll(
        `SELECT * FROM exercises WHERE isCustom = 0 ORDER BY name ASC`,
        []
      );

      return results.map((row: any) => this.mapRowToExercise(row));
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get all exercises',
        error
      );
    }
  }

  /**
   * Get exercise by ID
   */
  async getExerciseById(exerciseId: string): Promise<Exercise> {
    try {
      const results = await this.db.queryAll(
        `SELECT * FROM exercises WHERE id = ?`,
        [exerciseId]
      );

      if (results.length === 0) {
        throw new UserProfileException(
          UserProfileError.PROFILE_NOT_FOUND,
          `Exercise not found: ${exerciseId}`
        );
      }

      return this.mapRowToExercise(results[0]);
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get exercise',
        error
      );
    }
  }

  /**
   * Create custom exercise
   */
  async createCustomExercise(
    name: string,
    description: string,
    primaryMuscleGroup: MuscleGroup,
    secondaryMuscleGroups: MuscleGroup[] = [],
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' = 'BEGINNER'
  ): Promise<Exercise> {
    try {
      if (!this.currentUserId) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID set for custom exercise creation'
        );
      }

      const now = new Date().toISOString();
      const exercise: Exercise = {
        id: uuidv4(),
        name,
        description,
        primaryMuscleGroup,
        secondaryMuscleGroups,
        difficulty,
        isCustom: true,
        userId: this.currentUserId,
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await this.db.insert('exercises', {
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
        secondaryMuscleGroups: JSON.stringify(exercise.secondaryMuscleGroups),
        difficulty: exercise.difficulty,
        isCustom: 1,
        userId: exercise.userId,
        createdAt: exercise.createdAt,
        updatedAt: exercise.updatedAt,
      });

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.CREATE,
        SyncEntityType.EXERCISE,
        exercise.id,
        exercise
      );

      return exercise;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to create custom exercise',
        error
      );
    }
  }

  /**
   * Get user's custom exercises
   */
  async getUserCustomExercises(): Promise<Exercise[]> {
    try {
      if (!this.currentUserId) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID set'
        );
      }

      const results = await this.db.queryAll(
        `SELECT * FROM exercises WHERE isCustom = 1 AND userId = ? ORDER BY name ASC`,
        [this.currentUserId]
      );

      return results.map((row: any) => this.mapRowToExercise(row));
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get user custom exercises',
        error
      );
    }
  }

  /**
   * Delete custom exercise
   */
  async deleteCustomExercise(exerciseId: string): Promise<void> {
    try {
      if (!this.currentUserId) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID set'
        );
      }

      // Verify ownership
      const results = await this.db.queryAll(
        `SELECT * FROM exercises WHERE id = ? AND userId = ? AND isCustom = 1`,
        [exerciseId, this.currentUserId]
      );

      if (results.length === 0) {
        throw new UserProfileException(
          UserProfileError.PROFILE_NOT_FOUND,
          'Custom exercise not found or not owned by user'
        );
      }

      // Delete from database
      await this.db.delete('exercises', 'id = ?', [exerciseId]);

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.DELETE,
        SyncEntityType.EXERCISE,
        exerciseId,
        { id: exerciseId }
      );
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to delete custom exercise',
        error
      );
    }
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<ExerciseLibraryCacheMetadata | null> {
    try {
      if (this.cacheMetadata) {
        return this.cacheMetadata;
      }

      await this.loadCacheMetadata();
      return this.cacheMetadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load cache metadata from database
   */
  private async loadCacheMetadata(): Promise<void> {
    try {
      const results = await this.db.queryAll(
        `SELECT value FROM cache_metadata WHERE key = ?`,
        ['exercise_library']
      );

      if (results.length > 0) {
        this.cacheMetadata = JSON.parse(results[0].value);
      }
    } catch (error) {
      // Ignore errors loading metadata
    }
  }

  /**
   * Map database row to Exercise
   */
  private mapRowToExercise(row: any): Exercise {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      primaryMuscleGroup: row.primaryMuscleGroup,
      secondaryMuscleGroups: JSON.parse(row.secondaryMuscleGroups || '[]'),
      difficulty: row.difficulty,
      isCustom: row.isCustom === 1,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Get built-in exercises
   */
  private getBuiltInExercises(): Exercise[] {
    const now = new Date().toISOString();
    return [
      // Chest exercises
      {
        id: uuidv4(),
        name: 'Bench Press',
        description: 'Classic chest exercise using barbell',
        primaryMuscleGroup: MuscleGroup.CHEST,
        secondaryMuscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.ARMS],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.BARBELL],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Push-ups',
        description: 'Bodyweight chest exercise',
        primaryMuscleGroup: MuscleGroup.CHEST,
        secondaryMuscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.ARMS],
        difficulty: 'BEGINNER',
        equipment: [Equipment.BODYWEIGHT],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Dumbbell Flyes',
        description: 'Chest isolation exercise with dumbbells',
        primaryMuscleGroup: MuscleGroup.CHEST,
        secondaryMuscleGroups: [MuscleGroup.SHOULDERS],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.DUMBBELLS],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Back exercises
      {
        id: uuidv4(),
        name: 'Pull-ups',
        description: 'Bodyweight back exercise',
        primaryMuscleGroup: MuscleGroup.BACK,
        secondaryMuscleGroups: [MuscleGroup.ARMS],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.BODYWEIGHT],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Barbell Rows',
        description: 'Back exercise using barbell',
        primaryMuscleGroup: MuscleGroup.BACK,
        secondaryMuscleGroups: [MuscleGroup.ARMS],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.BARBELL],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Shoulder exercises
      {
        id: uuidv4(),
        name: 'Shoulder Press',
        description: 'Shoulder exercise using barbell or dumbbells',
        primaryMuscleGroup: MuscleGroup.SHOULDERS,
        secondaryMuscleGroups: [MuscleGroup.ARMS],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.BARBELL, Equipment.DUMBBELLS],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Arm exercises
      {
        id: uuidv4(),
        name: 'Bicep Curls',
        description: 'Arm exercise using dumbbells',
        primaryMuscleGroup: MuscleGroup.ARMS,
        secondaryMuscleGroups: [],
        difficulty: 'BEGINNER',
        equipment: [Equipment.DUMBBELLS],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Leg exercises
      {
        id: uuidv4(),
        name: 'Squats',
        description: 'Leg exercise using barbell',
        primaryMuscleGroup: MuscleGroup.LEGS,
        secondaryMuscleGroups: [MuscleGroup.CORE],
        difficulty: 'INTERMEDIATE',
        equipment: [Equipment.BARBELL, Equipment.BODYWEIGHT],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Deadlifts',
        description: 'Full body exercise using barbell',
        primaryMuscleGroup: MuscleGroup.LEGS,
        secondaryMuscleGroups: [MuscleGroup.BACK, MuscleGroup.CORE],
        difficulty: 'ADVANCED',
        equipment: [Equipment.BARBELL],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Core exercises
      {
        id: uuidv4(),
        name: 'Planks',
        description: 'Core stability exercise',
        primaryMuscleGroup: MuscleGroup.CORE,
        secondaryMuscleGroups: [MuscleGroup.SHOULDERS],
        difficulty: 'BEGINNER',
        equipment: [Equipment.BODYWEIGHT],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
      // Cardio exercises
      {
        id: uuidv4(),
        name: 'Running',
        description: 'Cardio exercise',
        primaryMuscleGroup: MuscleGroup.CARDIO,
        secondaryMuscleGroups: [MuscleGroup.LEGS],
        difficulty: 'BEGINNER',
        equipment: [Equipment.BODYWEIGHT],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}
