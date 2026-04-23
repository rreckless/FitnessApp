/**
 * User Profile Service
 * Handles user profile management, preferences, and profile picture operations
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/DatabaseService';
import { SyncEngine } from './SyncEngine';
import {
  UserProfile,
  UserPreferences,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  UploadProfilePictureRequest,
  ProfileResponse,
  PreferencesResponse,
  ProfilePictureCache,
  ProfileValidationResult,
  UserProfileException,
  UserProfileError,
  PROFILE_PICTURE_CONSTRAINTS,
  PROFILE_VALIDATION_CONSTRAINTS,
  SubscriptionTier,
  ExperienceLevel,
  Equipment,
  FitnessGoal,
} from '../models/UserProfileModels';
import { SyncOperation, SyncEntityType } from '../models/SyncModels';

export class UserProfileService {
  private static instance: UserProfileService;
  private db: DatabaseService;
  private syncEngine: SyncEngine;
  private currentUserId: string | null = null;

  private constructor(db: DatabaseService, syncEngine: SyncEngine) {
    this.db = db;
    this.syncEngine = syncEngine;
  }

  static getInstance(db?: DatabaseService, syncEngine?: SyncEngine): UserProfileService {
    if (!UserProfileService.instance) {
      if (!db || !syncEngine) {
        throw new UserProfileException(
          UserProfileError.DATABASE_ERROR,
          'DatabaseService and SyncEngine are required for initialization'
        );
      }
      UserProfileService.instance = new UserProfileService(db, syncEngine);
    }
    return UserProfileService.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    UserProfileService.instance = null as any;
  }

  /**
   * Set the current user ID (called after authentication)
   */
  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Get the current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId?: string): Promise<UserProfile> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      const results = await this.db.queryAll(
        `SELECT * FROM users WHERE id = ?`,
        [id]
      );

      if (results.length === 0) {
        throw new UserProfileException(
          UserProfileError.PROFILE_NOT_FOUND,
          `User profile not found for ID: ${id}`
        );
      }

      const row = results[0];
      return this.mapRowToUserProfile(row);
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get user profile',
        error
      );
    }
  }

  /**
   * Create a new user profile (called during onboarding completion)
   */
  async createUserProfile(
    userId: string,
    email: string,
    name: string
  ): Promise<UserProfile> {
    try {
      // Validate profile data
      const validation = this.validateProfileData({ name });
      if (!validation.isValid) {
        throw new UserProfileException(
          UserProfileError.INVALID_PROFILE_DATA,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      const now = new Date().toISOString();

      const profile: UserProfile = {
        id: userId,
        email,
        name,
        level: 1,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        subscriptionTier: SubscriptionTier.FREE,
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await this.db.insert('users', {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        level: profile.level,
        totalXP: profile.totalXP,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        subscriptionTier: profile.subscriptionTier,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.CREATE,
        SyncEntityType.USER,
        profile.id,
        profile
      );

      return profile;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to create user profile',
        error
      );
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(request: UpdateProfileRequest, userId?: string): Promise<UserProfile> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      // Validate profile data
      const validation = this.validateProfileData(request);
      if (!validation.isValid) {
        throw new UserProfileException(
          UserProfileError.INVALID_PROFILE_DATA,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      const now = new Date().toISOString();
      const updateData: any = { updatedAt: now };

      if (request.name !== undefined) {
        updateData.name = request.name;
      }
      if (request.bio !== undefined) {
        updateData.bio = request.bio;
      }
      if (request.email !== undefined) {
        updateData.email = request.email;
      }

      // Update in database
      await this.db.update('users', updateData, 'id = ?', [id]);

      // Get updated profile
      const profile = await this.getUserProfile(id);

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.USER,
        id,
        profile
      );

      return profile;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to update user profile',
        error
      );
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId?: string): Promise<UserPreferences> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      const results = await this.db.queryAll(
        `SELECT * FROM user_preferences WHERE userId = ?`,
        [id]
      );

      if (results.length === 0) {
        throw new UserProfileException(
          UserProfileError.PREFERENCES_NOT_FOUND,
          `User preferences not found for ID: ${id}`
        );
      }

      const row = results[0];
      return this.mapRowToUserPreferences(row);
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get user preferences',
        error
      );
    }
  }

  /**
   * Create user preferences (called during onboarding completion)
   */
  async createUserPreferences(
    userId: string,
    fitnessGoals: FitnessGoal[],
    experienceLevel: ExperienceLevel,
    workoutFrequency: number,
    availableEquipment: Equipment[]
  ): Promise<UserPreferences> {
    try {
      // Validate preferences data
      const validation = this.validatePreferencesData({
        fitnessGoals,
        experienceLevel,
        workoutFrequency,
        availableEquipment,
      });
      if (!validation.isValid) {
        throw new UserProfileException(
          UserProfileError.INVALID_PREFERENCES_DATA,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      const now = new Date().toISOString();

      const preferences: UserPreferences = {
        userId,
        fitnessGoals,
        experienceLevel,
        workoutFrequency,
        availableEquipment,
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await this.db.insert('user_preferences', {
        userId: preferences.userId,
        fitnessGoals: JSON.stringify(preferences.fitnessGoals),
        experienceLevel: preferences.experienceLevel,
        workoutFrequency: preferences.workoutFrequency,
        availableEquipment: JSON.stringify(preferences.availableEquipment),
        createdAt: preferences.createdAt,
        updatedAt: preferences.updatedAt,
      });

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.CREATE,
        SyncEntityType.USER_PREFERENCES,
        userId,
        preferences
      );

      return preferences;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to create user preferences',
        error
      );
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    request: UpdatePreferencesRequest,
    userId?: string
  ): Promise<UserPreferences> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      // Get current preferences
      const currentPrefs = await this.getUserPreferences(id);

      // Merge with new values
      const updatedPrefs: UpdatePreferencesRequest = {
        fitnessGoals: request.fitnessGoals ?? currentPrefs.fitnessGoals,
        experienceLevel: request.experienceLevel ?? currentPrefs.experienceLevel,
        workoutFrequency: request.workoutFrequency ?? currentPrefs.workoutFrequency,
        availableEquipment: request.availableEquipment ?? currentPrefs.availableEquipment,
      };

      // Validate preferences data
      const validation = this.validatePreferencesData(updatedPrefs);
      if (!validation.isValid) {
        throw new UserProfileException(
          UserProfileError.INVALID_PREFERENCES_DATA,
          validation.errors.join('; '),
          { errors: validation.errors }
        );
      }

      const now = new Date().toISOString();
      const updateData: any = { updatedAt: now };

      if (request.fitnessGoals !== undefined) {
        updateData.fitnessGoals = JSON.stringify(request.fitnessGoals);
      }
      if (request.experienceLevel !== undefined) {
        updateData.experienceLevel = request.experienceLevel;
      }
      if (request.workoutFrequency !== undefined) {
        updateData.workoutFrequency = request.workoutFrequency;
      }
      if (request.availableEquipment !== undefined) {
        updateData.availableEquipment = JSON.stringify(request.availableEquipment);
      }

      // Update in database
      await this.db.update('user_preferences', updateData, 'userId = ?', [id]);

      // Get updated preferences
      const preferences = await this.getUserPreferences(id);

      // Queue sync operation
      await this.syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.USER_PREFERENCES,
        id,
        preferences
      );

      return preferences;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to update user preferences',
        error
      );
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(
    request: UploadProfilePictureRequest,
    userId?: string
  ): Promise<string> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      // Validate image file
      // In a real implementation, this would:
      // 1. Check file size
      // 2. Validate image format
      // 3. Compress image
      // 4. Generate thumbnail
      // 5. Upload to S3
      // For now, we'll simulate this with a local path

      const imageUrl = `s3://fitquest-profiles/${id}/${request.fileName}`;
      const thumbnailUrl = `s3://fitquest-profiles/${id}/thumbnail_${request.fileName}`;

      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      // Update profile picture URL in users table
      await this.db.update('users', { profilePictureUrl: imageUrl }, 'id = ?', [id]);

      // Cache the profile picture
      try {
        await this.db.delete('profile_picture_cache', 'userId = ?', [id]);
      } catch (e) {
        // Ignore if not exists
      }
      await this.db.insert('profile_picture_cache', {
        userId: id,
        url: imageUrl,
        thumbnailUrl,
        cachedAt: now,
        expiresAt,
      });

      // Queue sync operation
      const profile = await this.getUserProfile(id);
      await this.syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.USER,
        id,
        profile
      );

      return imageUrl;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.UPLOAD_FAILED,
        'Failed to upload profile picture',
        error
      );
    }
  }

  /**
   * Get cached profile picture
   */
  async getCachedProfilePicture(userId?: string): Promise<ProfilePictureCache | null> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      const results = await this.db.queryAll(
        `SELECT * FROM profile_picture_cache WHERE userId = ?`,
        [id]
      );

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      const cache: ProfilePictureCache = {
        userId: row.userId,
        url: row.url,
        thumbnailUrl: row.thumbnailUrl,
        cachedAt: row.cachedAt,
        expiresAt: row.expiresAt,
      };

      // Check if cache has expired
      if (new Date(cache.expiresAt) < new Date()) {
        // Delete expired cache
        await this.db.delete('profile_picture_cache', 'userId = ?', [id]);
        return null;
      }

      return cache;
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to get cached profile picture',
        error
      );
    }
  }

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(userId?: string): Promise<void> {
    try {
      const id = userId || this.currentUserId;
      if (!id) {
        throw new UserProfileException(
          UserProfileError.UNAUTHORIZED,
          'No user ID provided and no current user set'
        );
      }

      // Clear profile picture URL
      await this.db.update('users', { profilePictureUrl: null }, 'id = ?', [id]);

      // Delete cache
      await this.db.delete('profile_picture_cache', 'userId = ?', [id]);

      // Queue sync operation
      const profile = await this.getUserProfile(id);
      await this.syncEngine.queueOperation(
        SyncOperation.UPDATE,
        SyncEntityType.USER,
        id,
        profile
      );
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to delete profile picture',
        error
      );
    }
  }

  /**
   * Validate profile data
   */
  private validateProfileData(data: Partial<UpdateProfileRequest>): ProfileValidationResult {
    const errors: string[] = [];

    if (data.name !== undefined) {
      if (
        data.name.length < PROFILE_VALIDATION_CONSTRAINTS.MIN_NAME_LENGTH ||
        data.name.length > PROFILE_VALIDATION_CONSTRAINTS.MAX_NAME_LENGTH
      ) {
        errors.push(
          `Name must be between ${PROFILE_VALIDATION_CONSTRAINTS.MIN_NAME_LENGTH} and ${PROFILE_VALIDATION_CONSTRAINTS.MAX_NAME_LENGTH} characters`
        );
      }
    }

    if (data.bio !== undefined) {
      if (data.bio.length > PROFILE_VALIDATION_CONSTRAINTS.MAX_BIO_LENGTH) {
        errors.push(
          `Bio must not exceed ${PROFILE_VALIDATION_CONSTRAINTS.MAX_BIO_LENGTH} characters`
        );
      }
    }

    if (data.email !== undefined) {
      if (!this.isValidEmail(data.email)) {
        errors.push('Invalid email format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate preferences data
   */
  private validatePreferencesData(
    data: Partial<UpdatePreferencesRequest>
  ): ProfileValidationResult {
    const errors: string[] = [];

    if (data.fitnessGoals !== undefined) {
      if (!Array.isArray(data.fitnessGoals) || data.fitnessGoals.length === 0) {
        errors.push('At least one fitness goal must be selected');
      }
    }

    if (data.experienceLevel !== undefined) {
      if (!Object.values(ExperienceLevel).includes(data.experienceLevel)) {
        errors.push('Invalid experience level');
      }
    }

    if (data.workoutFrequency !== undefined) {
      if (
        data.workoutFrequency < PROFILE_VALIDATION_CONSTRAINTS.MIN_WORKOUT_FREQUENCY ||
        data.workoutFrequency > PROFILE_VALIDATION_CONSTRAINTS.MAX_WORKOUT_FREQUENCY
      ) {
        errors.push(
          `Workout frequency must be between ${PROFILE_VALIDATION_CONSTRAINTS.MIN_WORKOUT_FREQUENCY} and ${PROFILE_VALIDATION_CONSTRAINTS.MAX_WORKOUT_FREQUENCY} days per week`
        );
      }
    }

    if (data.availableEquipment !== undefined) {
      if (!Array.isArray(data.availableEquipment) || data.availableEquipment.length === 0) {
        errors.push('At least one equipment type must be selected');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Map database row to UserProfile
   */
  private mapRowToUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      bio: row.bio,
      profilePictureUrl: row.profilePictureUrl,
      level: row.level || 1,
      totalXP: row.totalXP || 0,
      currentStreak: row.currentStreak || 0,
      longestStreak: row.longestStreak || 0,
      subscriptionTier: row.subscriptionTier || SubscriptionTier.FREE,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncedAt: row.syncedAt,
    };
  }

  /**
   * Map database row to UserPreferences
   */
  private mapRowToUserPreferences(row: any): UserPreferences {
    return {
      userId: row.userId,
      fitnessGoals: JSON.parse(row.fitnessGoals),
      experienceLevel: row.experienceLevel,
      workoutFrequency: row.workoutFrequency,
      availableEquipment: JSON.parse(row.availableEquipment),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncedAt: row.syncedAt,
    };
  }
}
