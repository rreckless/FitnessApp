import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logging/logger';
import AWS from 'aws-sdk';
import sharp from 'sharp';

// Initialize S3 client
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

// MARK: - Types

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

// MARK: - Profile CRUD Operations

/**
 * Create a new user profile
 */
export async function createProfile(
  userId: string,
  data: { name: string; bio?: string }
): Promise<UserProfile> {
  try {
    validateProfileName(data.name);
    if (data.bio) {
      validateProfileBio(data.bio);
    }

    const profileId = uuidv4();
    const result = await query(
      `INSERT INTO user_profiles (id, user_id, name, bio, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, user_id, name, bio, profile_picture_url, created_at, updated_at`,
      [profileId, userId, data.name, data.bio || null]
    );

    const profile = result.rows[0];

    logger.info('User profile created', { userId, profileId });

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      profilePictureUrl: profile.profile_picture_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    logger.error('Failed to create profile', error as Error);
    throw error;
  }
}

/**
 * Get user profile by ID
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  try {
    const result = await query(
      `SELECT id, user_id, name, bio, profile_picture_url, created_at, updated_at
       FROM user_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    const profile = result.rows[0];

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      profilePictureUrl: profile.profile_picture_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get profile', error as Error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  data: Partial<{ name: string; bio: string }>
): Promise<UserProfile> {
  try {
    if (data.name) {
      validateProfileName(data.name);
    }
    if (data.bio) {
      validateProfileBio(data.bio);
    }

    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 2;

    if (data.name) {
      updates.push(`name = $${paramCount}`);
      values.push(data.name);
      paramCount++;
    }

    if (data.bio) {
      updates.push(`bio = $${paramCount}`);
      values.push(data.bio);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE user_profiles
       SET ${updates.join(', ')}
       WHERE user_id = $1
       RETURNING id, user_id, name, bio, profile_picture_url, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    const profile = result.rows[0];

    logger.info('User profile updated', { userId });

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      profilePictureUrl: profile.profile_picture_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    logger.error('Failed to update profile', error as Error);
    throw error;
  }
}

/**
 * Delete user profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  try {
    const result = await query(
      `DELETE FROM user_profiles WHERE user_id = $1 RETURNING id`,
      [userId]
    );

    logger.info('User profile deleted', { userId });

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Failed to delete profile', error as Error);
    throw error;
  }
}

// MARK: - Preferences Management

/**
 * Set user fitness goals
 */
export async function setFitnessGoals(userId: string, goals: string[]): Promise<UserPreferences> {
  try {
    const result = await query(
      `UPDATE user_preferences
       SET fitness_goals = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, fitness_goals, experience_level, workout_frequency, available_equipment, created_at, updated_at`,
      [userId, JSON.stringify(goals)]
    );

    if (result.rows.length === 0) {
      throw new Error('Preferences not found');
    }

    const prefs = result.rows[0];

    return {
      userId: prefs.user_id,
      fitnessGoals: prefs.fitness_goals,
      experienceLevel: prefs.experience_level,
      workoutFrequency: prefs.workout_frequency,
      availableEquipment: prefs.available_equipment,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  } catch (error) {
    logger.error('Failed to set fitness goals', error as Error);
    throw error;
  }
}

/**
 * Set user experience level
 */
export async function setExperienceLevel(userId: string, level: string): Promise<UserPreferences> {
  try {
    const result = await query(
      `UPDATE user_preferences
       SET experience_level = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, fitness_goals, experience_level, workout_frequency, available_equipment, created_at, updated_at`,
      [userId, level]
    );

    if (result.rows.length === 0) {
      throw new Error('Preferences not found');
    }

    const prefs = result.rows[0];

    return {
      userId: prefs.user_id,
      fitnessGoals: prefs.fitness_goals,
      experienceLevel: prefs.experience_level,
      workoutFrequency: prefs.workout_frequency,
      availableEquipment: prefs.available_equipment,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  } catch (error) {
    logger.error('Failed to set experience level', error as Error);
    throw error;
  }
}

/**
 * Set user workout frequency
 */
export async function setWorkoutFrequency(userId: string, frequency: number): Promise<UserPreferences> {
  try {
    const result = await query(
      `UPDATE user_preferences
       SET workout_frequency = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, fitness_goals, experience_level, workout_frequency, available_equipment, created_at, updated_at`,
      [userId, frequency]
    );

    if (result.rows.length === 0) {
      throw new Error('Preferences not found');
    }

    const prefs = result.rows[0];

    return {
      userId: prefs.user_id,
      fitnessGoals: prefs.fitness_goals,
      experienceLevel: prefs.experience_level,
      workoutFrequency: prefs.workout_frequency,
      availableEquipment: prefs.available_equipment,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  } catch (error) {
    logger.error('Failed to set workout frequency', error as Error);
    throw error;
  }
}

/**
 * Set available equipment
 */
export async function setAvailableEquipment(userId: string, equipment: string[]): Promise<UserPreferences> {
  try {
    const result = await query(
      `UPDATE user_preferences
       SET available_equipment = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, fitness_goals, experience_level, workout_frequency, available_equipment, created_at, updated_at`,
      [userId, JSON.stringify(equipment)]
    );

    if (result.rows.length === 0) {
      throw new Error('Preferences not found');
    }

    const prefs = result.rows[0];

    return {
      userId: prefs.user_id,
      fitnessGoals: prefs.fitness_goals,
      experienceLevel: prefs.experience_level,
      workoutFrequency: prefs.workout_frequency,
      availableEquipment: prefs.available_equipment,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  } catch (error) {
    logger.error('Failed to set available equipment', error as Error);
    throw error;
  }
}

/**
 * Get user preferences
 */
export async function getPreferences(userId: string): Promise<UserPreferences> {
  try {
    const result = await query(
      `SELECT user_id, fitness_goals, experience_level, workout_frequency, available_equipment, created_at, updated_at
       FROM user_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Preferences not found');
    }

    const prefs = result.rows[0];

    return {
      userId: prefs.user_id,
      fitnessGoals: prefs.fitness_goals || [],
      experienceLevel: prefs.experience_level,
      workoutFrequency: prefs.workout_frequency,
      availableEquipment: prefs.available_equipment || [],
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get preferences', error as Error);
    throw error;
  }
}

// MARK: - Profile Picture Upload

/**
 * Upload profile picture to S3
 */
export async function uploadProfilePicture(userId: string, imageBuffer: Buffer): Promise<UserProfile> {
  try {
    // Validate file size (max 5MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      throw new Error('Image size exceeds maximum of 5MB');
    }

    // Validate image format
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new Error('Invalid image format');
    }

    // Compress image
    const compressedBuffer = await sharp(imageBuffer)
      .resize(500, 500, { fit: 'cover' })
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    // Upload to S3
    const key = `profiles/${userId}/avatar.webp`;
    const s3Params = {
      Bucket: process.env.AWS_S3_BUCKET || 'fitquest-app',
      Key: key,
      Body: compressedBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
    };

    await s3.upload(s3Params).promise();

    const s3Url = `https://${s3Params.Bucket}.s3.amazonaws.com/${key}`;

    // Update profile with picture URL
    const result = await query(
      `UPDATE user_profiles
       SET profile_picture_url = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, user_id, name, bio, profile_picture_url, created_at, updated_at`,
      [userId, s3Url]
    );

    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    const profile = result.rows[0];

    logger.info('Profile picture uploaded', { userId });

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      profilePictureUrl: profile.profile_picture_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    logger.error('Failed to upload profile picture', error as Error);
    throw error;
  }
}

// MARK: - Validation and Sanitization

/**
 * Validate profile name
 */
export function validateProfileName(name: string): void {
  if (!name || name.length < 2 || name.length > 50) {
    throw new Error('Name must be between 2 and 50 characters');
  }
}

/**
 * Validate profile bio
 */
export function validateProfileBio(bio: string): void {
  if (bio.length > 500) {
    throw new Error('Bio must not exceed 500 characters');
  }
}

/**
 * Sanitize profile input to prevent XSS
 */
export function sanitizeProfileInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}
