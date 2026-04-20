import { Router, Request, Response } from 'express';
import * as gpsService from '../services/gpsService';
import { logger } from '../logging/logger';

const router = Router();

/**
 * POST /gps/sessions
 * Create a new GPS session
 */
router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { workoutId, startTime } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const session = await gpsService.createGPSSession(userId, workoutId, startTime);

    res.status(201).json(session);
  } catch (error) {
    logger.error('Failed to create GPS session', error as Error);
    res.status(500).json({ error: 'Failed to create GPS session' });
  }
});

/**
 * GET /gps/sessions
 * List user's GPS sessions with pagination
 * Query params: limit, offset
 */
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { sessions, total } = await gpsService.listGPSSessions(userId, limit, offset);

    res.json({
      sessions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to list GPS sessions', error as Error);
    res.status(500).json({ error: 'Failed to list GPS sessions' });
  }
});

/**
 * GET /gps/sessions/:sessionId
 * Get a specific GPS session with coordinates
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const session = await gpsService.getGPSSession(userId, sessionId);

    if (!session) {
      res.status(404).json({ error: 'GPS session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    logger.error('Failed to get GPS session', error as Error);
    res.status(500).json({ error: 'Failed to get GPS session' });
  }
});

/**
 * POST /gps/sessions/:sessionId/coordinates
 * Add a single GPS coordinate to a session
 */
router.post('/sessions/:sessionId/coordinates', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { latitude, longitude, elevation, accuracy, timestamp } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Latitude and longitude are required' });
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      res.status(400).json({ error: 'Invalid latitude or longitude' });
      return;
    }

    const coordinate = await gpsService.addGPSCoordinate(
      sessionId,
      latitude,
      longitude,
      elevation,
      accuracy,
      timestamp
    );

    res.status(201).json(coordinate);
  } catch (error) {
    logger.error('Failed to add GPS coordinate', error as Error);
    res.status(500).json({ error: 'Failed to add GPS coordinate' });
  }
});

/**
 * POST /gps/sessions/:sessionId/coordinates/batch
 * Add multiple GPS coordinates in batch
 */
router.post('/sessions/:sessionId/coordinates/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { coordinates } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      res.status(400).json({ error: 'Coordinates array is required and must not be empty' });
      return;
    }

    // Validate coordinates
    for (const coord of coordinates) {
      if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
        res.status(400).json({ error: 'Each coordinate must have latitude and longitude' });
        return;
      }

      if (coord.latitude < -90 || coord.latitude > 90 || coord.longitude < -180 || coord.longitude > 180) {
        res.status(400).json({ error: 'Invalid latitude or longitude in coordinates' });
        return;
      }
    }

    const addedCoordinates = await gpsService.addGPSCoordinatesBatch(sessionId, coordinates);

    res.status(201).json({
      count: addedCoordinates.length,
      coordinates: addedCoordinates,
    });
  } catch (error) {
    logger.error('Failed to add GPS coordinates batch', error as Error);
    res.status(500).json({ error: 'Failed to add GPS coordinates batch' });
  }
});

/**
 * POST /gps/sessions/:sessionId/complete
 * Complete a GPS session with calculations
 */
router.post('/sessions/:sessionId/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { endTime } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const session = await gpsService.completeGPSSession(userId, sessionId, endTime);

    res.json(session);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to complete GPS session', error as Error);
    res.status(500).json({ error: 'Failed to complete GPS session' });
  }
});

/**
 * DELETE /gps/sessions/:sessionId
 * Delete a GPS session
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await gpsService.deleteGPSSession(userId, sessionId);

    res.status(204).send();
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to delete GPS session', error as Error);
    res.status(500).json({ error: 'Failed to delete GPS session' });
  }
});

export default router;
