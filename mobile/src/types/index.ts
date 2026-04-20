// Workout Types
export interface ExerciseSet {
  reps: number;
  weight: number; // in lbs
  rpe?: number; // Rate of Perceived Exertion (1-10)
  notes?: string;
}

export interface WorkoutExerciseEntry {
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroup: string;
  difficulty: string; // BEGINNER, INTERMEDIATE, ADVANCED
  sets: ExerciseSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  exercises: WorkoutExerciseEntry[];
  notes?: string;
  isOfflineCreated: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Streak Types
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate?: Date;
}

export interface StreakMilestone {
  days: number;
  xpReward: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  level: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

// Exercise Types
export interface Exercise {
  id: string;
  name: string;
  description: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  difficulty: string;
  equipment: string[];
  formTips: string[];
  videoUrl?: string;
}

// Sync Types
export interface SyncQueueItem {
  id: string;
  userId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  payload?: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Error Types
export enum WorkoutLoggerErrorType {
  InvalidExerciseIndex = 'INVALID_EXERCISE_INDEX',
  NoExercisesLogged = 'NO_EXERCISES_LOGGED',
  DatabaseError = 'DATABASE_ERROR',
  AntiCheatViolation = 'ANTI_CHEAT_VIOLATION',
  EncodingError = 'ENCODING_ERROR',
}

export class WorkoutLoggerError extends Error {
  constructor(
    public type: WorkoutLoggerErrorType,
    message: string
  ) {
    super(message);
    this.name = 'WorkoutLoggerError';
  }
}

export enum StreakErrorType {
  UserNotFound = 'USER_NOT_FOUND',
  DatabaseError = 'DATABASE_ERROR',
}

export class StreakError extends Error {
  constructor(
    public type: StreakErrorType,
    message: string
  ) {
    super(message);
    this.name = 'StreakError';
  }
}


// Authentication Types
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export enum AuthErrorType {
  InvalidURL = 'INVALID_URL',
  InvalidResponse = 'INVALID_RESPONSE',
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  RateLimited = 'RATE_LIMITED',
  ServerError = 'SERVER_ERROR',
  NoToken = 'NO_TOKEN',
  KeychainError = 'KEYCHAIN_ERROR',
  StorageError = 'STORAGE_ERROR',
  NetworkError = 'NETWORK_ERROR',
}

export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Profile Types
export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  bio?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: string;
  fitnessGoals: string[];
  experienceLevel: string;
  workoutFrequency: number;
  availableEquipment: string[];
  createdAt: string;
  updatedAt: string;
}

export enum ProfileErrorType {
  InvalidURL = 'INVALID_URL',
  InvalidResponse = 'INVALID_RESPONSE',
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  NotFound = 'NOT_FOUND',
  ServerError = 'SERVER_ERROR',
  NetworkError = 'NETWORK_ERROR',
}

export class ProfileError extends Error {
  constructor(
    public type: ProfileErrorType,
    message: string
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

// Exercise Types
export interface Exercise {
  id: string;
  name: string;
  description: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  difficulty: string;
  equipment: string[];
  formTips: string[];
  videoUrl?: string;
  createdAt: string;
}

export enum ExerciseErrorType {
  InvalidURL = 'INVALID_URL',
  InvalidResponse = 'INVALID_RESPONSE',
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  NotFound = 'NOT_FOUND',
  ServerError = 'SERVER_ERROR',
  DatabaseError = 'DATABASE_ERROR',
  NetworkError = 'NETWORK_ERROR',
}

export class ExerciseError extends Error {
  constructor(
    public type: ExerciseErrorType,
    message: string
  ) {
    super(message);
    this.name = 'ExerciseError';
  }
}

// Dummy export to ensure this file is treated as a value module
export const __typeModule = true;
