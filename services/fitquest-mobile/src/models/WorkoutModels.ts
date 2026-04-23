/**
 * Workout Data Models
 * Defines types and interfaces for workout logging functionality
 */

/**
 * Represents a single set entry in a workout
 */
export interface WorkoutSet {
  id: string;
  reps: number;
  weight: number; // in lbs
  volume: number; // weight × reps
  notes?: string;
  createdAt: string;
}

/**
 * Represents an exercise within a workout
 */
export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a complete workout session
 */
export interface Workout {
  id: string;
  userId: string;
  startTime: string; // ISO 8601 timestamp
  endTime?: string; // ISO 8601 timestamp
  duration?: number; // in seconds
  totalVolume: number; // sum of all set volumes
  totalXP?: number; // calculated XP for the workout
  exercises: WorkoutExercise[];
  status: WorkoutStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

/**
 * Workout status enum
 */
export enum WorkoutStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Request to start a new workout
 */
export interface StartWorkoutRequest {
  userId: string;
  notes?: string;
}

/**
 * Request to add an exercise to a workout
 */
export interface AddExerciseRequest {
  exerciseId: string;
  exerciseName: string;
}

/**
 * Request to add a set to an exercise
 */
export interface AddSetRequest {
  exerciseId: string;
  reps: number;
  weight: number;
  notes?: string;
}

/**
 * Request to update a set
 */
export interface UpdateSetRequest {
  setId: string;
  reps?: number;
  weight?: number;
  notes?: string;
}

/**
 * Request to complete a workout
 */
export interface CompleteWorkoutRequest {
  notes?: string;
}

/**
 * Response from workout operations
 */
export interface WorkoutResponse {
  success: boolean;
  data?: Workout;
  error?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Workout history response with pagination
 */
export interface WorkoutHistoryResponse {
  workouts: Workout[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Anti-cheat validation constraints
 */
export const ANTI_CHEAT_CONSTRAINTS = {
  MAX_REPS_PER_SET: 50,
  MAX_REPS_PER_EXERCISE: 100,
  MIN_WEIGHT: 1,
  MAX_WEIGHT: 1000, // lbs
};

/**
 * Validation result for set entry
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Workout logger exception
 */
export class WorkoutLoggerException extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkoutLoggerException';
  }
}

/**
 * Workout logger error codes
 */
export enum WorkoutLoggerError {
  NO_ACTIVE_WORKOUT = 'NO_ACTIVE_WORKOUT',
  WORKOUT_ALREADY_STARTED = 'WORKOUT_ALREADY_STARTED',
  INVALID_EXERCISE = 'INVALID_EXERCISE',
  INVALID_REPS = 'INVALID_REPS',
  INVALID_WEIGHT = 'INVALID_WEIGHT',
  INVALID_SET = 'INVALID_SET',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  UNKNOWN = 'UNKNOWN',
}
