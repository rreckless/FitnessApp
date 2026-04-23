/**
 * User Profile and Preferences Data Models
 * Defines types and interfaces for user profile and onboarding functionality
 */

/**
 * Fitness goals enum
 */
export enum FitnessGoal {
  STRENGTH = 'STRENGTH',
  ENDURANCE = 'ENDURANCE',
  WEIGHT_LOSS = 'WEIGHT_LOSS',
  MUSCLE_GAIN = 'MUSCLE_GAIN',
}

/**
 * Experience level enum
 */
export enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

/**
 * Available equipment enum
 */
export enum Equipment {
  DUMBBELLS = 'DUMBBELLS',
  BARBELL = 'BARBELL',
  MACHINES = 'MACHINES',
  BODYWEIGHT = 'BODYWEIGHT',
  CABLES = 'CABLES',
  KETTLEBELLS = 'KETTLEBELLS',
}

/**
 * Subscription tier enum
 */
export enum SubscriptionTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

/**
 * User profile data
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  bio?: string;
  profilePictureUrl?: string;
  level: number; // 1-based level
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

/**
 * User preferences data
 */
export interface UserPreferences {
  userId: string;
  fitnessGoals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
  workoutFrequency: number; // days per week (1-7)
  availableEquipment: Equipment[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

/**
 * Request to update user profile
 */
export interface UpdateProfileRequest {
  name?: string;
  bio?: string;
  email?: string;
}

/**
 * Request to update user preferences
 */
export interface UpdatePreferencesRequest {
  fitnessGoals?: FitnessGoal[];
  experienceLevel?: ExperienceLevel;
  workoutFrequency?: number;
  availableEquipment?: Equipment[];
}

/**
 * Request to upload profile picture
 */
export interface UploadProfilePictureRequest {
  filePath: string; // local file path
  fileName: string;
}

/**
 * Response from profile operations
 */
export interface ProfileResponse {
  success: boolean;
  data?: UserProfile;
  error?: string;
}

/**
 * Response from preferences operations
 */
export interface PreferencesResponse {
  success: boolean;
  data?: UserPreferences;
  error?: string;
}

/**
 * Onboarding step enum
 */
export enum OnboardingStep {
  GOALS = 'GOALS',
  EXPERIENCE = 'EXPERIENCE',
  FREQUENCY = 'FREQUENCY',
  EQUIPMENT = 'EQUIPMENT',
  COMPLETE = 'COMPLETE',
}

/**
 * Onboarding state
 */
export interface OnboardingState {
  currentStep: OnboardingStep;
  fitnessGoals: FitnessGoal[];
  experienceLevel?: ExperienceLevel;
  workoutFrequency?: number;
  availableEquipment: Equipment[];
  isSkipped: boolean;
  completedAt?: string;
}

/**
 * Profile picture cache entry
 */
export interface ProfilePictureCache {
  userId: string;
  url: string;
  thumbnailUrl?: string;
  cachedAt: string;
  expiresAt: string;
}

/**
 * Profile validation result
 */
export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * User profile exception
 */
export class UserProfileException extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'UserProfileException';
  }
}

/**
 * User profile error codes
 */
export enum UserProfileError {
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PREFERENCES_NOT_FOUND = 'PREFERENCES_NOT_FOUND',
  INVALID_PROFILE_DATA = 'INVALID_PROFILE_DATA',
  INVALID_PREFERENCES_DATA = 'INVALID_PREFERENCES_DATA',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Profile picture constraints
 */
export const PROFILE_PICTURE_CONSTRAINTS = {
  MAX_SIZE_MB: 5,
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  THUMBNAIL_WIDTH: 200,
  THUMBNAIL_HEIGHT: 200,
};

/**
 * Profile validation constraints
 */
export const PROFILE_VALIDATION_CONSTRAINTS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MAX_BIO_LENGTH: 500,
  MIN_WORKOUT_FREQUENCY: 1,
  MAX_WORKOUT_FREQUENCY: 7,
};
