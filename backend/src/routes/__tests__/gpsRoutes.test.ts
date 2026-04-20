import request from 'supertest';
import express from 'express';
import gpsRoutes from '../gpsRoutes';
import * as gpsService from '../../services/gpsService';

// Mock the GPS service
jest.mock('../../services/gpsService');

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

app.use('/gps', gpsRoutes);

describe('GPS Routes', () => {
  const mockUserId = 'user-123';
  const mockSessionId = 'session-123';
  const mockWorkoutId = 'workout-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /gps/sessions', () => {
    it('should create a new GPS session', async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        workoutId: mockWorkoutId,
        startTime: new Date().toISOString(),
        retentionTier: 'RAW',
      };

      (gpsService.createGPSSession as jest.Mock).mockResolvedValueOnce(mockSession);

      const response = await request(app)
        .post('/gps/sessions')
        .send({ workoutId: mockWorkoutId });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockSession);
    });

    it('should return 401 if not authenticated', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/gps', gpsRoutes);

      const response = await request(appNoAuth)
        .post('/gps/sessions')
        .send({ workoutId: mockWorkoutId });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /gps/sessions', () => {
    it('should list user GPS sessions', async () => {
      const mockSessions = [
        { id: 'session-1', userId: mockUserId, startTime: new Date().toISOString() },
        { id: 'session-2', userId: mockUserId, startTime: new Date().toISOString() },
      ];

      (gpsService.listGPSSessions as jest.Mock).mockResolvedValueOnce({
        sessions: mockSessions,
        total: 2,
      });

      const response = await request(app).get('/gps/sessions');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toEqual(mockSessions);
      expect(response.body.total).toBe(2);
    });

    it('should support pagination', async () => {
      (gpsService.listGPSSessions as jest.Mock).mockResolvedValueOnce({
        sessions: [],
        total: 100,
      });

      const response = await request(app).get('/gps/sessions?limit=25&offset=50');

      expect(response.status).toBe(200);
      expect(gpsService.listGPSSessions).toHaveBeenCalledWith(mockUserId, 25, 50);
    });

    it('should cap limit at 500', async () => {
      (gpsService.listGPSSessions as jest.Mock).mockResolvedValueOnce({
        sessions: [],
        total: 0,
      });

      await request(app).get('/gps/sessions?limit=1000');

      expect(gpsService.listGPSSessions).toHaveBeenCalledWith(mockUserId, 500, 0);
    });
  });

  describe('GET /gps/sessions/:sessionId', () => {
    it('should retrieve a GPS session with coordinates', async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        startTime: new Date().toISOString(),
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: new Date().toISOString() },
        ],
      };

      (gpsService.getGPSSession as jest.Mock).mockResolvedValueOnce(mockSession);

      const response = await request(app).get(`/gps/sessions/${mockSessionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSession);
    });

    it('should return 404 if session not found', async () => {
      (gpsService.getGPSSession as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app).get(`/gps/sessions/nonexistent`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /gps/sessions/:sessionId/coordinates', () => {
    it('should add a single GPS coordinate', async () => {
      const mockCoordinate = {
        id: 'coord-1',
        sessionId: mockSessionId,
        latitude: 40.7128,
        longitude: -74.006,
        elevation: 10,
        accuracy: 5,
        timestamp: new Date().toISOString(),
      };

      (gpsService.addGPSCoordinate as jest.Mock).mockResolvedValueOnce(mockCoordinate);

      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates`)
        .send({
          latitude: 40.7128,
          longitude: -74.006,
          elevation: 10,
          accuracy: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCoordinate);
    });

    it('should validate latitude and longitude', async () => {
      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates`)
        .send({ latitude: 'invalid', longitude: -74.006 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Latitude and longitude are required');
    });

    it('should reject invalid latitude', async () => {
      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates`)
        .send({ latitude: 91, longitude: -74.006 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid latitude or longitude');
    });

    it('should reject invalid longitude', async () => {
      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates`)
        .send({ latitude: 40.7128, longitude: 181 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid latitude or longitude');
    });
  });

  describe('POST /gps/sessions/:sessionId/coordinates/batch', () => {
    it('should add multiple GPS coordinates', async () => {
      const mockCoordinates = [
        { id: 'coord-1', latitude: 40.7128, longitude: -74.006 },
        { id: 'coord-2', latitude: 40.7129, longitude: -74.0061 },
      ];

      (gpsService.addGPSCoordinatesBatch as jest.Mock).mockResolvedValueOnce(mockCoordinates);

      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates/batch`)
        .send({
          coordinates: [
            { latitude: 40.7128, longitude: -74.006 },
            { latitude: 40.7129, longitude: -74.0061 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.count).toBe(2);
      expect(response.body.coordinates).toEqual(mockCoordinates);
    });

    it('should reject empty coordinates array', async () => {
      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates/batch`)
        .send({ coordinates: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must not be empty');
    });

    it('should validate all coordinates', async () => {
      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/coordinates/batch`)
        .send({
          coordinates: [
            { latitude: 40.7128, longitude: -74.006 },
            { latitude: 91, longitude: -74.0061 }, // Invalid
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid latitude or longitude');
    });
  });

  describe('POST /gps/sessions/:sessionId/complete', () => {
    it('should complete a GPS session', async () => {
      const mockCompletedSession = {
        id: mockSessionId,
        userId: mockUserId,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 3600,
        distance: 5.2,
        averagePace: 11.5,
      };

      (gpsService.completeGPSSession as jest.Mock).mockResolvedValueOnce(mockCompletedSession);

      const response = await request(app)
        .post(`/gps/sessions/${mockSessionId}/complete`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCompletedSession);
    });

    it('should return 404 if session not found', async () => {
      (gpsService.completeGPSSession as jest.Mock).mockRejectedValueOnce(
        new Error('GPS session not found')
      );

      const response = await request(app)
        .post(`/gps/sessions/nonexistent/complete`)
        .send({});

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /gps/sessions/:sessionId', () => {
    it('should delete a GPS session', async () => {
      (gpsService.deleteGPSSession as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app).delete(`/gps/sessions/${mockSessionId}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 if session not found', async () => {
      (gpsService.deleteGPSSession as jest.Mock).mockRejectedValueOnce(
        new Error('GPS session not found')
      );

      const response = await request(app).delete(`/gps/sessions/nonexistent`);

      expect(response.status).toBe(404);
    });
  });
});
