import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface Route {
  id: string;
  userId: string;
  name: string;
  description?: string;
  startPoint: RouteCoordinate;
  endPoint: RouteCoordinate;
  coordinates: RouteCoordinate[];
  distance: number; // meters
  estimatedTime: number; // seconds
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  averageRating?: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteNavigation {
  routeId: string;
  currentLegIndex: number;
  currentLeg: RouteLeg;
  distanceToNextTurn: number; // meters
  nextTurnDirection: string;
  remainingDistance: number; // meters
  estimatedTimeRemaining: number; // seconds
}

export interface RouteLeg {
  index: number;
  startPoint: RouteCoordinate;
  endPoint: RouteCoordinate;
  distance: number; // meters
  direction: string;
}

export interface RouteRating {
  id: string;
  routeId: string;
  userId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: string;
}

export interface RouteShare {
  id: string;
  routeId: string;
  sharedBy: string;
  sharedWith: string;
  sharedAt: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class RouteService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private userId: string;
  private apiBaseUrl: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private listeners: Map<string, Function[]> = new Map();

  constructor(apiBaseUrl: string, userId: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.userId = userId;
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    });
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'fitquest.db',
        location: 'default',
      });

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS routes (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          startLatitude REAL NOT NULL,
          startLongitude REAL NOT NULL,
          startElevation REAL,
          endLatitude REAL NOT NULL,
          endLongitude REAL NOT NULL,
          endElevation REAL,
          coordinates TEXT NOT NULL,
          distance REAL NOT NULL,
          estimatedTime INTEGER NOT NULL,
          difficulty TEXT NOT NULL,
          averageRating REAL,
          ratingCount INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS route_ratings (
          id TEXT PRIMARY KEY,
          routeId TEXT NOT NULL,
          userId TEXT NOT NULL,
          rating INTEGER NOT NULL,
          review TEXT,
          createdAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS route_shares (
          id TEXT PRIMARY KEY,
          routeId TEXT NOT NULL,
          sharedBy TEXT NOT NULL,
          sharedWith TEXT NOT NULL,
          sharedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);
    } catch (error) {
      console.error('Failed to initialize RouteService database:', error);
    }
  }

  /**
   * Create a new route
   */
  async createRoute(
    name: string,
    startPoint: RouteCoordinate,
    endPoint: RouteCoordinate,
    coordinates: RouteCoordinate[],
    difficulty: 'EASY' | 'MODERATE' | 'HARD',
    description?: string
  ): Promise<Route> {
    const routeId = uuid.v4().toString();
    const now = new Date().toISOString();

    // Calculate distance and estimated time
    const distance = this.calculateTotalDistance(coordinates);
    const estimatedTime = this.estimateTime(distance, difficulty);

    const route: Route = {
      id: routeId,
      userId: this.userId,
      name,
      description,
      startPoint,
      endPoint,
      coordinates,
      distance,
      estimatedTime,
      difficulty,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.storeRouteLocally(route);
    this.emit('routeCreated', route);

    return route;
  }

  /**
   * Get all routes for the user
   */
  async getUserRoutes(limit: number = 50, offset: number = 0): Promise<Route[]> {
    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM routes WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [this.userId, limit, offset]
      );

      const routes: Route[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        routes.push(this.parseRouteRow(result[0].rows.item(i)));
      }

      return routes;
    } catch (error) {
      console.error('Failed to get user routes:', error);
      return [];
    }
  }

  /**
   * Get a specific route
   */
  async getRoute(routeId: string): Promise<Route | null> {
    if (!this.db) {
      return null;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM routes WHERE id = ?`,
        [routeId]
      );

      if (result[0].rows.length > 0) {
        return this.parseRouteRow(result[0].rows.item(0));
      }

      return null;
    } catch (error) {
      console.error('Failed to get route:', error);
      return null;
    }
  }

  /**
   * Start navigation for a route
   */
  async startNavigation(routeId: string): Promise<RouteNavigation> {
    const route = await this.getRoute(routeId);
    if (!route) {
      throw new Error('Route not found');
    }

    const legs = this.generateLegs(route.coordinates);
    const firstLeg = legs[0];

    const navigation: RouteNavigation = {
      routeId,
      currentLegIndex: 0,
      currentLeg: firstLeg,
      distanceToNextTurn: firstLeg.distance,
      nextTurnDirection: this.getDirection(firstLeg),
      remainingDistance: route.distance,
      estimatedTimeRemaining: route.estimatedTime,
    };

    this.emit('navigationStarted', navigation);
    return navigation;
  }

  /**
   * Update navigation progress
   */
  updateNavigationProgress(
    currentLat: number,
    currentLon: number,
    navigation: RouteNavigation
  ): RouteNavigation {
    const currentPoint: RouteCoordinate = {
      latitude: currentLat,
      longitude: currentLon,
    };

    const currentLeg = navigation.currentLeg;
    const distanceToEnd = this.calculateDistance(currentPoint, currentLeg.endPoint);

    // Check if we've reached the end of the current leg
    if (distanceToEnd < 50) {
      // 50 meters threshold
      navigation.currentLegIndex++;
      if (navigation.currentLegIndex < 10) {
        // Assuming max 10 legs for simplicity
        const route = this.getRouteFromNavigation(navigation);
        if (route) {
          const legs = this.generateLegs(route.coordinates);
          if (navigation.currentLegIndex < legs.length) {
            navigation.currentLeg = legs[navigation.currentLegIndex];
            navigation.nextTurnDirection = this.getDirection(navigation.currentLeg);
          }
        }
      }
    }

    navigation.distanceToNextTurn = distanceToEnd;
    this.emit('navigationUpdated', navigation);

    return navigation;
  }

  /**
   * Rate a route
   */
  async rateRoute(routeId: string, rating: number, review?: string): Promise<RouteRating> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const ratingId = uuid.v4().toString();
    const now = new Date().toISOString();

    const routeRating: RouteRating = {
      id: ratingId,
      routeId,
      userId: this.userId,
      rating,
      review,
      createdAt: now,
    };

    await this.storeRatingLocally(routeRating);

    // Update route average rating
    await this.updateRouteRating(routeId, rating);

    this.emit('routeRated', routeRating);
    return routeRating;
  }

  /**
   * Share a route with a friend
   */
  async shareRoute(routeId: string, friendId: string): Promise<RouteShare> {
    const shareId = uuid.v4().toString();
    const now = new Date().toISOString();

    const share: RouteShare = {
      id: shareId,
      routeId,
      sharedBy: this.userId,
      sharedWith: friendId,
      sharedAt: now,
    };

    await this.storeShareLocally(share);
    this.emit('routeShared', share);

    return share;
  }

  /**
   * Get shared routes
   */
  async getSharedRoutes(limit: number = 50, offset: number = 0): Promise<Route[]> {
    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.executeSql(
        `SELECT DISTINCT r.* FROM routes r
         INNER JOIN route_shares rs ON r.id = rs.routeId
         WHERE rs.sharedWith = ?
         ORDER BY rs.sharedAt DESC
         LIMIT ? OFFSET ?`,
        [this.userId, limit, offset]
      );

      const routes: Route[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        routes.push(this.parseRouteRow(result[0].rows.item(i)));
      }

      return routes;
    } catch (error) {
      console.error('Failed to get shared routes:', error);
      return [];
    }
  }

  /**
   * Delete a route
   */
  async deleteRoute(routeId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(`DELETE FROM routes WHERE id = ?`, [routeId]);
      await this.db.executeSql(`DELETE FROM route_ratings WHERE routeId = ?`, [routeId]);
      await this.db.executeSql(`DELETE FROM route_shares WHERE routeId = ?`, [routeId]);

      await this.queueForSync('delete', routeId, 'ROUTE');
      this.emit('routeDeleted', routeId);
    } catch (error) {
      console.error('Failed to delete route:', error);
    }
  }

  /**
   * Calculate total distance for a route
   */
  private calculateTotalDistance(coordinates: RouteCoordinate[]): number {
    let totalDistance = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      totalDistance += this.calculateDistance(coordinates[i], coordinates[i + 1]);
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(point1: RouteCoordinate, point2: RouteCoordinate): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate time based on distance and difficulty
   */
  private estimateTime(distance: number, difficulty: 'EASY' | 'MODERATE' | 'HARD'): number {
    // Average pace: 6 min/km for easy, 5 min/km for moderate, 4 min/km for hard
    const pacePerKm = difficulty === 'EASY' ? 360 : difficulty === 'MODERATE' ? 300 : 240;
    const distanceKm = distance / 1000;
    return Math.round(distanceKm * pacePerKm);
  }

  /**
   * Generate legs from coordinates
   */
  private generateLegs(coordinates: RouteCoordinate[]): RouteLeg[] {
    const legs: RouteLeg[] = [];

    for (let i = 0; i < coordinates.length - 1; i++) {
      const leg: RouteLeg = {
        index: i,
        startPoint: coordinates[i],
        endPoint: coordinates[i + 1],
        distance: this.calculateDistance(coordinates[i], coordinates[i + 1]),
        direction: this.getDirectionBetweenPoints(coordinates[i], coordinates[i + 1]),
      };
      legs.push(leg);
    }

    return legs;
  }

  /**
   * Get direction between two points
   */
  private getDirectionBetweenPoints(from: RouteCoordinate, to: RouteCoordinate): string {
    const dLon = to.longitude - from.longitude;
    const dLat = to.latitude - from.latitude;
    const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);

    if (angle < 0) {
      return this.getDirectionName((angle + 360) % 360);
    }
    return this.getDirectionName(angle);
  }

  /**
   * Get direction name from angle
   */
  private getDirectionName(angle: number): string {
    if (angle < 22.5 || angle >= 337.5) return 'North';
    if (angle < 67.5) return 'Northeast';
    if (angle < 112.5) return 'East';
    if (angle < 157.5) return 'Southeast';
    if (angle < 202.5) return 'South';
    if (angle < 247.5) return 'Southwest';
    if (angle < 292.5) return 'West';
    return 'Northwest';
  }

  /**
   * Get direction for a leg
   */
  private getDirection(leg: RouteLeg): string {
    return this.getDirectionBetweenPoints(leg.startPoint, leg.endPoint);
  }

  /**
   * Parse route from database row
   */
  private parseRouteRow(row: any): Route {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      startPoint: {
        latitude: row.startLatitude,
        longitude: row.startLongitude,
        elevation: row.startElevation,
      },
      endPoint: {
        latitude: row.endLatitude,
        longitude: row.endLongitude,
        elevation: row.endElevation,
      },
      coordinates: JSON.parse(row.coordinates),
      distance: row.distance,
      estimatedTime: row.estimatedTime,
      difficulty: row.difficulty,
      averageRating: row.averageRating,
      ratingCount: row.ratingCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Store route locally
   */
  private async storeRouteLocally(route: Route): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO routes 
         (id, userId, name, description, startLatitude, startLongitude, startElevation, 
          endLatitude, endLongitude, endElevation, coordinates, distance, estimatedTime, 
          difficulty, averageRating, ratingCount, createdAt, updatedAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          route.id,
          route.userId,
          route.name,
          route.description || null,
          route.startPoint.latitude,
          route.startPoint.longitude,
          route.startPoint.elevation || null,
          route.endPoint.latitude,
          route.endPoint.longitude,
          route.endPoint.elevation || null,
          JSON.stringify(route.coordinates),
          route.distance,
          route.estimatedTime,
          route.difficulty,
          route.averageRating || null,
          route.ratingCount,
          route.createdAt,
          route.updatedAt,
        ]
      );

      await this.queueForSync('create', route.id, 'ROUTE');
    } catch (error) {
      console.error('Failed to store route locally:', error);
    }
  }

  /**
   * Store rating locally
   */
  private async storeRatingLocally(rating: RouteRating): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO route_ratings (id, routeId, userId, rating, review, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [rating.id, rating.routeId, rating.userId, rating.rating, rating.review || null, rating.createdAt]
      );

      await this.queueForSync('create', rating.id, 'ROUTE_RATING');
    } catch (error) {
      console.error('Failed to store rating locally:', error);
    }
  }

  /**
   * Store share locally
   */
  private async storeShareLocally(share: RouteShare): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO route_shares (id, routeId, sharedBy, sharedWith, sharedAt, synced)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [share.id, share.routeId, share.sharedBy, share.sharedWith, share.sharedAt]
      );

      await this.queueForSync('create', share.id, 'ROUTE_SHARE');
    } catch (error) {
      console.error('Failed to store share locally:', error);
    }
  }

  /**
   * Update route rating
   */
  private async updateRouteRating(routeId: string, newRating: number): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT AVG(rating) as avgRating, COUNT(*) as count FROM route_ratings WHERE routeId = ?`,
        [routeId]
      );

      if (result[0].rows.length > 0) {
        const row = result[0].rows.item(0);
        const avgRating = row.avgRating;
        const count = row.count;

        await this.db.executeSql(
          `UPDATE routes SET averageRating = ?, ratingCount = ? WHERE id = ?`,
          [avgRating, count, routeId]
        );
      }
    } catch (error) {
      console.error('Failed to update route rating:', error);
    }
  }

  /**
   * Get route from navigation (helper)
   */
  private getRouteFromNavigation(navigation: RouteNavigation): Route | null {
    // This would be implemented to retrieve the route from cache or database
    return null;
  }

  /**
   * Queue operation for sync
   */
  private async queueForSync(operation: 'create' | 'update' | 'delete', entityId: string, entityType: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const syncItem = {
        id: uuid.v4().toString(),
        userId: this.userId,
        operation,
        entityType,
        entityId,
        payload: {},
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      await this.db.executeSql(
        `INSERT INTO sync_queue (id, userId, operation, entityType, entityId, payload, status, retryCount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          syncItem.id,
          syncItem.userId,
          syncItem.operation,
          syncItem.entityType,
          syncItem.entityId,
          JSON.stringify(syncItem.payload),
          syncItem.status,
          syncItem.retryCount,
          syncItem.createdAt,
        ]
      );
    } catch (error) {
      console.error('Failed to queue for sync:', error);
    }
  }

  /**
   * Subscribe to route events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from route events
   */
  off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      return;
    }
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit route events
   */
  private emit(event: string, data: any): void {
    if (!this.listeners.has(event)) {
      return;
    }
    this.listeners.get(event)!.forEach((callback) => callback(data));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
