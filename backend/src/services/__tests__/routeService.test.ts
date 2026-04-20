import * as routeService from '../routeService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

// Mock the logger
jest.mock('../../logging/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Route Service', () => {
  const mockUserId = 'user-123';
  const mockRouteId = 'route-123';
  const mockCoordinates = [
    { lat: 40.7128, lng: -74.006 },
    { lat: 40.7129, lng: -74.0061 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoute', () => {
    it('should create a new route', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Central Park Loop',
        description: 'A scenic loop',
        coordinates: JSON.stringify(mockCoordinates),
        distance: 6.1,
        estimatedTime: 1800,
        difficulty: 'EASY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRoute] });

      const result = await routeService.createRoute(
        mockUserId,
        'Central Park Loop',
        'A scenic loop',
        mockCoordinates,
        6.1,
        1800,
        'EASY'
      );

      expect(result.id).toBe(mockRouteId);
      expect(result.name).toBe('Central Park Loop');
      expect(result.coordinates).toEqual(mockCoordinates);
      expect(connection.query).toHaveBeenCalled();
    });

    it('should handle null description', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Route',
        description: null,
        coordinates: JSON.stringify(mockCoordinates),
        distance: 5.0,
        estimatedTime: 1800,
        difficulty: 'EASY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRoute] });

      const result = await routeService.createRoute(
        mockUserId,
        'Route',
        undefined,
        mockCoordinates,
        5.0,
        1800,
        'EASY'
      );

      expect(result.description).toBeNull();
    });
  });

  describe('getRoute', () => {
    it('should retrieve a route with ratings', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Central Park Loop',
        description: 'A scenic loop',
        coordinates: JSON.stringify(mockCoordinates),
        distance: 6.1,
        estimatedTime: 1800,
        difficulty: 'EASY',
        averageRating: '4.5',
        reviewCount: '10',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRoute] });

      const result = await routeService.getRoute(mockRouteId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockRouteId);
      expect(result?.averageRating).toBe(4.5);
      expect(result?.reviewCount).toBe(10);
    });

    it('should return null if route not found', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await routeService.getRoute('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listUserRoutes', () => {
    it('should list user routes with pagination', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          userId: mockUserId,
          name: 'Route 1',
          coordinates: JSON.stringify(mockCoordinates),
          distance: 5.0,
          estimatedTime: 1800,
          difficulty: 'EASY',
          averageRating: '4.5',
          reviewCount: '10',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: mockRoutes });

      const result = await routeService.listUserRoutes(mockUserId, 50, 0);

      expect(result.total).toBe(10);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].name).toBe('Route 1');
    });

    it('should handle empty results', async () => {
      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await routeService.listUserRoutes(mockUserId, 50, 0);

      expect(result.total).toBe(0);
      expect(result.routes).toHaveLength(0);
    });
  });

  describe('updateRoute', () => {
    it('should update a route', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Updated Route',
        coordinates: JSON.stringify(mockCoordinates),
        distance: 7.0,
        estimatedTime: 2000,
        difficulty: 'MODERATE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user_id: mockUserId }] })
        .mockResolvedValueOnce({ rows: [mockRoute] });

      const result = await routeService.updateRoute(
        mockRouteId,
        mockUserId,
        'Updated Route',
        undefined,
        undefined,
        7.0,
        2000,
        'MODERATE'
      );

      expect(result?.name).toBe('Updated Route');
      expect(result?.distance).toBe(7.0);
    });

    it('should throw error if user does not own route', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [{ user_id: 'other-user' }] });

      await expect(
        routeService.updateRoute(mockRouteId, mockUserId, 'Updated Route')
      ).rejects.toThrow('Unauthorized');
    });

    it('should return null if route not found', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await routeService.updateRoute(mockRouteId, mockUserId, 'Updated Route');

      expect(result).toBeNull();
    });
  });

  describe('deleteRoute', () => {
    it('should delete a route', async () => {
      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user_id: mockUserId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await routeService.deleteRoute(mockRouteId, mockUserId);

      expect(connection.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error if route not found', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(routeService.deleteRoute(mockRouteId, mockUserId)).rejects.toThrow(
        'Route not found'
      );
    });

    it('should throw error if user does not own route', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [{ user_id: 'other-user' }] });

      await expect(routeService.deleteRoute(mockRouteId, mockUserId)).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  describe('rateRoute', () => {
    it('should create a new rating', async () => {
      const mockRating = {
        id: 'rating-123',
        routeId: mockRouteId,
        userId: mockUserId,
        rating: 5,
        review: 'Great route!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: mockRouteId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockRating] });

      const result = await routeService.rateRoute(mockRouteId, mockUserId, 5, 'Great route!');

      expect(result.rating).toBe(5);
      expect(result.review).toBe('Great route!');
    });

    it('should update existing rating', async () => {
      const mockRating = {
        id: 'rating-123',
        routeId: mockRouteId,
        userId: mockUserId,
        rating: 4,
        review: 'Good route',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: mockRouteId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'rating-123' }] })
        .mockResolvedValueOnce({ rows: [mockRating] });

      const result = await routeService.rateRoute(mockRouteId, mockUserId, 4, 'Good route');

      expect(result.rating).toBe(4);
    });

    it('should reject invalid rating', async () => {
      await expect(routeService.rateRoute(mockRouteId, mockUserId, 10)).rejects.toThrow(
        'Rating must be an integer between 1 and 5'
      );
    });

    it('should reject non-integer rating', async () => {
      await expect(routeService.rateRoute(mockRouteId, mockUserId, 3.5)).rejects.toThrow(
        'Rating must be an integer between 1 and 5'
      );
    });

    it('should throw error if route not found', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(routeService.rateRoute(mockRouteId, mockUserId, 5)).rejects.toThrow(
        'Route not found'
      );
    });
  });

  describe('getRouteRatings', () => {
    it('should get route ratings with pagination', async () => {
      const mockRatings = [
        {
          id: 'rating-1',
          routeId: mockRouteId,
          userId: 'user-1',
          rating: 5,
          review: 'Excellent!',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: mockRatings });

      const result = await routeService.getRouteRatings(mockRouteId, 50, 0);

      expect(result.total).toBe(10);
      expect(result.ratings).toHaveLength(1);
    });
  });

  describe('getUserRouteRating', () => {
    it('should get user rating for a route', async () => {
      const mockRating = {
        id: 'rating-123',
        routeId: mockRouteId,
        userId: mockUserId,
        rating: 5,
        review: 'Great route!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRating] });

      const result = await routeService.getUserRouteRating(mockRouteId, mockUserId);

      expect(result?.rating).toBe(5);
    });

    it('should return null if user has not rated route', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await routeService.getUserRouteRating(mockRouteId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('shareRoute', () => {
    it('should share a route with another user', async () => {
      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user_id: mockUserId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      await routeService.shareRoute(mockRouteId, mockUserId, 'user-456');

      expect(connection.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error if route not found', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(routeService.shareRoute(mockRouteId, mockUserId, 'user-456')).rejects.toThrow(
        'Route not found'
      );
    });

    it('should throw error if user does not own route', async () => {
      (connection.query as jest.Mock).mockResolvedValueOnce({ rows: [{ user_id: 'other-user' }] });

      await expect(routeService.shareRoute(mockRouteId, mockUserId, 'user-456')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should throw error if target user not found', async () => {
      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user_id: mockUserId }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(routeService.shareRoute(mockRouteId, mockUserId, 'nonexistent')).rejects.toThrow(
        'Target user not found'
      );
    });
  });

  describe('getSharedRoutes', () => {
    it('should get routes shared with user', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          userId: 'user-456',
          name: 'Shared Route',
          coordinates: JSON.stringify(mockCoordinates),
          distance: 5.0,
          estimatedTime: 1800,
          difficulty: 'EASY',
          averageRating: '4.5',
          reviewCount: '5',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: mockRoutes });

      const result = await routeService.getSharedRoutes(mockUserId, 50, 0);

      expect(result.total).toBe(5);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].name).toBe('Shared Route');
    });

    it('should handle empty results', async () => {
      (connection.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await routeService.getSharedRoutes(mockUserId, 50, 0);

      expect(result.total).toBe(0);
      expect(result.routes).toHaveLength(0);
    });
  });
});
