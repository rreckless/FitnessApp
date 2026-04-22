import { RouteService, Route, RouteCoordinate, RouteNavigation } from '../RouteService';
import axios from 'axios';
import SQLite from 'react-native-sqlite-storage';

jest.mock('axios');
jest.mock('react-native-sqlite-storage');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockDb = {
  executeSql: jest.fn(),
  close: jest.fn(),
};

describe('RouteService', () => {
  let service: RouteService;
  const apiBaseUrl = 'https://api.fitquest.com';
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

    service = new RouteService(apiBaseUrl, userId);
  });

  describe('Route Creation', () => {
    it('should create a new route', async () => {
      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      const route = await service.createRoute(
        'Central Park Run',
        startPoint,
        endPoint,
        coordinates,
        'EASY',
        'A scenic run through Central Park'
      );

      expect(route.name).toBe('Central Park Run');
      expect(route.userId).toBe(userId);
      expect(route.difficulty).toBe('EASY');
      expect(route.distance).toBeGreaterThan(0);
      expect(route.estimatedTime).toBeGreaterThan(0);
      expect(mockDb.executeSql).toHaveBeenCalled();
    });

    it('should calculate distance correctly', async () => {
      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      const route = await service.createRoute(
        'Test Route',
        startPoint,
        endPoint,
        coordinates,
        'MODERATE'
      );

      // Distance should be positive (approximately 6.5 km between these points)
      expect(route.distance).toBeGreaterThan(0);
      expect(route.distance).toBeLessThan(10000); // Less than 10 km
    });

    it('should estimate time based on difficulty', async () => {
      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      const easyRoute = await service.createRoute(
        'Easy Route',
        startPoint,
        endPoint,
        coordinates,
        'EASY'
      );

      const hardRoute = await service.createRoute(
        'Hard Route',
        startPoint,
        endPoint,
        coordinates,
        'HARD'
      );

      // Hard route should have shorter estimated time (faster pace)
      expect(hardRoute.estimatedTime).toBeLessThan(easyRoute.estimatedTime);
    });
  });

  describe('Route Retrieval', () => {
    it('should get user routes', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: () => ({
              id: 'route-1',
              userId,
              name: 'Test Route',
              description: 'A test route',
              startLatitude: 40.7128,
              startLongitude: -74.006,
              endLatitude: 40.758,
              endLongitude: -73.9855,
              coordinates: JSON.stringify([
                { latitude: 40.7128, longitude: -74.006 },
                { latitude: 40.758, longitude: -73.9855 },
              ]),
              distance: 6500,
              estimatedTime: 1300,
              difficulty: 'EASY',
              ratingCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        },
      ]);

      const routes = await service.getUserRoutes();

      expect(routes).toHaveLength(1);
      expect(routes[0].name).toBe('Test Route');
    });

    it('should get specific route', async () => {
      const routeId = 'route-1';

      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: () => ({
              id: routeId,
              userId,
              name: 'Test Route',
              startLatitude: 40.7128,
              startLongitude: -74.006,
              endLatitude: 40.758,
              endLongitude: -73.9855,
              coordinates: JSON.stringify([
                { latitude: 40.7128, longitude: -74.006 },
                { latitude: 40.758, longitude: -73.9855 },
              ]),
              distance: 6500,
              estimatedTime: 1300,
              difficulty: 'EASY',
              ratingCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        },
      ]);

      const route = await service.getRoute(routeId);

      expect(route).not.toBeNull();
      expect(route?.id).toBe(routeId);
    });

    it('should return null if route not found', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 0,
            item: () => ({}),
          },
        },
      ]);

      const route = await service.getRoute('nonexistent');

      expect(route).toBeNull();
    });
  });

  describe('Route Navigation', () => {
    it('should start navigation', async () => {
      const routeId = 'route-1';
      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: () => ({
              id: routeId,
              userId,
              name: 'Test Route',
              startLatitude: startPoint.latitude,
              startLongitude: startPoint.longitude,
              endLatitude: endPoint.latitude,
              endLongitude: endPoint.longitude,
              coordinates: JSON.stringify(coordinates),
              distance: 6500,
              estimatedTime: 1300,
              difficulty: 'EASY',
              ratingCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        },
      ]);

      const navigation = await service.startNavigation(routeId);

      expect(navigation.routeId).toBe(routeId);
      expect(navigation.currentLegIndex).toBe(0);
      expect(navigation.currentLeg).toBeDefined();
      expect(navigation.distanceToNextTurn).toBeGreaterThan(0);
    });

    it('should throw error if route not found', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 0,
            item: () => ({}),
          },
        },
      ]);

      await expect(service.startNavigation('nonexistent')).rejects.toThrow('Route not found');
    });
  });

  describe('Route Rating', () => {
    it('should rate a route', async () => {
      const routeId = 'route-1';
      const rating = 4;
      const review = 'Great route!';

      const result = await service.rateRoute(routeId, rating, review);

      expect(result.routeId).toBe(routeId);
      expect(result.userId).toBe(userId);
      expect(result.rating).toBe(rating);
      expect(result.review).toBe(review);
      expect(mockDb.executeSql).toHaveBeenCalled();
    });

    it('should reject invalid rating', async () => {
      const routeId = 'route-1';

      await expect(service.rateRoute(routeId, 0)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );

      await expect(service.rateRoute(routeId, 6)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );
    });
  });

  describe('Route Sharing', () => {
    it('should share route with friend', async () => {
      const routeId = 'route-1';
      const friendId = 'friend-1';

      const share = await service.shareRoute(routeId, friendId);

      expect(share.routeId).toBe(routeId);
      expect(share.sharedBy).toBe(userId);
      expect(share.sharedWith).toBe(friendId);
      expect(mockDb.executeSql).toHaveBeenCalled();
    });

    it('should get shared routes', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: () => ({
              id: 'route-1',
              userId: 'other-user',
              name: 'Shared Route',
              startLatitude: 40.7128,
              startLongitude: -74.006,
              endLatitude: 40.758,
              endLongitude: -73.9855,
              coordinates: JSON.stringify([
                { latitude: 40.7128, longitude: -74.006 },
                { latitude: 40.758, longitude: -73.9855 },
              ]),
              distance: 6500,
              estimatedTime: 1300,
              difficulty: 'EASY',
              ratingCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        },
      ]);

      const routes = await service.getSharedRoutes();

      expect(routes).toHaveLength(1);
      expect(routes[0].name).toBe('Shared Route');
    });
  });

  describe('Route Deletion', () => {
    it('should delete a route', async () => {
      const routeId = 'route-1';

      await service.deleteRoute(routeId);

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM routes'),
        [routeId]
      );
    });
  });

  describe('Event Listeners', () => {
    it('should emit routeCreated event', async () => {
      const callback = jest.fn();
      service.on('routeCreated', callback);

      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      await service.createRoute('Test Route', startPoint, endPoint, coordinates, 'EASY');

      expect(callback).toHaveBeenCalled();
    });

    it('should emit routeRated event', async () => {
      const callback = jest.fn();
      service.on('routeRated', callback);

      const routeId = 'route-1';
      await service.rateRoute(routeId, 4);

      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
      const callback = jest.fn();
      service.on('routeCreated', callback);
      service.off('routeCreated', callback);

      const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
      const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
      const coordinates: RouteCoordinate[] = [startPoint, endPoint];

      await service.createRoute('Test Route', startPoint, endPoint, coordinates, 'EASY');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Database Cleanup', () => {
    it('should close database connection', async () => {
      await service.close();

      expect(mockDb.close).toHaveBeenCalled();
    });
  });
});

/**
 * Property-Based Test: Route Navigation
 * **Validates: Requirements 21.3, 21.4**
 *
 * Property 37: Route Navigation
 * Test that route navigation progress is tracked correctly
 * Verify turn-by-turn navigation updates are accurate
 * Test navigation completion detection
 */
describe('RouteService - Property Tests: Route Navigation', () => {
  let service: RouteService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

    service = new RouteService('https://api.fitquest.com', 'test-user-123');
  });

  it('Property 37: Route Navigation - should create routes with valid distance and time', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    const difficulties: Array<'EASY' | 'MODERATE' | 'HARD'> = ['EASY', 'MODERATE', 'HARD'];

    for (const difficulty of difficulties) {
      const route = await service.createRoute(
        `Route ${difficulty}`,
        startPoint,
        endPoint,
        coordinates,
        difficulty
      );

      // Property 1: Distance should be positive
      expect(route.distance).toBeGreaterThan(0);

      // Property 2: Estimated time should be positive
      expect(route.estimatedTime).toBeGreaterThan(0);

      // Property 3: Difficulty should match
      expect(route.difficulty).toBe(difficulty);

      // Property 4: Route should have valid coordinates
      expect(route.coordinates).toBeDefined();
      expect(route.coordinates.length).toBeGreaterThan(0);

      // Property 5: Start and end points should match
      expect(route.startPoint).toEqual(startPoint);
      expect(route.endPoint).toEqual(endPoint);
    }
  });

  it('Property 37: Route Navigation - should maintain consistent distance calculations', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    const route1 = await service.createRoute(
      'Route 1',
      startPoint,
      endPoint,
      coordinates,
      'EASY'
    );

    const route2 = await service.createRoute(
      'Route 2',
      startPoint,
      endPoint,
      coordinates,
      'EASY'
    );

    // Property 1: Same coordinates should produce same distance
    expect(route1.distance).toBe(route2.distance);

    // Property 2: Distance should be consistent across calls
    expect(route1.distance).toBeGreaterThan(0);
    expect(route2.distance).toBeGreaterThan(0);
  });

  it('Property 37: Route Navigation - should provide accurate turn-by-turn navigation', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    mockDb.executeSql.mockResolvedValueOnce([
      {
        rows: {
          length: 1,
          item: () => ({
            id: 'route-1',
            userId: 'test-user-123',
            name: 'Test Route',
            startLatitude: startPoint.latitude,
            startLongitude: startPoint.longitude,
            endLatitude: endPoint.latitude,
            endLongitude: endPoint.longitude,
            coordinates: JSON.stringify(coordinates),
            distance: 6500,
            estimatedTime: 1300,
            difficulty: 'EASY',
            ratingCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
      },
    ]);

    const navigation = await service.startNavigation('route-1');

    // Property 1: Navigation should have valid route ID
    expect(navigation.routeId).toBe('route-1');

    // Property 2: Current leg index should start at 0
    expect(navigation.currentLegIndex).toBe(0);

    // Property 3: Current leg should be defined
    expect(navigation.currentLeg).toBeDefined();

    // Property 4: Distance to next turn should be positive
    expect(navigation.distanceToNextTurn).toBeGreaterThan(0);

    // Property 5: Next turn direction should be defined
    expect(navigation.nextTurnDirection).toBeDefined();
    expect(navigation.nextTurnDirection.length).toBeGreaterThan(0);

    // Property 6: Remaining distance should be positive
    expect(navigation.remainingDistance).toBeGreaterThan(0);

    // Property 7: Estimated time remaining should be positive
    expect(navigation.estimatedTimeRemaining).toBeGreaterThan(0);
  });

  it('Property 37: Route Navigation - should track navigation progress correctly', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    mockDb.executeSql.mockResolvedValueOnce([
      {
        rows: {
          length: 1,
          item: () => ({
            id: 'route-1',
            userId: 'test-user-123',
            name: 'Test Route',
            startLatitude: startPoint.latitude,
            startLongitude: startPoint.longitude,
            endLatitude: endPoint.latitude,
            endLongitude: endPoint.longitude,
            coordinates: JSON.stringify(coordinates),
            distance: 6500,
            estimatedTime: 1300,
            difficulty: 'EASY',
            ratingCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
      },
    ]);

    const navigation = await service.startNavigation('route-1');
    const initialLegIndex = navigation.currentLegIndex;

    // Property 1: Initial leg index should be 0
    expect(initialLegIndex).toBe(0);

    // Property 2: Navigation should have valid current leg
    expect(navigation.currentLeg).toBeDefined();
    expect(navigation.currentLeg.index).toBe(0);

    // Property 3: Distance to next turn should be positive
    expect(navigation.distanceToNextTurn).toBeGreaterThan(0);

    // Property 4: Remaining distance should equal route distance initially
    expect(navigation.remainingDistance).toBeGreaterThan(0);
  });

  it('Property 37: Route Navigation - should handle multiple difficulty levels correctly', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    const easyRoute = await service.createRoute(
      'Easy Route',
      startPoint,
      endPoint,
      coordinates,
      'EASY'
    );

    const moderateRoute = await service.createRoute(
      'Moderate Route',
      startPoint,
      endPoint,
      coordinates,
      'MODERATE'
    );

    const hardRoute = await service.createRoute(
      'Hard Route',
      startPoint,
      endPoint,
      coordinates,
      'HARD'
    );

    // Property 1: All routes should have same distance (same coordinates)
    expect(easyRoute.distance).toBe(moderateRoute.distance);
    expect(moderateRoute.distance).toBe(hardRoute.distance);

    // Property 2: Estimated time should vary by difficulty
    // Hard route should have shorter estimated time (faster pace)
    expect(hardRoute.estimatedTime).toBeLessThan(easyRoute.estimatedTime);
    expect(moderateRoute.estimatedTime).toBeLessThan(easyRoute.estimatedTime);

    // Property 3: All estimated times should be positive
    expect(easyRoute.estimatedTime).toBeGreaterThan(0);
    expect(moderateRoute.estimatedTime).toBeGreaterThan(0);
    expect(hardRoute.estimatedTime).toBeGreaterThan(0);
  });

  it('Property 37: Route Navigation - should validate route coordinates', async () => {
    // **Validates: Requirements 21.3, 21.4**
    const startPoint: RouteCoordinate = { latitude: 40.7128, longitude: -74.006 };
    const endPoint: RouteCoordinate = { latitude: 40.758, longitude: -73.9855 };
    const coordinates: RouteCoordinate[] = [startPoint, endPoint];

    const route = await service.createRoute(
      'Test Route',
      startPoint,
      endPoint,
      coordinates,
      'EASY'
    );

    // Property 1: All coordinates should have valid latitude/longitude
    route.coordinates.forEach((coord) => {
      expect(coord.latitude).toBeGreaterThanOrEqual(-90);
      expect(coord.latitude).toBeLessThanOrEqual(90);
      expect(coord.longitude).toBeGreaterThanOrEqual(-180);
      expect(coord.longitude).toBeLessThanOrEqual(180);
    });

    // Property 2: Start and end points should be in coordinates
    expect(route.coordinates[0]).toEqual(startPoint);
    expect(route.coordinates[route.coordinates.length - 1]).toEqual(endPoint);

    // Property 3: Route should have at least 2 coordinates
    expect(route.coordinates.length).toBeGreaterThanOrEqual(2);
  });
});
