import { Router, Request, Response } from 'express';
import * as routeService from '../services/routeService';
import { logger } from '../logging/logger';

const router = Router();

/**
 * POST /routes
 * Create a new route
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { name, description, coordinates, distance, estimatedTime, difficulty } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || !coordinates || typeof distance !== 'number' || typeof estimatedTime !== 'number') {
      res.status(400).json({ error: 'name, coordinates, distance, and estimatedTime are required' });
      return;
    }

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      res.status(400).json({ error: 'coordinates must be a non-empty array' });
      return;
    }

    if (!['EASY', 'MODERATE', 'HARD'].includes(difficulty)) {
      res.status(400).json({ error: 'difficulty must be EASY, MODERATE, or HARD' });
      return;
    }

    const route = await routeService.createRoute(
      userId,
      name,
      description,
      coordinates,
      distance,
      estimatedTime,
      difficulty
    );

    res.status(201).json(route);
  } catch (error) {
    logger.error('Failed to create route', error as Error);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

/**
 * GET /routes
 * List user's routes with pagination
 * Query params: limit, offset
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { routes, total } = await routeService.listUserRoutes(userId, limit, offset);

    res.json({
      routes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to list routes', error as Error);
    res.status(500).json({ error: 'Failed to list routes' });
  }
});

/**
 * GET /routes/:routeId
 * Get a specific route with ratings
 */
router.get('/:routeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const route = await routeService.getRoute(routeId);

    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    res.json(route);
  } catch (error) {
    logger.error('Failed to get route', error as Error);
    res.status(500).json({ error: 'Failed to get route' });
  }
});

/**
 * PUT /routes/:routeId
 * Update a route
 */
router.put('/:routeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;
    const { name, description, coordinates, distance, estimatedTime, difficulty } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (difficulty && !['EASY', 'MODERATE', 'HARD'].includes(difficulty)) {
      res.status(400).json({ error: 'difficulty must be EASY, MODERATE, or HARD' });
      return;
    }

    const route = await routeService.updateRoute(
      routeId,
      userId,
      name,
      description,
      coordinates,
      distance,
      estimatedTime,
      difficulty
    );

    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    res.json(route);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('Unauthorized')) {
      res.status(403).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to update route', error as Error);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

/**
 * DELETE /routes/:routeId
 * Delete a route
 */
router.delete('/:routeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await routeService.deleteRoute(routeId, userId);

    res.status(204).send();
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    if (errorMsg.includes('Unauthorized')) {
      res.status(403).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to delete route', error as Error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

/**
 * POST /routes/:routeId/rate
 * Rate a route
 */
router.post('/:routeId/rate', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;
    const { rating, review } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (typeof rating !== 'number') {
      res.status(400).json({ error: 'rating is required and must be a number' });
      return;
    }

    const routeRating = await routeService.rateRoute(routeId, userId, rating, review);

    res.status(201).json(routeRating);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    if (errorMsg.includes('Rating must be')) {
      res.status(400).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to rate route', error as Error);
    res.status(500).json({ error: 'Failed to rate route' });
  }
});

/**
 * GET /routes/:routeId/ratings
 * Get ratings for a route
 * Query params: limit, offset
 */
router.get('/:routeId/ratings', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { ratings, total } = await routeService.getRouteRatings(routeId, limit, offset);

    res.json({
      ratings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to get route ratings', error as Error);
    res.status(500).json({ error: 'Failed to get route ratings' });
  }
});

/**
 * GET /routes/:routeId/my-rating
 * Get current user's rating for a route
 */
router.get('/:routeId/my-rating', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rating = await routeService.getUserRouteRating(routeId, userId);

    if (!rating) {
      res.status(404).json({ error: 'No rating found' });
      return;
    }

    res.json(rating);
  } catch (error) {
    logger.error('Failed to get user route rating', error as Error);
    res.status(500).json({ error: 'Failed to get user route rating' });
  }
});

/**
 * POST /routes/:routeId/share
 * Share a route with another user
 */
router.post('/:routeId/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routeId } = req.params;
    const { targetUserId } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    await routeService.shareRoute(routeId, userId, targetUserId);

    res.status(201).json({ message: 'Route shared successfully' });
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    if (errorMsg.includes('Unauthorized')) {
      res.status(403).json({ error: errorMsg });
      return;
    }
    logger.error('Failed to share route', error as Error);
    res.status(500).json({ error: 'Failed to share route' });
  }
});

/**
 * GET /routes/shared/with-me
 * Get routes shared with the current user
 * Query params: limit, offset
 */
router.get('/shared/with-me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { routes, total } = await routeService.getSharedRoutes(userId, limit, offset);

    res.json({
      routes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to get shared routes', error as Error);
    res.status(500).json({ error: 'Failed to get shared routes' });
  }
});

export default router;
