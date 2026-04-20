import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { verifyToken } from './authRoutes';
import {
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences,
  uploadProfilePicture,
  deleteUserProfile,
} from '../services/userProfileService';
import { logger } from '../logging/logger';

const router = express.Router();

/**
 * GET /users/:id
 * Get user profile
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const profile = await getUserProfile(id);

    res.status(200).json(profile);
  } catch (error) {
    logger.error('Get user profile endpoint error', error as Error);
    res.status(404).json({ error: (error as Error).message });
  }
});

/**
 * PUT /users/:id
 * Update user profile (requires authentication)
 */
router.put(
  '/:id',
  verifyToken,
  [
    body('name').optional().trim().notEmpty(),
    body('bio').optional().trim(),
    body('profilePictureUrl').optional().isURL(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const userId = (req as any).userId;

      // Verify user is updating their own profile
      if (id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updates = req.body;

      const profile = await updateUserProfile(id, updates);

      res.status(200).json(profile);
    } catch (error) {
      logger.error('Update user profile endpoint error', error as Error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /users/:id/preferences
 * Get user preferences
 */
router.get('/:id/preferences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const preferences = await getUserPreferences(id);

    res.status(200).json(preferences);
  } catch (error) {
    logger.error('Get user preferences endpoint error', error as Error);
    res.status(404).json({ error: (error as Error).message });
  }
});

/**
 * PUT /users/:id/preferences
 * Update user preferences (requires authentication)
 */
router.put(
  '/:id/preferences',
  verifyToken,
  [
    body('fitnessGoals').optional().isArray(),
    body('experienceLevel').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    body('workoutFrequency').optional().isInt({ min: 1, max: 7 }),
    body('availableEquipment').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const userId = (req as any).userId;

      // Verify user is updating their own preferences
      if (id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updates = req.body;

      const preferences = await updateUserPreferences(id, updates);

      res.status(200).json(preferences);
    } catch (error) {
      logger.error('Update user preferences endpoint error', error as Error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /users/:id/avatar
 * Upload profile picture (requires authentication)
 */
router.post(
  '/:id/avatar',
  verifyToken,
  [body('pictureUrl').isURL()],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const userId = (req as any).userId;
      const { pictureUrl } = req.body;

      // Verify user is uploading their own avatar
      if (id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const profile = await uploadProfilePicture(id, pictureUrl);

      res.status(200).json(profile);
    } catch (error) {
      logger.error('Upload profile picture endpoint error', error as Error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * DELETE /users/:id
 * Delete user profile (requires authentication)
 */
router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Verify user is deleting their own profile
    if (id !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const result = await deleteUserProfile(id);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Delete user profile endpoint error', error as Error);
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
