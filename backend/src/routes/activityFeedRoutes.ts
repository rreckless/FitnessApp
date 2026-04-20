import express, { Request, Response } from 'express';
import * as activityFeedService from '../services/activityFeedService';
import { logger } from '../logging/logger';
import { verifyToken } from './authRoutes';

const router = express.Router();

/**
 * GET /activity-feed
 * Get activity feed for the authenticated user with pagination
 * 
 * Query parameters:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 50, max: 100)
 * 
 * **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6**
 */
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

    const { entries, total } = await activityFeedService.getActivityFeed(userId, page, pageSize);

    res.json({
      entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error('Error fetching activity feed', error as Error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

export default router;
