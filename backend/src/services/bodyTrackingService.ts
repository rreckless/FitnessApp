import { getPool } from '../database/connection';
import { logger } from '../logging/logger';

// MARK: - Types

export interface BodyWeight {
  id: string;
  userId: string;
  weight: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrendLine {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

// MARK: - Body Weight Functions

/**
 * Log a new body weight entry
 */
export async function logBodyWeight(
  userId: string,
  weight: number,
  notes?: string,
  recordedAt?: string
): Promise<BodyWeight> {
  const query = `
    INSERT INTO body_weight (user_id, weight, notes, recorded_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, weight, notes, recorded_at, created_at, updated_at
  `;

  const recordedAtValue = recordedAt || new Date().toISOString();

  try {
    const result = await getPool().query(query, [userId, weight, notes || null, recordedAtValue]);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      weight: row.weight,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to log body weight', error as Error);
    throw error;
  }
}

/**
 * Get body weight history for a user
 */
export async function getBodyWeightHistory(userId: string, limit: number = 100, offset: number = 0): Promise<BodyWeight[]> {
  const query = `
    SELECT id, user_id, weight, notes, recorded_at, created_at, updated_at
    FROM body_weight
    WHERE user_id = $1
    ORDER BY recorded_at DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const result = await getPool().query(query, [userId, limit, offset]);
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      weight: row.weight,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('Failed to get body weight history', error as Error);
    throw error;
  }
}

/**
 * Update a body weight entry (within 7 days)
 */
export async function updateBodyWeight(userId: string, weightId: string, weight: number, notes?: string): Promise<BodyWeight> {
  // Check if entry is within 7 days
  const checkQuery = `
    SELECT created_at FROM body_weight
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const checkResult = await getPool().query(checkQuery, [weightId, userId]);

    if (checkResult.rows.length === 0) {
      throw new Error('Body weight entry not found');
    }

    const createdAt = new Date(checkResult.rows[0].created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      throw new Error('Cannot edit body weight entry older than 7 days');
    }

    const updateQuery = `
      UPDATE body_weight
      SET weight = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING id, user_id, weight, notes, recorded_at, created_at, updated_at
    `;

    const result = await getPool().query(updateQuery, [weight, notes || null, weightId, userId]);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      weight: row.weight,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to update body weight', error as Error);
    throw error;
  }
}

/**
 * Delete a body weight entry (within 7 days)
 */
export async function deleteBodyWeight(userId: string, weightId: string): Promise<void> {
  const checkQuery = `
    SELECT created_at FROM body_weight
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const checkResult = await getPool().query(checkQuery, [weightId, userId]);

    if (checkResult.rows.length === 0) {
      throw new Error('Body weight entry not found');
    }

    const createdAt = new Date(checkResult.rows[0].created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      throw new Error('Cannot delete body weight entry older than 7 days');
    }

    const deleteQuery = `
      DELETE FROM body_weight
      WHERE id = $1 AND user_id = $2
    `;

    await getPool().query(deleteQuery, [weightId, userId]);
  } catch (error) {
    logger.error('Failed to delete body weight', error as Error);
    throw error;
  }
}

/**
 * Calculate trend line for body weight
 */
export async function calculateWeightTrendLine(userId: string): Promise<TrendLine | null> {
  const query = `
    SELECT weight, recorded_at
    FROM body_weight
    WHERE user_id = $1
    ORDER BY recorded_at ASC
  `;

  try {
    const result = await getPool().query(query, [userId]);

    if (result.rows.length < 2) {
      return null;
    }

    const weights = result.rows;
    const startValue = weights[0].weight;
    const endValue = weights[weights.length - 1].weight;
    const startDate = weights[0].recorded_at;
    const endDate = weights[weights.length - 1].recorded_at;

    const changePercentage = ((endValue - startValue) / startValue) * 100;
    let trend: 'increasing' | 'decreasing' | 'stable';

    if (Math.abs(changePercentage) < 1) {
      trend = 'stable';
    } else if (changePercentage > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      startDate,
      endDate,
      startValue,
      endValue,
      trend,
      changePercentage: Math.round(changePercentage * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to calculate weight trend line', error as Error);
    throw error;
  }
}

// MARK: - Body Measurement Functions

/**
 * Log a new body measurement entry
 */
export async function logBodyMeasurement(
  userId: string,
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  },
  notes?: string,
  recordedAt?: string
): Promise<BodyMeasurement> {
  const query = `
    INSERT INTO body_measurements (user_id, chest, waist, hips, arms, thighs, notes, recorded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, user_id, chest, waist, hips, arms, thighs, notes, recorded_at, created_at, updated_at
  `;

  const recordedAtValue = recordedAt || new Date().toISOString();

  try {
    const result = await getPool().query(query, [
      userId,
      measurements.chest || null,
      measurements.waist || null,
      measurements.hips || null,
      measurements.arms || null,
      measurements.thighs || null,
      notes || null,
      recordedAtValue,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      chest: row.chest,
      waist: row.waist,
      hips: row.hips,
      arms: row.arms,
      thighs: row.thighs,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to log body measurement', error as Error);
    throw error;
  }
}

/**
 * Get body measurement history for a user
 */
export async function getBodyMeasurementHistory(userId: string, limit: number = 100, offset: number = 0): Promise<BodyMeasurement[]> {
  const query = `
    SELECT id, user_id, chest, waist, hips, arms, thighs, notes, recorded_at, created_at, updated_at
    FROM body_measurements
    WHERE user_id = $1
    ORDER BY recorded_at DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const result = await getPool().query(query, [userId, limit, offset]);
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      chest: row.chest,
      waist: row.waist,
      hips: row.hips,
      arms: row.arms,
      thighs: row.thighs,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('Failed to get body measurement history', error as Error);
    throw error;
  }
}

/**
 * Update a body measurement entry (within 7 days)
 */
export async function updateBodyMeasurement(
  userId: string,
  measurementId: string,
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  },
  notes?: string
): Promise<BodyMeasurement> {
  const checkQuery = `
    SELECT created_at FROM body_measurements
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const checkResult = await getPool().query(checkQuery, [measurementId, userId]);

    if (checkResult.rows.length === 0) {
      throw new Error('Body measurement entry not found');
    }

    const createdAt = new Date(checkResult.rows[0].created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      throw new Error('Cannot edit body measurement entry older than 7 days');
    }

    const updateQuery = `
      UPDATE body_measurements
      SET chest = $1, waist = $2, hips = $3, arms = $4, thighs = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING id, user_id, chest, waist, hips, arms, thighs, notes, recorded_at, created_at, updated_at
    `;

    const result = await getPool().query(updateQuery, [
      measurements.chest || null,
      measurements.waist || null,
      measurements.hips || null,
      measurements.arms || null,
      measurements.thighs || null,
      notes || null,
      measurementId,
      userId,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      chest: row.chest,
      waist: row.waist,
      hips: row.hips,
      arms: row.arms,
      thighs: row.thighs,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to update body measurement', error as Error);
    throw error;
  }
}

/**
 * Delete a body measurement entry (within 7 days)
 */
export async function deleteBodyMeasurement(userId: string, measurementId: string): Promise<void> {
  const checkQuery = `
    SELECT created_at FROM body_measurements
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const checkResult = await getPool().query(checkQuery, [measurementId, userId]);

    if (checkResult.rows.length === 0) {
      throw new Error('Body measurement entry not found');
    }

    const createdAt = new Date(checkResult.rows[0].created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      throw new Error('Cannot delete body measurement entry older than 7 days');
    }

    const deleteQuery = `
      DELETE FROM body_measurements
      WHERE id = $1 AND user_id = $2
    `;

    await getPool().query(deleteQuery, [measurementId, userId]);
  } catch (error) {
    logger.error('Failed to delete body measurement', error as Error);
    throw error;
  }
}

/**
 * Calculate change in a measurement from previous entry
 */
export async function calculateMeasurementChange(
  userId: string,
  measurementType: 'chest' | 'waist' | 'hips' | 'arms' | 'thighs'
): Promise<{ current: number; previous: number; change: number; changePercentage: number } | null> {
  const query = `
    SELECT ${measurementType}
    FROM body_measurements
    WHERE user_id = $1 AND ${measurementType} IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT 2
  `;

  try {
    const result = await getPool().query(query, [userId]);

    if (result.rows.length < 2) {
      return null;
    }

    const current = result.rows[0][measurementType];
    const previous = result.rows[1][measurementType];
    const change = current - previous;
    const changePercentage = (change / previous) * 100;

    return {
      current,
      previous,
      change: Math.round(change * 100) / 100,
      changePercentage: Math.round(changePercentage * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to calculate measurement change', error as Error);
    throw error;
  }
}

// MARK: - Progress Photo Functions

export interface ProgressPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Upload a progress photo
 */
export async function uploadProgressPhoto(
  userId: string,
  imageUrl: string,
  thumbnailUrl?: string,
  notes?: string,
  recordedAt?: string
): Promise<ProgressPhoto> {
  const query = `
    INSERT INTO progress_photos (user_id, image_url, thumbnail_url, notes, recorded_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, image_url, thumbnail_url, notes, recorded_at, created_at, updated_at
  `;

  const recordedAtValue = recordedAt || new Date().toISOString();

  try {
    const result = await getPool().query(query, [userId, imageUrl, thumbnailUrl || null, notes || null, recordedAtValue]);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to upload progress photo', error as Error);
    throw error;
  }
}

/**
 * Get progress photo gallery for a user
 */
export async function getProgressPhotoGallery(userId: string, limit: number = 100, offset: number = 0): Promise<ProgressPhoto[]> {
  const query = `
    SELECT id, user_id, image_url, thumbnail_url, notes, recorded_at, created_at, updated_at
    FROM progress_photos
    WHERE user_id = $1
    ORDER BY recorded_at DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const result = await getPool().query(query, [userId, limit, offset]);
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('Failed to get progress photo gallery', error as Error);
    throw error;
  }
}

/**
 * Get a specific progress photo
 */
export async function getProgressPhoto(userId: string, photoId: string): Promise<ProgressPhoto> {
  const query = `
    SELECT id, user_id, image_url, thumbnail_url, notes, recorded_at, created_at, updated_at
    FROM progress_photos
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const result = await getPool().query(query, [photoId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Progress photo not found');
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get progress photo', error as Error);
    throw error;
  }
}

/**
 * Delete a progress photo
 */
export async function deleteProgressPhoto(userId: string, photoId: string): Promise<void> {
  const query = `
    DELETE FROM progress_photos
    WHERE id = $1 AND user_id = $2
  `;

  try {
    const result = await getPool().query(query, [photoId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Progress photo not found');
    }
  } catch (error) {
    logger.error('Failed to delete progress photo', error as Error);
    throw error;
  }
}

/**
 * Get two photos for side-by-side comparison
 */
export async function getPhotoComparison(userId: string, photoId1: string, photoId2: string): Promise<{ photo1: ProgressPhoto; photo2: ProgressPhoto }> {
  try {
    const photo1 = await getProgressPhoto(userId, photoId1);
    const photo2 = await getProgressPhoto(userId, photoId2);

    return { photo1, photo2 };
  } catch (error) {
    logger.error('Failed to get photo comparison', error as Error);
    throw error;
  }
}

/**
 * Update progress photo notes
 */
export async function updateProgressPhotoNotes(userId: string, photoId: string, notes: string): Promise<ProgressPhoto> {
  const query = `
    UPDATE progress_photos
    SET notes = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING id, user_id, image_url, thumbnail_url, notes, recorded_at, created_at, updated_at
  `;

  try {
    const result = await getPool().query(query, [notes, photoId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Progress photo not found');
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to update progress photo notes', error as Error);
    throw error;
  }
}
