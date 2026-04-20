import { getPool } from '../database/connection';

export interface GPSCoordinate {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  accuracy?: number;
  timestamp: string;
  retentionTier: 'RAW' | 'DOWNSAMPLED' | 'ARCHIVED';
}

export interface GPSSession {
  id: string;
  userId: string;
  workoutId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  distance?: number;
  averagePace?: number;
  elevationChange?: number;
  retentionTier: 'RAW' | 'DOWNSAMPLED' | 'ARCHIVED';
  coordinates?: GPSCoordinate[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new GPS session
 */
export async function createGPSSession(
  userId: string,
  workoutId?: string,
  startTime?: string
): Promise<GPSSession> {
  const query = `
    INSERT INTO gps_sessions (user_id, workout_id, start_time, retention_tier)
    VALUES ($1, $2, $3, 'RAW')
    RETURNING 
      id, user_id as "userId", workout_id as "workoutId", 
      start_time as "startTime", end_time as "endTime",
      duration, distance, average_pace as "averagePace",
      elevation_change as "elevationChange", retention_tier as "retentionTier",
      created_at as "createdAt", updated_at as "updatedAt"
  `;

  const result = await getPool().query(query, [userId, workoutId || null, startTime || new Date().toISOString()]);
  return result.rows[0];
}

/**
 * Get GPS session by ID with coordinates
 */
export async function getGPSSession(userId: string, sessionId: string): Promise<GPSSession | null> {
  const query = `
    SELECT 
      s.id, s.user_id as "userId", s.workout_id as "workoutId",
      s.start_time as "startTime", s.end_time as "endTime",
      s.duration, s.distance, s.average_pace as "averagePace",
      s.elevation_change as "elevationChange", s.retention_tier as "retentionTier",
      s.created_at as "createdAt", s.updated_at as "updatedAt"
    FROM gps_sessions s
    WHERE s.id = $1 AND s.user_id = $2
  `;

  const result = await getPool().query(query, [sessionId, userId]);
  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];

  // Get coordinates
  const coordQuery = `
    SELECT 
      id, session_id as "sessionId", latitude, longitude,
      elevation, accuracy, timestamp, retention_tier as "retentionTier"
    FROM gps_coordinates
    WHERE session_id = $1
    ORDER BY timestamp ASC
  `;

  const coordResult = await getPool().query(coordQuery, [sessionId]);
  session.coordinates = coordResult.rows;

  return session;
}

/**
 * List user's GPS sessions with pagination
 */
export async function listGPSSessions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ sessions: GPSSession[]; total: number }> {
  const query = `
    SELECT 
      s.id, s.user_id as "userId", s.workout_id as "workoutId",
      s.start_time as "startTime", s.end_time as "endTime",
      s.duration, s.distance, s.average_pace as "averagePace",
      s.elevation_change as "elevationChange", s.retention_tier as "retentionTier",
      s.created_at as "createdAt", s.updated_at as "updatedAt"
    FROM gps_sessions s
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countQuery = `SELECT COUNT(*) as count FROM gps_sessions WHERE user_id = $1`;

  const [result, countResult] = await Promise.all([
    getPool().query(query, [userId, limit, offset]),
    getPool().query(countQuery, [userId]),
  ]);

  return {
    sessions: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
}

/**
 * Add GPS coordinates to a session
 */
export async function addGPSCoordinate(
  sessionId: string,
  latitude: number,
  longitude: number,
  elevation?: number,
  accuracy?: number,
  timestamp?: string
): Promise<GPSCoordinate> {
  const query = `
    INSERT INTO gps_coordinates 
      (session_id, latitude, longitude, elevation, accuracy, timestamp, retention_tier)
    VALUES ($1, $2, $3, $4, $5, $6, 'RAW')
    RETURNING 
      id, session_id as "sessionId", latitude, longitude,
      elevation, accuracy, timestamp, retention_tier as "retentionTier"
  `;

  const result = await getPool().query(query, [
    sessionId,
    latitude,
    longitude,
    elevation || null,
    accuracy || null,
    timestamp || new Date().toISOString(),
  ]);

  return result.rows[0];
}

/**
 * Add multiple GPS coordinates in batch
 */
export async function addGPSCoordinatesBatch(
  sessionId: string,
  coordinates: Array<{
    latitude: number;
    longitude: number;
    elevation?: number;
    accuracy?: number;
    timestamp?: string;
  }>
): Promise<GPSCoordinate[]> {
  if (coordinates.length === 0) {
    return [];
  }

  const values = coordinates
    .map(
      (_coord, idx) =>
        `($1, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5}, $${idx * 5 + 6}, 'RAW')`
    )
    .join(',');

  const flatParams: any[] = [sessionId];
  coordinates.forEach((coord) => {
    flatParams.push(coord.latitude);
    flatParams.push(coord.longitude);
    flatParams.push(coord.elevation || null);
    flatParams.push(coord.accuracy || null);
    flatParams.push(coord.timestamp || new Date().toISOString());
  });

  const query = `
    INSERT INTO gps_coordinates 
      (session_id, latitude, longitude, elevation, accuracy, timestamp, retention_tier)
    VALUES ${values}
    RETURNING 
      id, session_id as "sessionId", latitude, longitude,
      elevation, accuracy, timestamp, retention_tier as "retentionTier"
  `;

  const result = await getPool().query(query, flatParams);
  return result.rows;
}

/**
 * Complete a GPS session with calculations
 */
export async function completeGPSSession(
  userId: string,
  sessionId: string,
  endTime?: string
): Promise<GPSSession> {
  // Get all coordinates for this session
  const coordQuery = `
    SELECT latitude, longitude, elevation, timestamp
    FROM gps_coordinates
    WHERE session_id = $1
    ORDER BY timestamp ASC
  `;

  const coordResult = await getPool().query(coordQuery, [sessionId]);
  const coordinates = coordResult.rows;

  if (coordinates.length === 0) {
    throw new Error('No GPS coordinates found for session');
  }

  // Calculate distance using Haversine formula
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    totalDistance += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }

  // Calculate elevation change
  let elevationChange = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    if (curr.elevation && prev.elevation) {
      const diff = curr.elevation - prev.elevation;
      if (diff > 0) {
        elevationChange += diff;
      }
    }
  }

  // Calculate duration
  const startTimestamp = new Date(coordinates[0].timestamp).getTime();
  const endTimestamp = new Date(coordinates[coordinates.length - 1].timestamp).getTime();
  const duration = Math.round((endTimestamp - startTimestamp) / 1000); // seconds

  // Calculate average pace (minutes per mile)
  const averagePace = totalDistance > 0 ? (duration / 60) / totalDistance : 0;

  // Update session
  const updateQuery = `
    UPDATE gps_sessions
    SET 
      end_time = $1,
      duration = $2,
      distance = $3,
      average_pace = $4,
      elevation_change = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND user_id = $7
    RETURNING 
      id, user_id as "userId", workout_id as "workoutId",
      start_time as "startTime", end_time as "endTime",
      duration, distance, average_pace as "averagePace",
      elevation_change as "elevationChange", retention_tier as "retentionTier",
      created_at as "createdAt", updated_at as "updatedAt"
  `;

  const result = await getPool().query(updateQuery, [
    endTime || new Date().toISOString(),
    duration,
    totalDistance,
    averagePace,
    elevationChange,
    sessionId,
    userId,
  ]);

  if (result.rows.length === 0) {
    throw new Error('GPS session not found');
  }

  return result.rows[0];
}

/**
 * Downsample GPS coordinates (keep 1 point per minute)
 * Called by batch job after 30 days
 */
export async function downsampleGPSCoordinates(sessionId: string): Promise<void> {
  // Get all raw coordinates for this session
  const query = `
    SELECT id, timestamp
    FROM gps_coordinates
    WHERE session_id = $1 AND retention_tier = 'RAW'
    ORDER BY timestamp ASC
  `;

  const result = await getPool().query(query, [sessionId]);
  const coordinates = result.rows;

  if (coordinates.length === 0) {
    return;
  }

  // Group by minute and keep first point of each minute
  const minuteMap = new Map<string, string>();
  coordinates.forEach((coord: any) => {
    const timestamp = new Date(coord.timestamp);
    const minute = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours(), timestamp.getMinutes()).toISOString();

    if (!minuteMap.has(minute)) {
      minuteMap.set(minute, coord.id);
    }
  });

  const idsToKeep = Array.from(minuteMap.values());
  const idsToArchive = coordinates.map((c: any) => c.id).filter((id: string) => !idsToKeep.includes(id));

  if (idsToArchive.length === 0) {
    return;
  }

  // Update coordinates to DOWNSAMPLED
  const updateQuery = `
    UPDATE gps_coordinates
    SET retention_tier = 'DOWNSAMPLED'
    WHERE id = ANY($1)
  `;

  await getPool().query(updateQuery, [idsToArchive]);

  // Update session retention tier if all coordinates are downsampled
  const checkQuery = `
    SELECT COUNT(*) as raw_count
    FROM gps_coordinates
    WHERE session_id = $1 AND retention_tier = 'RAW'
  `;

  const checkResult = await getPool().query(checkQuery, [sessionId]);
  if (parseInt(checkResult.rows[0].raw_count) === 0) {
    const sessionUpdateQuery = `
      UPDATE gps_sessions
      SET retention_tier = 'DOWNSAMPLED'
      WHERE id = $1
    `;
    await getPool().query(sessionUpdateQuery, [sessionId]);
  }
}

/**
 * Archive GPS data older than 1 year
 * Called by batch job
 */
export async function archiveOldGPSData(): Promise<void> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Archive sessions
  const sessionQuery = `
    UPDATE gps_sessions
    SET retention_tier = 'ARCHIVED'
    WHERE created_at < $1 AND retention_tier != 'ARCHIVED'
  `;

  await getPool().query(sessionQuery, [oneYearAgo.toISOString()]);

  // Archive coordinates
  const coordQuery = `
    UPDATE gps_coordinates
    SET retention_tier = 'ARCHIVED'
    WHERE created_at < $1 AND retention_tier != 'ARCHIVED'
  `;

  await getPool().query(coordQuery, [oneYearAgo.toISOString()]);
}

/**
 * Delete GPS session and its coordinates
 */
export async function deleteGPSSession(userId: string, sessionId: string): Promise<void> {
  const query = `
    DELETE FROM gps_sessions
    WHERE id = $1 AND user_id = $2
  `;

  const result = await getPool().query(query, [sessionId, userId]);

  if (result.rowCount === 0) {
    throw new Error('GPS session not found');
  }
}

/**
 * Haversine formula to calculate distance between two coordinates (in miles)
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
