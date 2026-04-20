import RouteService, { Route, RouteCoordinate } from '../services/RouteService';
import DatabaseManager from '../database/DatabaseManager';

// Mock DatabaseManager
jest.mock('../database/DatabaseManager', () => ({
  executeSql: jest.fn(),
}));

describe('RouteService', () => {
  const mockUserId = 'user-123';
  const mockCoordinates: RouteCoordinate[] = [
    { latitude: 40.7128, longitude: -74.006 }, // NYC
    { latitude: 40.7138, longitude: -74.0055 },
    { latitude: 40.7148, longitude: -74.005 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoute', () => {
    it('should create a new route with correct properties', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Central Park Loop',
        40.7128,
        -74.006,
        40.7148,
        -74.005,
        mockCoordinates,
        'A scenic loop around Central Park',
        'EASY'
      );

      expect(route.name).toBe('Central Park Loop');
      expect(route.userId).toBe(mockUserId);
      expect(route.description).toBe('A scenic loop around Central Park');
      expect(route.difficulty).toBe('EASY');
      expect(route.distance).toBeGreaterThan(0);
      expect(route.estimatedTime).toBeGreaterThan(0);
      expect(route.coordinates).toEqual(mockCoordinates);
      expect(route.isOfflineCreated).toBe(true);
      expect(route.startLatitude).toBe(40.7128);
      expect(route.startLongitude).toBe(-74.006);
      expect(route.endLatitude).toBe(40.7148);
      expect(route.endLongitude).toBe(-74.005);
    });

    it('should calculate distance correctly', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Test Route',
        40.7128,
        -74.006,
        40.7148,
        -74.005,
        mockCoordinates
      );

      // Distance should be calculated from coordinates
      expect(route.distance).toBeGreaterThan(0);
      expect(route.distance).toBeLessThan(1); // Should be less than 1 mile for these coordinates
    });

    it('should estimate time based on distance', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Test Route',
        40.7128,
        -74.006,
        40.7148,
        -74.005,
        mockCoordinates
      );

      // Time should be estimated (distance * 10 min/mile * 60 seconds)
      expect(route.estimatedTime).toBeGreaterThan(0);
      expect(route.estimatedTime).toBe(Math.round(route.distance * 10 * 60));
    });

    it('should handle empty coordinates', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Empty Route',
        40.7128,
        -74.006,
        40.7128,
        -74.006,
        []
      );

      expect(route.distance).toBe(0);
      expect(route.estimatedTime).toBe(0);
    });

    it('should handle single coordinate', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const singleCoord: RouteCoordinate[] = [{ latitude: 40.7128, longitude: -74.006 }];

      const route = await RouteService.createRoute(
        mockUserId,
        'Single Point Route',
        40.7128,
        -74.006,
        40.7128,
        -74.006,
        singleCoord
      );

      expect(route.distance).toBe(0);
    });
  });

  describe('getUserRoutes', () => {
    it('should retrieve user routes from database', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData] },
      });

      const routes = await RouteService.getUserRoutes(mockUserId);

      expect(routes).toHaveLength(1);
      expect(routes[0].name).toBe('Test Route');
      expect(routes[0].coordinates).toEqual(mockCoordinates);
    });

    it('should return empty array on error', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockRejectedValue(new Error('Database error'));

      const routes = await RouteService.getUserRoutes(mockUserId);

      expect(routes).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [] },
      });

      await RouteService.getUserRoutes(mockUserId, 100);

      expect(mockExecuteSql).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), [
        mockUserId,
        100,
      ]);
    });
  });

  describe('getRoute', () => {
    it('should retrieve a specific route', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const route = await RouteService.getRoute('route-1');

      expect(route).not.toBeNull();
      expect(route?.name).toBe('Test Route');
      expect(route?.coordinates).toEqual(mockCoordinates);
    });

    it('should return null if route not found', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [], length: 0 },
      });

      const route = await RouteService.getRoute('nonexistent');

      expect(route).toBeNull();
    });

    it('should handle error gracefully', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockRejectedValue(new Error('Database error'));

      const route = await RouteService.getRoute('route-1');

      expect(route).toBeNull();
    });
  });

  describe('updateRoute', () => {
    it('should update route properties', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Old Name',
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const updated = await RouteService.updateRoute('route-1', { name: 'New Name' });

      expect(updated?.name).toBe('New Name');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should return null if route not found', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [], length: 0 },
      });

      const updated = await RouteService.updateRoute('nonexistent', { name: 'New Name' });

      expect(updated).toBeNull();
    });

    it('should handle multiple updates', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Updated Route',
        description: 'Updated description',
        distance: 10,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const updated = await RouteService.updateRoute('route-1', {
        name: 'Updated Route',
        description: 'Updated description',
        distance: 10,
      });

      expect(updated?.name).toBe('Updated Route');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.distance).toBe(10);
    });
  });

  describe('deleteRoute', () => {
    it('should delete a route', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({});

      const result = await RouteService.deleteRoute('route-1');

      expect(result).toBe(true);
      expect(mockExecuteSql).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockRejectedValue(new Error('Database error'));

      const result = await RouteService.deleteRoute('route-1');

      expect(result).toBe(false);
    });
  });

  describe('Route Navigation', () => {
    it('should start navigation on a route', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const navState = await RouteService.startNavigation('route-1');

      expect(navState).not.toBeNull();
      expect(navState?.routeId).toBe('route-1');
      expect(navState?.isNavigating).toBe(true);
      expect(navState?.currentCoordinateIndex).toBe(0);
      expect(navState?.distanceRemaining).toBe(5);
      expect(navState?.timeRemaining).toBe(3000);
    });

    it('should return null if route not found', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [], length: 0 },
      });

      const navState = await RouteService.startNavigation('nonexistent');

      expect(navState).toBeNull();
    });

    it('should update navigation progress', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      await RouteService.startNavigation('route-1');
      const updated = await RouteService.updateNavigationProgress(40.7138, -74.0055);

      expect(updated).not.toBeNull();
      expect(updated?.distanceRemaining).toBeLessThan(5);
      expect(updated?.currentCoordinateIndex).toBeGreaterThanOrEqual(0);
    });

    it('should return null when updating progress without active navigation', async () => {
      // End any active navigation first
      await RouteService.endNavigation();
      
      const updated = await RouteService.updateNavigationProgress(40.7128, -74.006);

      expect(updated).toBeNull();
    });

    it('should end navigation', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      await RouteService.startNavigation('route-1');
      const ended = await RouteService.endNavigation();

      expect(ended?.isNavigating).toBe(false);
      expect(ended?.completedAt).toBeDefined();
    });

    it('should return null when ending navigation without active session', async () => {
      const ended = await RouteService.endNavigation();

      expect(ended).toBeNull();
    });

    it('should get current navigation state', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      await RouteService.startNavigation('route-1');
      const state = RouteService.getCurrentNavigationState();

      expect(state).not.toBeNull();
      expect(state?.routeId).toBe('route-1');
    });

    it('should return null for current navigation state when not navigating', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      
      // End any active navigation first
      await RouteService.endNavigation();
      
      const state = RouteService.getCurrentNavigationState();

      expect(state).toBeNull();
    });
  });

  describe('Route Sharing', () => {
    it('should share a route with another user', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({});

      const result = await RouteService.shareRoute('route-1', 'user-456');

      expect(result).toBe(true);
      expect(mockExecuteSql).toHaveBeenCalled();
    });

    it('should return false on share error', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockRejectedValue(new Error('Database error'));

      const result = await RouteService.shareRoute('route-1', 'user-456');

      expect(result).toBe(false);
    });

    it('should get shared routes', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: 'user-123',
        name: 'Shared Route',
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData] },
      });

      const routes = await RouteService.getSharedRoutes('user-456');

      expect(routes).toHaveLength(1);
      expect(routes[0].name).toBe('Shared Route');
    });

    it('should return empty array when no shared routes', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [] },
      });

      const routes = await RouteService.getSharedRoutes('user-456');

      expect(routes).toEqual([]);
    });

    it('should handle error when getting shared routes', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockRejectedValue(new Error('Database error'));

      const routes = await RouteService.getSharedRoutes('user-456');

      expect(routes).toEqual([]);
    });
  });

  describe('Route Rating', () => {
    it('should rate a route', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        rating: null,
        reviewCount: 0,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const rated = await RouteService.rateRoute('route-1', 4.5);

      expect(rated).not.toBeNull();
      expect(rated?.rating).toBe(4.5);
      expect(rated?.reviewCount).toBe(1);
    });

    it('should calculate average rating correctly', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        rating: 4,
        reviewCount: 2,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const rated = await RouteService.rateRoute('route-1', 5);

      expect(rated?.rating).toBe(4.333333333333333); // (4*2 + 5) / 3
      expect(rated?.reviewCount).toBe(3);
    });

    it('should handle rating of route with no previous ratings', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        rating: undefined,
        reviewCount: 0,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const rated = await RouteService.rateRoute('route-1', 3);

      expect(rated?.rating).toBe(3);
      expect(rated?.reviewCount).toBe(1);
    });

    it('should return null if route not found', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [], length: 0 },
      });

      const rated = await RouteService.rateRoute('nonexistent', 5);

      expect(rated).toBeNull();
    });
  });

  describe('Navigation Subscription', () => {
    it('should subscribe to navigation state changes', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const listener = jest.fn();
      const unsubscribe = RouteService.subscribeToNavigation(listener);

      await RouteService.startNavigation('route-1');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow multiple navigation subscribers', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      const mockRouteData = {
        id: 'route-1',
        userId: mockUserId,
        name: 'Test Route',
        distance: 5,
        estimatedTime: 3000,
        coordinates: JSON.stringify(mockCoordinates),
        isOfflineCreated: 1,
      };

      mockExecuteSql.mockResolvedValue({
        rows: { raw: () => [mockRouteData], length: 1 },
      });

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      RouteService.subscribeToNavigation(listener1);
      RouteService.subscribeToNavigation(listener2);

      await RouteService.startNavigation('route-1');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Offline Storage and Sync', () => {
    it('should mark route as offline created', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Offline Route',
        40.7128,
        -74.006,
        40.7148,
        -74.005,
        mockCoordinates
      );

      expect(route.isOfflineCreated).toBe(true);
      expect(route.syncedAt).toBeUndefined();
    });

    it('should store route coordinates as JSON', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const route = await RouteService.createRoute(
        mockUserId,
        'Test Route',
        40.7128,
        -74.006,
        40.7148,
        -74.005,
        mockCoordinates
      );

      expect(route.coordinates).toEqual(mockCoordinates);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between NYC and nearby point', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const coords: RouteCoordinate[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7178, longitude: -74.006 }, // ~0.35 miles away
      ];

      const route = await RouteService.createRoute(
        mockUserId,
        'Short Route',
        40.7128,
        -74.006,
        40.7178,
        -74.006,
        coords
      );

      expect(route.distance).toBeGreaterThan(0.3);
      expect(route.distance).toBeLessThan(0.5);
    });

    it('should calculate distance for long route', async () => {
      const mockExecuteSql = DatabaseManager.executeSql as jest.Mock;
      mockExecuteSql.mockResolvedValue({ rows: { raw: () => [] } });

      const coords: RouteCoordinate[] = [
        { latitude: 40.7128, longitude: -74.006 }, // NYC
        { latitude: 34.0522, longitude: -118.2437 }, // LA
      ];

      const route = await RouteService.createRoute(
        mockUserId,
        'Long Route',
        40.7128,
        -74.006,
        34.0522,
        -118.2437,
        coords
      );

      // NYC to LA is approximately 2,450 miles
      expect(route.distance).toBeGreaterThan(2400);
      expect(route.distance).toBeLessThan(2500);
    });
  });
});
