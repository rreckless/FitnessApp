import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logging/logger';

// MARK: - Types

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

export interface ExerciseSearchResult {
  exercises: Exercise[];
  total: number;
  page: number;
  pageSize: number;
}

// MARK: - Cache

const exerciseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCacheKey(key: string): string {
  return `exercise_${key}`;
}

function getFromCache(key: string): any | null {
  const cacheKey = getCacheKey(key);
  const cached = exerciseCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  exerciseCache.delete(cacheKey);
  return null;
}

function setCache(key: string, data: any): void {
  const cacheKey = getCacheKey(key);
  exerciseCache.set(cacheKey, { data, timestamp: Date.now() });
}

// MARK: - Exercise Search

/**
 * Search exercises by name with fuzzy matching
 */
export async function searchExercises(searchTerm: string, limit: number = 50): Promise<Exercise[]> {
  try {
    const cacheKey = `search_${searchTerm}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Use PostgreSQL ILIKE for case-insensitive fuzzy search
    const result = await query(
      `SELECT id, name, description, primary_muscle_group, secondary_muscle_groups, 
              difficulty, equipment, form_tips, video_url, created_at
       FROM exercises
       WHERE name ILIKE $1 OR description ILIKE $1
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );

    const exercises = result.rows.map(mapExerciseRow);
    setCache(cacheKey, exercises);

    return exercises;
  } catch (error) {
    logger.error('Failed to search exercises', error as Error);
    throw error;
  }
}

/**
 * Get exercises by muscle group
 */
export async function getExercisesByMuscleGroup(
  muscleGroup: string,
  includeSecondary: boolean = false
): Promise<Exercise[]> {
  try {
    validateMuscleGroup(muscleGroup);

    const cacheKey = `muscle_group_${muscleGroup}_${includeSecondary}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `SELECT id, name, description, primary_muscle_group, secondary_muscle_groups, 
                      difficulty, equipment, form_tips, video_url, created_at
               FROM exercises
               WHERE primary_muscle_group = $1`;

    if (includeSecondary) {
      sql += ` OR secondary_muscle_groups @> $2`;
    }

    const params = includeSecondary ? [muscleGroup, JSON.stringify([muscleGroup])] : [muscleGroup];

    const result = await query(sql, params);

    const exercises = result.rows.map(mapExerciseRow);
    setCache(cacheKey, exercises);

    return exercises;
  } catch (error) {
    logger.error('Failed to get exercises by muscle group', error as Error);
    throw error;
  }
}

/**
 * Get exercise by ID
 */
export async function getExerciseById(exerciseId: string): Promise<Exercise> {
  try {
    const cacheKey = `exercise_${exerciseId}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT id, name, description, primary_muscle_group, secondary_muscle_groups, 
              difficulty, equipment, form_tips, video_url, created_at
       FROM exercises
       WHERE id = $1`,
      [exerciseId]
    );

    if (result.rows.length === 0) {
      throw new Error('Exercise not found');
    }

    const exercise = mapExerciseRow(result.rows[0]);
    setCache(cacheKey, exercise);

    return exercise;
  } catch (error) {
    logger.error('Failed to get exercise by ID', error as Error);
    throw error;
  }
}

/**
 * Get all exercises with pagination
 */
export async function getAllExercises(page: number = 1, pageSize: number = 50): Promise<ExerciseSearchResult> {
  try {
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await query('SELECT COUNT(*) as count FROM exercises');
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const result = await query(
      `SELECT id, name, description, primary_muscle_group, secondary_muscle_groups, 
              difficulty, equipment, form_tips, video_url, created_at
       FROM exercises
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const exercises = result.rows.map(mapExerciseRow);

    return {
      exercises,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    logger.error('Failed to get all exercises', error as Error);
    throw error;
  }
}

/**
 * Get exercise count
 */
export async function getExerciseCount(): Promise<number> {
  try {
    const result = await query('SELECT COUNT(*) as count FROM exercises');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to get exercise count', error as Error);
    throw error;
  }
}

/**
 * Get all muscle groups
 */
export function getAllMuscleGroups(): string[] {
  return ['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS', 'CORE', 'CARDIO'];
}

// MARK: - Exercise Creation (Admin)

/**
 * Create a new exercise (admin only)
 */
export async function createExercise(data: {
  name: string;
  description: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  difficulty: string;
  equipment: string[];
  formTips: string[];
  videoUrl?: string;
}): Promise<Exercise> {
  try {
    validateExerciseName(data.name);
    validateMuscleGroup(data.primaryMuscleGroup);
    validateDifficulty(data.difficulty);

    const exerciseId = uuidv4();
    const result = await query(
      `INSERT INTO exercises (id, name, description, primary_muscle_group, secondary_muscle_groups, 
                              difficulty, equipment, form_tips, video_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, name, description, primary_muscle_group, secondary_muscle_groups, 
                 difficulty, equipment, form_tips, video_url, created_at`,
      [
        exerciseId,
        data.name,
        data.description,
        data.primaryMuscleGroup,
        JSON.stringify(data.secondaryMuscleGroups),
        data.difficulty,
        JSON.stringify(data.equipment),
        JSON.stringify(data.formTips),
        data.videoUrl || null,
      ]
    );

    const exercise = mapExerciseRow(result.rows[0]);

    logger.info('Exercise created', { exerciseId, name: data.name });

    // Invalidate cache
    exerciseCache.clear();

    return exercise;
  } catch (error) {
    logger.error('Failed to create exercise', error as Error);
    throw error;
  }
}

// MARK: - Validation

/**
 * Validate exercise name
 */
export function validateExerciseName(name: string): void {
  if (!name || name.length < 2 || name.length > 100) {
    throw new Error('Exercise name must be between 2 and 100 characters');
  }
}

/**
 * Validate muscle group
 */
export function validateMuscleGroup(muscleGroup: string): void {
  const validGroups = getAllMuscleGroups();
  if (!validGroups.includes(muscleGroup)) {
    throw new Error(`Invalid muscle group. Must be one of: ${validGroups.join(', ')}`);
  }
}

/**
 * Validate difficulty level
 */
export function validateDifficulty(difficulty: string): void {
  const validDifficulties = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  if (!validDifficulties.includes(difficulty)) {
    throw new Error(`Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`);
  }
}

// MARK: - Helper Functions

/**
 * Map database row to Exercise object
 */
function mapExerciseRow(row: any): Exercise {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    primaryMuscleGroup: row.primary_muscle_group,
    secondaryMuscleGroups: row.secondary_muscle_groups || [],
    difficulty: row.difficulty,
    equipment: row.equipment || [],
    formTips: row.form_tips || [],
    videoUrl: row.video_url,
    createdAt: row.created_at,
  };
}
