import uuid from 'react-native-uuid';
import DatabaseManager from '../database/DatabaseManager';

const uuidv4 = uuid.v4;

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
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  distance: number; // miles
  estimatedTime: number; // seconds
  difficulty?: 'EASY' | 'MODERATE' | 'HARD';
  coordinates: RouteCoordinate[];
  rating?: number;
  reviewCount: number;
  isOfflineCreated: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteNavigationState {
  routeId: string;
  currentCoordinateIndex: number;
  distanceRemaining: number; // miles
  timeRemaining: number; // seconds
  isNavigating: boolean;
  completedAt?: string;
}

export class RouteService {
  private static instance: RouteService;
  private navigationState: RouteNavigationState | null = null;
  private listeners: Set<(state: RouteNavigationState | null) => void> = new Set();

  private constructor() {}

  static getInstance(): RouteService {
    if (!RouteService.instance) {
      RouteService.instance = new RouteService();
    }
    return RouteService.instance;
  }

  /**
   * Create a new route
   */
  async createRoute(
    userId: string,
    name: string,
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    coordinates: RouteCoordinate[],
    description?: string,
    difficulty?: 'EASY' | 'MODERATE' | 'HARD'
  ): Promise<Route> {
    const now = new Date().toISOString();
    const distance = this.calculateRouteDistance(coordinates);
    const estimatedTime = this.estimateRouteTime(distance);

    const route: Route = {
      id: uuidv4() as string,
      userId,
      name,
      description,
      startLatitude: startLat,
      startLongitude: startLng,
      endLatitude: endLat,
      endLongitude: endLng,
      distance,
      estimatedTime,
      difficulty,
      coordinates,
      rating: undefined,
      reviewCount: 0,
      isOfflineCreated: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveRoute(route);
    return route;
  }

  /**
   * Get all routes for a user
   */
  async getUserRoutes(userId: string, limit: number = 50): Promise<Route[]> {
    try {
      const sql = `
        SELECT * FROM routes
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT ?
      `;
      const result = await DatabaseManager.executeSql(sql, [userId, limit]);
      const routes = result.rows.raw() as any[];

      return routes.map((r) => ({
        ...r,
        coordinates: r.coordinates ? JSON.parse(r.coordinates) : [],
        isOfflineCreated: r.isOfflineCreated === 1,
      }));
    } catch (error) {
      console.error('Failed to get user routes:', error);
      return [];
    }
  }

  /**
   * Get route details
   */
  async getRoute(routeId: string): Promise<Route | null> {
    try {
      const sql = `
        SELECT * FROM routes
        WHERE id = ?
      `;
      const result = await DatabaseManager.executeSql(sql, [routeId]);

      if (result.rows.length === 0) {
        return null;
      }

      const route = result.rows.raw()[0] as any;
      return {
        ...route,
        coordinates: route.coordinates ? JSON.parse(route.coordinates) : [],
        isOfflineCreated: route.isOfflineCreated === 1,
      };
    } catch (error) {
      console.error('Failed to get route:', error);
      return null;
    }
  }

  /**
   * Update route
   */
  async updateRoute(routeId: string, updates: Partial<Route>): Promise<Route | null> {
    try {
      const route = await this.getRoute(routeId);
      if (!route) {
        return null;
      }

      const updated: Route = {
        ...route,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.saveRoute(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update route:', error);
      return null;
    }
  }

  /**
   * Delete route
   */
  async deleteRoute(routeId: string): Promise<boolean> {
    try {
      const sql = `DELETE FROM routes WHERE id = ?`;
      await DatabaseManager.executeSql(sql, [routeId]);
      return true;
    } catch (error) {
      console.error('Failed to delete route:', error);
      return false;
    }
  }

  /**
   * Start navigation on a route
   */
  async startNavigation(routeId: string): Promise<RouteNavigationState | null> {
    try {
      const route = await this.getRoute(routeId);
      if (!route) {
        return null;
      }

      this.navigationState = {
        routeId,
        currentCoordinateIndex: 0,
        distanceRemaining: route.distance,
        timeRemaining: route.estimatedTime,
        isNavigating: true,
      };

      this.notifyListeners();
      return this.navigationState;
    } catch (error) {
      console.error('Failed to start navigation:', error);
      return null;
    }
  }

  /**
   * Update navigation progress
   */
  async updateNavigationProgress(
    currentLat: number,
    currentLng: number
  ): Promise<RouteNavigationState | null> {
    if (!this.navigationState) {
      return null;
    }

    try {
      const route = await this.getRoute(this.navigationState.routeId);
      if (!route || route.coordinates.length === 0) {
        return null;
      }

      // Find closest coordinate on route
      let closestIndex = 0;
      let closestDistance = Infinity;

      for (let i = this.navigationState.currentCoordinateIndex; i < route.coordinates.length; i++) {
        const coord = route.coordinates[i];
        const distance = this.calculateDistance(currentLat, currentLng, coord.latitude, coord.longitude);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      // Update navigation state
      this.navigationState.currentCoordinateIndex = closestIndex;

      // Calculate remaining distance
      let remainingDistance = 0;
      for (let i = closestIndex; i < route.coordinates.length - 1; i++) {
        const curr = route.coordinates[i];
        const next = route.coordinates[i + 1];
        remainingDistance += this.calculateDistance(curr.latitude, curr.longitude, next.latitude, next.longitude);
      }

      this.navigationState.distanceRemaining = remainingDistance;

      // Estimate remaining time based on average pace
      const averagePace = route.estimatedTime / route.distance;
      this.navigationState.timeRemaining = Math.round(remainingDistance * averagePace);

      this.notifyListeners();
      return this.navigationState;
    } catch (error) {
      console.error('Failed to update navigation progress:', error);
      return null;
    }
  }

  /**
   * End navigation
   */
  async endNavigation(): Promise<RouteNavigationState | null> {
    if (!this.navigationState) {
      return null;
    }

    this.navigationState.isNavigating = false;
    this.navigationState.completedAt = new Date().toISOString();

    const state = this.navigationState;
    this.navigationState = null;
    this.notifyListeners();

    return state;
  }

  /**
   * Get current navigation state
   */
  getCurrentNavigationState(): RouteNavigationState | null {
    return this.navigationState;
  }

  /**
   * Subscribe to navigation state changes
   */
  subscribeToNavigation(listener: (state: RouteNavigationState | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Share route with another user
   */
  async shareRoute(routeId: string, sharedWithUserId: string): Promise<boolean> {
    try {
      const sql = `
        INSERT INTO route_shares (id, routeId, sharedWithUserId, sharedAt, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `;
      const now = new Date().toISOString();
      await DatabaseManager.executeSql(sql, [uuidv4(), routeId, sharedWithUserId, now, now]);
      return true;
    } catch (error) {
      console.error('Failed to share route:', error);
      return false;
    }
  }

  /**
   * Get shared routes
   */
  async getSharedRoutes(userId: string, limit: number = 50): Promise<Route[]> {
    try {
      const sql = `
        SELECT r.* FROM routes r
        INNER JOIN route_shares rs ON r.id = rs.routeId
        WHERE rs.sharedWithUserId = ?
        ORDER BY rs.sharedAt DESC
        LIMIT ?
      `;
      const result = await DatabaseManager.executeSql(sql, [userId, limit]);
      const routes = result.rows.raw() as any[];

      return routes.map((r) => ({
        ...r,
        coordinates: r.coordinates ? JSON.parse(r.coordinates) : [],
        isOfflineCreated: r.isOfflineCreated === 1,
      }));
    } catch (error) {
      console.error('Failed to get shared routes:', error);
      return [];
    }
  }

  /**
   * Rate a route
   */
  async rateRoute(routeId: string, rating: number): Promise<Route | null> {
    try {
      const route = await this.getRoute(routeId);
      if (!route) {
        return null;
      }

      // Calculate new average rating
      const totalRating = (route.rating || 0) * route.reviewCount + rating;
      const newReviewCount = route.reviewCount + 1;
      const newRating = totalRating / newReviewCount;

      return this.updateRoute(routeId, {
        rating: newRating,
        reviewCount: newReviewCount,
      });
    } catch (error) {
      console.error('Failed to rate route:', error);
      return null;
    }
  }

  // MARK: - Private Methods

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private calculateRouteDistance(coordinates: RouteCoordinate[]): number {
    if (coordinates.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      totalDistance += this.calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }

    return totalDistance;
  }

  private estimateRouteTime(distance: number): number {
    // Estimate time based on average pace of 10 min/mile (6 mph)
    // This is a reasonable average for running/jogging
    const averagePaceMinutesPerMile = 10;
    return Math.round(distance * averagePaceMinutesPerMile * 60); // Convert to seconds
  }

  private async saveRoute(route: Route): Promise<void> {
    try {
      const sql = `
        INSERT OR REPLACE INTO routes
        (id, userId, name, description, startLatitude, startLongitude, endLatitude, endLongitude, distance, estimatedTime, difficulty, coordinates, rating, reviewCount, isOfflineCreated, syncedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await DatabaseManager.executeSql(sql, [
        route.id,
        route.userId,
        route.name,
        route.description || null,
        route.startLatitude,
        route.startLongitude,
        route.endLatitude,
        route.endLongitude,
        route.distance,
        route.estimatedTime,
        route.difficulty || null,
        JSON.stringify(route.coordinates),
        route.rating || null,
        route.reviewCount,
        route.isOfflineCreated ? 1 : 0,
        route.syncedAt || null,
        route.createdAt,
        route.updatedAt,
      ]);
    } catch (error) {
      console.error('Failed to save route:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.navigationState);
    });
  }
}

export default RouteService.getInstance();
