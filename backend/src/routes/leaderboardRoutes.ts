import express, { Request, Response } from 'express';
import * as leaderboardService from '../services/leaderboardService';
import { logger } from '../logging/logger';
import { verifyToken } from './authRoutes';

const router = express.Router();

/**
 * GET /leaderboards/global
 * Get global leaderboard with pagination
 * 
 * Query parameters:
 * - limit: number of results (default: 100, max: 1000)
 * - offset: pagination offset (default: 0)
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 */
router.get('/global', verifyToken, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Validate parameters
    leaderboardService.validateLeaderboardParams(limit, offset);

    const leaderboard = await leaderboardService.getGlobalLeaderboard(limit, offset);

    res.json({
      type: 'global',
      limit,
      offset,
      entries: leaderboard,
    });
  } catch (error) {
    logger.error('Error fetching global leaderboard', error as Error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /leaderboards/friends
 * Get friends leaderboard with pagination
 * 
 * Query parameters:
 * - limit: number of results (default: 100, max: 1000)
 * - offset: pagination offset (default: 0)
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 */
router.get('/friends', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Validate parameters
    leaderboardService.validateLeaderboardParams(limit, offset);

    const leaderboard = await leaderboardService.getFriendsLeaderboard(userId, limit, offset);

    res.json({
      type: 'friends',
      limit,
      offset,
      entries: leaderboard,
    });
  } catch (error) {
    logger.error('Error fetching friends leaderboard', error as Error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /leaderboards/weekly
 * Get weekly leaderboard with pagination
 * 
 * Query parameters:
 * - limit: number of results (default: 100, max: 1000)
 * - offset: pagination offset (default: 0)
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 */
router.get('/weekly', verifyToken, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Validate parameters
    leaderboardService.validateLeaderboardParams(limit, offset);

    const leaderboard = await leaderboardService.getWeeklyLeaderboard(limit, offset);

    res.json({
      type: 'weekly',
      limit,
      offset,
      entries: leaderboard,
    });
  } catch (error) {
    logger.error('Error fetching weekly leaderboard', error as Error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /leaderboards/:type/position/:userId
 * Get user's position on a specific leaderboard with nearby competitors
 * 
 * Path parameters:
 * - type: 'global', 'friends', or 'weekly'
 * - userId: user ID to get position for
 * 
 * **Validates: Requirements 9.4, 9.5**
 */
router.get('/:type/position/:userId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, userId } = req.params;

    // Validate leaderboard type
    if (!['global', 'friends', 'weekly'].includes(type)) {
      res.status(400).json({ error: 'Invalid leaderboard type' });
      return;
    }

    // Get user's rank position
    const position = await leaderboardService.getUserRankPosition(
      userId,
      type as 'global' | 'friends' | 'weekly'
    );

    // Get nearby competitors (±5 positions)
    const nearby = await leaderboardService.getNearbyCompetitors(
      userId,
      type as 'global' | 'weekly'
    );

    res.json({
      type,
      userId,
      position,
      nearbyCompetitors: nearby,
    });
  } catch (error) {
    logger.error('Error fetching user position', error as Error);
    res.status(500).json({ error: 'Failed to fetch user position' });
  }
});

export default router;
