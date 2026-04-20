import express, { Request, Response } from 'express';
import * as challengeService from '../services/challengeService';
import { logger } from '../logging/logger';
import { verifyToken } from './authRoutes';

const router = express.Router();

/**
 * POST /challenges
 * Create a new challenge
 * 
 * Body:
 * - name: Challenge name
 * - description: Challenge description
 * - type: FRIEND or COMMUNITY
 * - goalType: XP, VOLUME, or STREAK
 * - targetValue: Target value for the goal
 * - duration: Duration in days
 * - participants: Optional array of user IDs to invite
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3**
 */
router.post('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { name, description, type, goalType, targetValue, duration, participants } = req.body;

    if (!name || !description || !type || !goalType || !targetValue || !duration) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['FRIEND', 'COMMUNITY'].includes(type)) {
      res.status(400).json({ error: 'Invalid challenge type' });
      return;
    }

    if (!['XP', 'VOLUME', 'STREAK'].includes(goalType)) {
      res.status(400).json({ error: 'Invalid goal type' });
      return;
    }

    const challenge = await challengeService.createChallenge({
      creatorId: userId,
      name,
      description,
      type,
      goalType,
      targetValue,
      duration,
      participants,
    });

    res.status(201).json(challenge);
  } catch (error) {
    logger.error('Error creating challenge', error as Error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * GET /challenges
 * Get challenges with filtering
 * 
 * Query parameters:
 * - type: FRIEND or COMMUNITY (optional)
 * - goalType: XP, VOLUME, or STREAK (optional)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50)
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, goalType, page, pageSize } = req.query;

    const { challenges, total } = await challengeService.getChallenges({
      type: type as 'FRIEND' | 'COMMUNITY' | undefined,
      goalType: goalType as 'XP' | 'VOLUME' | 'STREAK' | undefined,
      page: parseInt(page as string) || 1,
      pageSize: Math.min(100, parseInt(pageSize as string) || 50),
    });

    res.json({
      challenges,
      pagination: {
        page: parseInt(page as string) || 1,
        pageSize: Math.min(100, parseInt(pageSize as string) || 50),
        total,
        totalPages: Math.ceil(total / (Math.min(100, parseInt(pageSize as string) || 50))),
      },
    });
  } catch (error) {
    logger.error('Error fetching challenges', error as Error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

/**
 * GET /challenges/:id
 * Get a specific challenge
 * 
 * Path parameters:
 * - id: Challenge ID
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const challenge = await challengeService.getChallenge(id);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    res.json(challenge);
  } catch (error) {
    logger.error('Error fetching challenge', error as Error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

/**
 * POST /challenges/:id/join
 * Join a challenge
 * 
 * Path parameters:
 * - id: Challenge ID
 * 
 * **Validates: Requirements 12.3, 12.5**
 */
router.post('/:id/join', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const progress = await challengeService.joinChallenge(id, userId);

    res.status(201).json(progress);
  } catch (error) {
    logger.error('Error joining challenge', error as Error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else if (message.includes('already')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to join challenge' });
    }
  }
});

/**
 * GET /challenges/:id/progress
 * Get challenge progress with ranking
 * 
 * Path parameters:
 * - id: Challenge ID
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50)
 * 
 * **Validates: Requirements 12.4, 12.5, 12.6**
 */
router.get('/:id/progress', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

    const { progress, total } = await challengeService.getChallengeLearnings(id, page, pageSize);

    res.json({
      progress,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error('Error fetching challenge progress', error as Error);
    res.status(500).json({ error: 'Failed to fetch challenge progress' });
  }
});

/**
 * GET /challenges/user/my-challenges
 * Get user's challenges
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
router.get('/user/my-challenges', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    const challenges = await challengeService.getUserChallenges(userId);

    res.json({ challenges });
  } catch (error) {
    logger.error('Error fetching user challenges', error as Error);
    res.status(500).json({ error: 'Failed to fetch user challenges' });
  }
});

export default router;
