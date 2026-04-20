import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise, ExerciseError, ExerciseErrorType } from '@types/index';
import Config from '@config/Config';
import AuthenticationService from './AuthenticationService';
import DatabaseManager from '@database/DatabaseManager';

export interface ExerciseSearchResponse {
  exercises: Exercise[];
  total: number;
  page: number;
  pageSize: number;
}

export class ExerciseLibraryService {
  private static instance: ExerciseLibraryService;
  private api: AxiosInstance;
  private authService = AuthenticationService;
  private dbManager = DatabaseManager;

  private exercises: Exercise[] = [];
  private lastSyncTime: Date | null = null;

  private constructor() {
    this.api = axios.create({
      baseURL: Config.apiBaseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor
    this.api.interceptors.request.use(async (config) => {
      const token = await this.authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.loadLastSyncTime();
  }

  static getInstance(): ExerciseLibraryService {
    if (!ExerciseLibraryService.instance) {
      ExerciseLibraryService.instance = new ExerciseLibraryService();
    }
    return ExerciseLibraryService.instance;
  }

  /**
   * Search exercises with fuzzy matching
   */
  async searchExercises(query: string): Promise<Exercise[]> {
    try {
      // Try online search first
      if (this.isNetworkAvailable()) {
        const encodedQuery = encodeURIComponent(query);
        const response = await this.api.get<ExerciseSearchResponse>(`/exercises?search=${encodedQuery}`);

        // Cache results locally
        await this.cacheExercises(response.data.exercises);

        this.exercises = response.data.exercises;
        return response.data.exercises;
      } else {
        // Fall back to local search
        return this.searchExercisesLocally(query);
      }
    } catch (error) {
      // Fall back to local search on error
      try {
        return this.searchExercisesLocally(query);
      } catch (localError) {
        throw this.handleError(localError);
      }
    }
  }

  /**
   * Search exercises locally (offline)
   */
  private async searchExercisesLocally(query: string): Promise<Exercise[]> {
    try {
      const results = await this.dbManager.executeSql(
        `SELECT * FROM exercises WHERE name LIKE ? OR description LIKE ? LIMIT 50`,
        [`%${query}%`, `%${query}%`]
      );

      const exercises: Exercise[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        exercises.push(this.mapRowToExercise(results.rows.item(i)));
      }

      this.exercises = exercises;
      return exercises;
    } catch (error) {
      throw new ExerciseError(ExerciseErrorType.DatabaseError, `Failed to search exercises: ${error}`);
    }
  }

  /**
   * Get exercises by muscle group
   */
  async getExercisesByMuscleGroup(muscleGroup: string): Promise<Exercise[]> {
    try {
      // Try online first
      if (this.isNetworkAvailable()) {
        const response = await this.api.get<ExerciseSearchResponse>(`/exercises/muscle-groups/${muscleGroup}`);

        // Cache results
        await this.cacheExercises(response.data.exercises);

        this.exercises = response.data.exercises;
        return response.data.exercises;
      } else {
        // Fall back to local
        return this.getExercisesByMuscleGroupLocally(muscleGroup);
      }
    } catch (error) {
      // Fall back to local on error
      try {
        return this.getExercisesByMuscleGroupLocally(muscleGroup);
      } catch (localError) {
        throw this.handleError(localError);
      }
    }
  }

  /**
   * Get exercises by muscle group locally
   */
  private async getExercisesByMuscleGroupLocally(muscleGroup: string): Promise<Exercise[]> {
    try {
      const results = await this.dbManager.executeSql(
        `SELECT * FROM exercises WHERE primaryMuscleGroup = ? LIMIT 100`,
        [muscleGroup]
      );

      const exercises: Exercise[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        exercises.push(this.mapRowToExercise(results.rows.item(i)));
      }

      this.exercises = exercises;
      return exercises;
    } catch (error) {
      throw new ExerciseError(ExerciseErrorType.DatabaseError, `Failed to get exercises: ${error}`);
    }
  }

  /**
   * Get exercise by ID
   */
  async getExercise(id: string): Promise<Exercise> {
    try {
      // Try online first
      if (this.isNetworkAvailable()) {
        const response = await this.api.get<Exercise>(`/exercises/${id}`);

        // Cache locally
        await this.cacheExercises([response.data]);

        return response.data;
      } else {
        // Fall back to local
        return this.getExerciseLocally(id);
      }
    } catch (error) {
      // Fall back to local on error
      try {
        return this.getExerciseLocally(id);
      } catch (localError) {
        throw this.handleError(localError);
      }
    }
  }

  /**
   * Get exercise locally
   */
  private async getExerciseLocally(id: string): Promise<Exercise> {
    try {
      const results = await this.dbManager.executeSql(
        `SELECT * FROM exercises WHERE id = ? LIMIT 1`,
        [id]
      );

      if (results.rows.length === 0) {
        throw new ExerciseError(ExerciseErrorType.NotFound, 'Exercise not found');
      }

      return this.mapRowToExercise(results.rows.item(0));
    } catch (error) {
      throw new ExerciseError(ExerciseErrorType.DatabaseError, `Failed to get exercise: ${error}`);
    }
  }

  /**
   * Get all exercises with pagination
   */
  async getAllExercises(page: number = 1, pageSize: number = 50): Promise<ExerciseSearchResponse> {
    try {
      if (this.isNetworkAvailable()) {
        const response = await this.api.get<ExerciseSearchResponse>(
          `/exercises?page=${page}&pageSize=${pageSize}`
        );

        // Cache results
        await this.cacheExercises(response.data.exercises);

        this.exercises = response.data.exercises;
        return response.data;
      } else {
        // Fall back to local
        const results = await this.dbManager.executeSql(
          `SELECT * FROM exercises LIMIT ? OFFSET ?`,
          [pageSize, (page - 1) * pageSize]
        );

        const exercises: Exercise[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          exercises.push(this.mapRowToExercise(results.rows.item(i)));
        }

        return {
          exercises,
          total: exercises.length,
          page,
          pageSize,
        };
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Sync exercise library from cloud
   */
  async syncExerciseLibrary(): Promise<void> {
    try {
      const response = await this.api.get<ExerciseSearchResponse>('/exercises?pageSize=1000');

      // Cache all exercises
      await this.cacheExercises(response.data.exercises);

      // Update last sync time
      this.lastSyncTime = new Date();
      await AsyncStorage.setItem('exerciseLibrarySyncTime', this.lastSyncTime.toISOString());

      this.exercises = response.data.exercises;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const syncTime = await AsyncStorage.getItem('exerciseLibrarySyncTime');
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  /**
   * Check if cache needs refresh (older than 7 days)
   */
  async shouldRefreshCache(): Promise<boolean> {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastSync < sevenDaysAgo;
  }

  /**
   * Get offline exercise count
   */
  async getOfflineExerciseCount(): Promise<number> {
    try {
      const results = await this.dbManager.executeSql('SELECT COUNT(*) as count FROM exercises');
      return results.rows.item(0).count || 0;
    } catch (error) {
      console.error('Failed to get exercise count:', error);
      return 0;
    }
  }

  /**
   * Cache exercises locally
   */
  private async cacheExercises(exercises: Exercise[]): Promise<void> {
    try {
      for (const exercise of exercises) {
        const secondaryGroups = JSON.stringify(exercise.secondaryMuscleGroups || []);
        const equipment = JSON.stringify(exercise.equipment || []);
        const formTips = JSON.stringify(exercise.formTips || []);

        await this.dbManager.executeSql(
          `INSERT OR REPLACE INTO exercises (
            id, name, description, primaryMuscleGroup, secondaryMuscleGroups,
            difficulty, equipment, formTips, videoUrl, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exercise.id,
            exercise.name,
            exercise.description,
            exercise.primaryMuscleGroup,
            secondaryGroups,
            exercise.difficulty,
            equipment,
            formTips,
            exercise.videoUrl || null,
            exercise.createdAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache exercises:', error);
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
      equipment: JSON.parse(row.equipment || '[]'),
      formTips: JSON.parse(row.formTips || '[]'),
      videoUrl: row.videoUrl,
      createdAt: row.createdAt,
    };
  }

  /**
   * Load last sync time from storage
   */
  private async loadLastSyncTime(): Promise<void> {
    try {
      const syncTime = await AsyncStorage.getItem('exerciseLibrarySyncTime');
      if (syncTime) {
        this.lastSyncTime = new Date(syncTime);
      }
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  }

  /**
   * Check if network is available
   */
  private isNetworkAvailable(): boolean {
    // TODO: Implement network reachability check using react-native-netinfo
    return true;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): ExerciseError {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 400:
          return new ExerciseError(ExerciseErrorType.BadRequest, 'Bad request');
        case 401:
          return new ExerciseError(ExerciseErrorType.Unauthorized, 'Unauthorized');
        case 404:
          return new ExerciseError(ExerciseErrorType.NotFound, 'Exercise not found');
        default:
          return new ExerciseError(ExerciseErrorType.ServerError, `Server error: ${status}`);
      }
    }

    return new ExerciseError(ExerciseErrorType.NetworkError, error.message || 'Network error');
  }
}

export default ExerciseLibraryService.getInstance();
