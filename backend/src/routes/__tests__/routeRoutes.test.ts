import request from 'supertest';
import express from 'express';
import routeRoutes from '../routeRoutes';
import * as routeService from '../../services/routeService';

// Mock the route service
jest.mock('../../services/routeService');

// Mock the logger
jest.mock('../../logging/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const app = express();
app.use(express.json());

// Add middleware to set userId
app.use((req, _res, next) => {
  (req as any).userId = 'user-123';
  next();
});

app.use('/routes', routeRoutes);

describe('Route Routes', () => {
  const mockUserId = 'user-123';
  const mockRouteId = 'route-123';
  const mockCoordinates = [
    { lat: 40.7128, lng: -74.006 },
    { lat: 40.7129, lng: -74.0061 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /routes', () => {
    it('should create a new route', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Central Park Loop',
        description: 'A scenic loop around Central Park',
        coordinates: mockCoordinates,
        distance: 6.1,
        estimatedTime: 1800,
        difficulty: 'EASY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (routeService.createRoute as jest.Mock).mockResolvedValueOnce(mockRoute);

      const response = await request(app)
        .post('/routes')
        .send({
          name: 'Central Park Loop',
          description: 'A scenic loop around Central Park',
          coordinates: mockCoordinates,
          distance: 6.1,
          estimatedTime: 1800,
          difficulty: 'EASY',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockRoute);
    });

    it('should return 401 if not authenticated', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/routes', routeRoutes);

      const response = await request(appNoAuth)
        .post('/routes')
        .send({
          name: 'Central Park Loop',
          coordinates: mockCoordinates,
          distance: 6.1,
          estimatedTime: 1800,
          difficulty: 'EASY',
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/routes')
        .send({
          name: 'Central Park Loop',
          // missing coordinates, distance, estimatedTime
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should validate difficulty', async () => {
      const response = await request(app)
        .post('/routes')
        .send({
          name: 'Central Park Loop',
          coordinates: mockCoordinates,
          distance: 6.1,
          estimatedTime: 1800,
          difficulty: 'INVALID',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('EASY, MODERATE, or HARD');
    });

    it('should validate coordinates is non-empty array', async () => {
      const response = await request(app)
        .post('/routes')
        .send({
          name: 'Central Park Loop',
          coordinates: [],
          distance: 6.1,
          estimatedTime: 1800,
          difficulty: 'EASY',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non-empty array');
    });
  });

  describe('GET /routes', () => {
    it('should list user routes', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          userId: mockUserId,
          name: 'Route 1',
          coordinates: mockCoordinates,
          distance: 5.0,
          estimatedTime: 1800,
          difficulty: 'EASY',
          averageRating: 4.5,
          reviewCount: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'route-2',
          userId: mockUserId,
          name: 'Route 2',
          coordinates: mockCoordinates,
          distance: 8.0,
          estimatedTime: 2400,
          difficulty: 'MODERATE',
          averageRating: 4.0,
          reviewCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (routeService.listUserRoutes as jest.Mock).mockResolvedValueOnce({
        routes: mockRoutes,
        total: 2,
      });

      const response = await request(app).get('/routes');

      expect(response.status).toBe(200);
      expect(response.body.routes).toEqual(mockRoutes);
      expect(response.body.total).toBe(2);
    });

    it('should support pagination', async () => {
      (routeService.listUserRoutes as jest.Mock).mockResolvedValueOnce({
        routes: [],
        total: 100,
      });

      const response = await request(app).get('/routes?limit=25&offset=50');

      expect(response.status).toBe(200);
      expect(routeService.listUserRoutes).toHaveBeenCalledWith(mockUserId, 25, 50);
    });

    it('should cap limit at 500', async () => {
      (routeService.listUserRoutes as jest.Mock).mockResolvedValueOnce({
        routes: [],
        total: 0,
      });

      await request(app).get('/routes?limit=1000');

      expect(routeService.listUserRoutes).toHaveBeenCalledWith(mockUserId, 500, 0);
    });
  });

  describe('GET /routes/:routeId', () => {
    it('should retrieve a route', async () => {
      const mockRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Central Park Loop',
        coordinates: mockCoordinates,
        distance: 6.1,
        estimatedTime: 1800,
        difficulty: 'EASY',
        averageRating: 4.5,
        reviewCount: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (routeService.getRoute as jest.Mock).mockResolvedValueOnce(mockRoute);

      const response = await request(app).get(`/routes/${mockRouteId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRoute);
    });

    it('should return 404 if route not found', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app).get(`/routes/nonexistent`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /routes/:routeId', () => {
    it('should update a route', async () => {
      const mockUpdatedRoute = {
        id: mockRouteId,
        userId: mockUserId,
        name: 'Updated Route',
        coordinates: mockCoordinates,
        distance: 7.0,
        estimatedTime: 2000,
        difficulty: 'MODERATE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (routeService.updateRoute as jest.Mock).mockResolvedValueOnce(mockUpdatedRoute);

      const response = await request(app)
        .put(`/routes/${mockRouteId}`)
        .send({
          name: 'Updated Route',
          distance: 7.0,
          estimatedTime: 2000,
          difficulty: 'MODERATE',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUpdatedRoute);
    });

    it('should return 404 if route not found', async () => {
      (routeService.updateRoute as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .put(`/routes/nonexistent`)
        .send({ name: 'Updated Route' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if user does not own route', async () => {
      (routeService.updateRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Unauthorized: You do not own this route')
      );

      const response = await request(app)
        .put(`/routes/${mockRouteId}`)
        .send({ name: 'Updated Route' });

      expect(response.status).toBe(403);
    });

    it('should validate difficulty', async () => {
      const response = await request(app)
        .put(`/routes/${mockRouteId}`)
        .send({ difficulty: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('EASY, MODERATE, or HARD');
    });
  });

  describe('DELETE /routes/:routeId', () => {
    it('should delete a route', async () => {
      (routeService.deleteRoute as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app).delete(`/routes/${mockRouteId}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 if route not found', async () => {
      (routeService.deleteRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Route not found')
      );

      const response = await request(app).delete(`/routes/nonexistent`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if user does not own route', async () => {
      (routeService.deleteRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Unauthorized: You do not own this route')
      );

      const response = await request(app).delete(`/routes/${mockRouteId}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /routes/:routeId/rate', () => {
    it('should rate a route', async () => {
      const mockRating = {
        id: 'rating-123',
        routeId: mockRouteId,
        userId: mockUserId,
        rating: 5,
        review: 'Great route!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (routeService.rateRoute as jest.Mock).mockResolvedValueOnce(mockRating);

      const response = await request(app)
        .post(`/routes/${mockRouteId}/rate`)
        .send({
          rating: 5,
          review: 'Great route!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockRating);
    });

    it('should return 400 if rating is invalid', async () => {
      (routeService.rateRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Rating must be an integer between 1 and 5')
      );

      const response = await request(app)
        .post(`/routes/${mockRouteId}/rate`)
        .send({
          rating: 10,
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 if route not found', async () => {
      (routeService.rateRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Route not found')
      );

      const response = await request(app)
        .post(`/routes/nonexistent/rate`)
        .send({
          rating: 5,
        });

      expect(response.status).toBe(404);
    });

    it('should validate rating is provided', async () => {
      const response = await request(app)
        .post(`/routes/${mockRouteId}/rate`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rating is required');
    });
  });

  describe('GET /routes/:routeId/ratings', () => {
    it('should get route ratings', async () => {
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
        {
          id: 'rating-2',
          routeId: mockRouteId,
          userId: 'user-2',
          rating: 4,
          review: 'Good route',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (routeService.getRouteRatings as jest.Mock).mockResolvedValueOnce({
        ratings: mockRatings,
        total: 2,
      });

      const response = await request(app).get(`/routes/${mockRouteId}/ratings`);

      expect(response.status).toBe(200);
      expect(response.body.ratings).toEqual(mockRatings);
      expect(response.body.total).toBe(2);
    });

    it('should support pagination', async () => {
      (routeService.getRouteRatings as jest.Mock).mockResolvedValueOnce({
        ratings: [],
        total: 100,
      });

      const response = await request(app).get(`/routes/${mockRouteId}/ratings?limit=25&offset=50`);

      expect(response.status).toBe(200);
      expect(routeService.getRouteRatings).toHaveBeenCalledWith(mockRouteId, 25, 50);
    });
  });

  describe('GET /routes/:routeId/my-rating', () => {
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

      (routeService.getUserRouteRating as jest.Mock).mockResolvedValueOnce(mockRating);

      const response = await request(app).get(`/routes/${mockRouteId}/my-rating`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRating);
    });

    it('should return 404 if user has not rated route', async () => {
      (routeService.getUserRouteRating as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app).get(`/routes/${mockRouteId}/my-rating`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /routes/:routeId/share', () => {
    it('should share a route with another user', async () => {
      (routeService.shareRoute as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post(`/routes/${mockRouteId}/share`)
        .send({
          targetUserId: 'user-456',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('shared successfully');
    });

    it('should return 400 if targetUserId is missing', async () => {
      const response = await request(app)
        .post(`/routes/${mockRouteId}/share`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('targetUserId is required');
    });

    it('should return 404 if route not found', async () => {
      (routeService.shareRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Route not found')
      );

      const response = await request(app)
        .post(`/routes/nonexistent/share`)
        .send({
          targetUserId: 'user-456',
        });

      expect(response.status).toBe(404);
    });

    it('should return 403 if user does not own route', async () => {
      (routeService.shareRoute as jest.Mock).mockRejectedValueOnce(
        new Error('Unauthorized: You do not own this route')
      );

      const response = await request(app)
        .post(`/routes/${mockRouteId}/share`)
        .send({
          targetUserId: 'user-456',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /routes/shared/with-me', () => {
    it('should get routes shared with user', async () => {
      const mockSharedRoutes = [
        {
          id: 'route-1',
          userId: 'user-456',
          name: 'Shared Route 1',
          coordinates: mockCoordinates,
          distance: 5.0,
          estimatedTime: 1800,
          difficulty: 'EASY',
          averageRating: 4.5,
          reviewCount: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (routeService.getSharedRoutes as jest.Mock).mockResolvedValueOnce({
        routes: mockSharedRoutes,
        total: 1,
      });

      const response = await request(app).get('/routes/shared/with-me');

      expect(response.status).toBe(200);
      expect(response.body.routes).toEqual(mockSharedRoutes);
      expect(response.body.total).toBe(1);
    });

    it('should support pagination', async () => {
      (routeService.getSharedRoutes as jest.Mock).mockResolvedValueOnce({
        routes: [],
        total: 50,
      });

      const response = await request(app).get('/routes/shared/with-me?limit=25&offset=25');

      expect(response.status).toBe(200);
      expect(routeService.getSharedRoutes).toHaveBeenCalledWith(mockUserId, 25, 25);
    });
  });
});
