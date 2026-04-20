import * as connection from '../database/connection';

export interface RouteCoordinate {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface Route {
  id: string;
  userId: string;
  name: string;
  description?: string;
  coordinates: RouteCoordinate[];
  distance: number;
  estimatedTime: number;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  averageRating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteRating {
  id: string;
  routeId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new route
 */
export async function createRoute(
  userId: string,
  name: string,
  description: string | undefined,
  coordinates: RouteCoordinate[],
  distance: number,
  estimatedTime: number,
  difficulty: 'EASY' | 'MODERATE' | 'HARD'
): Promise<Route> {
  const query = `
    INSERT INTO gps_routes (user_id, name, description, coordinates, distance, estimated_time, difficulty)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id as "userId", name, description, coordinates, distance, estimated_time as "estimatedTime", 
              difficulty, created_at as "createdAt", updated_at as "updatedAt"
  `;

  const result = await connection.query(query, [
    userId,
    name,
    description || null,
    JSON.stringify(coordinates),
    distance,
    estimatedTime,
    difficulty,
  ]);

  const row = result.rows[0] as any;
  return {
    ...row,
    coordinates: JSON.parse(row.coordinates),
  };
}

/**
 * Get a route by ID
 */
export async function getRoute(routeId: string): Promise<Route | null> {
  const query = `
    SELECT 
      r.id, r.user_id as "userId", r.name, r.description, r.coordinates, r.distance, 
      r.estimated_time as "estimatedTime", r.difficulty, r.created_at as "createdAt", 
      r.updated_at as "updatedAt",
      COALESCE(AVG(rr.rating), 0) as "averageRating",
      COUNT(rr.id) as "reviewCount"
    FROM gps_routes r
    LEFT JOIN route_ratings rr ON r.id = rr.route_id
    WHERE r.id = $1
    GROUP BY r.id
  `;

  const result = await connection.query(query, [routeId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  return {
    ...row,
    coordinates: JSON.parse(row.coordinates),
    averageRating: parseFloat(row.averageRating),
    reviewCount: parseInt(row.reviewCount),
  };
}

/**
 * List user's routes with pagination
 */
export async function listUserRoutes(
  userId: string,
  limit: number,
  offset: number
): Promise<{ routes: Route[]; total: number }> {
  const countQuery = `SELECT COUNT(*) as count FROM gps_routes WHERE user_id = $1`;
  const countResult = await connection.query(countQuery, [userId]);
  const total = parseInt((countResult.rows[0] as any).count);

  const query = `
    SELECT 
      r.id, r.user_id as "userId", r.name, r.description, r.coordinates, r.distance, 
      r.estimated_time as "estimatedTime", r.difficulty, r.created_at as "createdAt", 
      r.updated_at as "updatedAt",
      COALESCE(AVG(rr.rating), 0) as "averageRating",
      COUNT(rr.id) as "reviewCount"
    FROM gps_routes r
    LEFT JOIN route_ratings rr ON r.id = rr.route_id
    WHERE r.user_id = $1
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await connection.query(query, [userId, limit, offset]);

  const routes = result.rows.map((row: any) => ({
    ...row,
    coordinates: JSON.parse(row.coordinates),
    averageRating: parseFloat(row.averageRating),
    reviewCount: parseInt(row.reviewCount),
  }));

  return { routes, total };
}

/**
 * Update a route
 */
export async function updateRoute(
  routeId: string,
  userId: string,
  name?: string,
  description?: string,
  coordinates?: RouteCoordinate[],
  distance?: number,
  estimatedTime?: number,
  difficulty?: 'EASY' | 'MODERATE' | 'HARD'
): Promise<Route | null> {
  // First verify ownership
  const ownerQuery = `SELECT user_id FROM gps_routes WHERE id = $1`;
  const ownerResult = await connection.query(ownerQuery, [routeId]);

  if (ownerResult.rows.length === 0) {
    return null;
  }

  if ((ownerResult.rows[0] as any).user_id !== userId) {
    throw new Error('Unauthorized: You do not own this route');
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount}`);
    values.push(name);
    paramCount++;
  }

  if (description !== undefined) {
    updates.push(`description = $${paramCount}`);
    values.push(description || null);
    paramCount++;
  }

  if (coordinates !== undefined) {
    updates.push(`coordinates = $${paramCount}`);
    values.push(JSON.stringify(coordinates));
    paramCount++;
  }

  if (distance !== undefined) {
    updates.push(`distance = $${paramCount}`);
    values.push(distance);
    paramCount++;
  }

  if (estimatedTime !== undefined) {
    updates.push(`estimated_time = $${paramCount}`);
    values.push(estimatedTime);
    paramCount++;
  }

  if (difficulty !== undefined) {
    updates.push(`difficulty = $${paramCount}`);
    values.push(difficulty);
    paramCount++;
  }

  if (updates.length === 0) {
    return getRoute(routeId);
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(routeId);

  const query = `
    UPDATE gps_routes
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, user_id as "userId", name, description, coordinates, distance, 
              estimated_time as "estimatedTime", difficulty, created_at as "createdAt", 
              updated_at as "updatedAt"
  `;

  const result = await connection.query(query, values);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  return {
    ...row,
    coordinates: JSON.parse(row.coordinates),
  };
}

/**
 * Delete a route
 */
export async function deleteRoute(routeId: string, userId: string): Promise<void> {
  // First verify ownership
  const ownerQuery = `SELECT user_id FROM gps_routes WHERE id = $1`;
  const ownerResult = await connection.query(ownerQuery, [routeId]);

  if (ownerResult.rows.length === 0) {
    throw new Error('Route not found');
  }

  if ((ownerResult.rows[0] as any).user_id !== userId) {
    throw new Error('Unauthorized: You do not own this route');
  }

  // Delete associated ratings first
  await connection.query(`DELETE FROM route_ratings WHERE route_id = $1`, [routeId]);

  // Delete the route
  await connection.query(`DELETE FROM gps_routes WHERE id = $1`, [routeId]);
}

/**
 * Rate a route
 */
export async function rateRoute(
  routeId: string,
  userId: string,
  rating: number,
  review?: string
): Promise<RouteRating> {
  // Validate rating is between 1 and 5
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 1 and 5');
  }

  // Check if route exists
  const routeQuery = `SELECT id FROM gps_routes WHERE id = $1`;
  const routeResult = await connection.query(routeQuery, [routeId]);

  if (routeResult.rows.length === 0) {
    throw new Error('Route not found');
  }

  // Check if user already rated this route
  const existingQuery = `SELECT id FROM route_ratings WHERE route_id = $1 AND user_id = $2`;
  const existingResult = await connection.query(existingQuery, [routeId, userId]);

  if (existingResult.rows.length > 0) {
    // Update existing rating
    const updateQuery = `
      UPDATE route_ratings
      SET rating = $1, review = $2, updated_at = CURRENT_TIMESTAMP
      WHERE route_id = $3 AND user_id = $4
      RETURNING id, route_id as "routeId", user_id as "userId", rating, review, 
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const result = await connection.query(updateQuery, [rating, review || null, routeId, userId]);
    return result.rows[0] as RouteRating;
  }

  // Create new rating
  const insertQuery = `
    INSERT INTO route_ratings (route_id, user_id, rating, review)
    VALUES ($1, $2, $3, $4)
    RETURNING id, route_id as "routeId", user_id as "userId", rating, review, 
              created_at as "createdAt", updated_at as "updatedAt"
  `;

  const result = await connection.query(insertQuery, [routeId, userId, rating, review || null]);
  return result.rows[0] as RouteRating;
}

/**
 * Get ratings for a route
 */
export async function getRouteRatings(
  routeId: string,
  limit: number,
  offset: number
): Promise<{ ratings: RouteRating[]; total: number }> {
  const countQuery = `SELECT COUNT(*) as count FROM route_ratings WHERE route_id = $1`;
  const countResult = await connection.query(countQuery, [routeId]);
  const total = parseInt((countResult.rows[0] as any).count);

  const query = `
    SELECT id, route_id as "routeId", user_id as "userId", rating, review, 
           created_at as "createdAt", updated_at as "updatedAt"
    FROM route_ratings
    WHERE route_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await connection.query(query, [routeId, limit, offset]);

  return { ratings: result.rows as RouteRating[], total };
}

/**
 * Get user's rating for a route
 */
export async function getUserRouteRating(routeId: string, userId: string): Promise<RouteRating | null> {
  const query = `
    SELECT id, route_id as "routeId", user_id as "userId", rating, review, 
           created_at as "createdAt", updated_at as "updatedAt"
    FROM route_ratings
    WHERE route_id = $1 AND user_id = $2
  `;

  const result = await connection.query(query, [routeId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as RouteRating;
}

/**
 * Share a route with another user
 */
export async function shareRoute(routeId: string, userId: string, targetUserId: string): Promise<void> {
  // Verify route exists and user owns it
  const ownerQuery = `SELECT user_id FROM gps_routes WHERE id = $1`;
  const ownerResult = await connection.query(ownerQuery, [routeId]);

  if (ownerResult.rows.length === 0) {
    throw new Error('Route not found');
  }

  if ((ownerResult.rows[0] as any).user_id !== userId) {
    throw new Error('Unauthorized: You do not own this route');
  }

  // Verify target user exists
  const userQuery = `SELECT id FROM users WHERE id = $1`;
  const userResult = await connection.query(userQuery, [targetUserId]);

  if (userResult.rows.length === 0) {
    throw new Error('Target user not found');
  }

  // Create share record (or update if exists)
  const query = `
    INSERT INTO route_shares (route_id, owner_id, shared_with_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (route_id, owner_id, shared_with_id) DO NOTHING
  `;

  await connection.query(query, [routeId, userId, targetUserId]);
}

/**
 * Get routes shared with a user
 */
export async function getSharedRoutes(
  userId: string,
  limit: number,
  offset: number
): Promise<{ routes: Route[]; total: number }> {
  const countQuery = `
    SELECT COUNT(DISTINCT r.id) as count 
    FROM gps_routes r
    INNER JOIN route_shares rs ON r.id = rs.route_id
    WHERE rs.shared_with_id = $1
  `;
  const countResult = await connection.query(countQuery, [userId]);
  const total = parseInt((countResult.rows[0] as any).count);

  const query = `
    SELECT DISTINCT
      r.id, r.user_id as "userId", r.name, r.description, r.coordinates, r.distance, 
      r.estimated_time as "estimatedTime", r.difficulty, r.created_at as "createdAt", 
      r.updated_at as "updatedAt",
      COALESCE(AVG(rr.rating), 0) as "averageRating",
      COUNT(rr.id) as "reviewCount"
    FROM gps_routes r
    INNER JOIN route_shares rs ON r.id = rs.route_id
    LEFT JOIN route_ratings rr ON r.id = rr.route_id
    WHERE rs.shared_with_id = $1
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await connection.query(query, [userId, limit, offset]);

  const routes = result.rows.map((row: any) => ({
    ...row,
    coordinates: JSON.parse(row.coordinates),
    averageRating: parseFloat(row.averageRating),
    reviewCount: parseInt(row.reviewCount),
  }));

  return { routes, total };
}
