import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  validateWorkoutData,
  detectFraudPatterns,
  flagWorkout,
  getFlaggedWorkouts,
  reviewFlaggedWorkout,
  rollbackWorkoutXP,
  getFraudStatistics,
} from '../services/fraudDetectionService';
import { verifyToken } from './authRoutes';
import { query } from '../database/connection';
import { logger } from '../logging/logger';

const router = express.Router();

// Rate limiting for fraud detection endpoints
const fraudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: 'Too many fraud detection requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ✅ Task 3.2: POST /fraud/validate-workout
 * Validate workout data for anti-cheat constraints
 */
router.post(
  '/validate-workout',
  fraudLimiter,
  [
    body('repsPerSet').isArray().withMessage('repsPerSet must be an array'),
    body('weight').isInt({ min: 1, max: 1000 }).withMessage('Weight must be between 1 and 1000'),
    body('exerciseDuration').isInt({ min: 300, max: 14400 }).withMessage('Duration must be between 5 min and 4 hours'),
    body('totalReps').isInt({ min: 1, max: 100 }).withMessage('Total reps must be between 1 and 100'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { repsPerSet, weight, exerciseDuration, totalReps } = req.body;

      // Validate workout data
      const validation = validateWorkoutData(repsPerSet, weight, exerciseDuration, totalReps);

      res.status(200).json(validation);
    } catch (error) {
      logger.error('Workout validation endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.2: POST /fraud/detect-patterns
 * Detect fraud patterns in user workouts
 */
router.post(
  '/detect-patterns',
  verifyToken,
  fraudLimiter,
  [
    body('totalVolume').isInt({ min: 0 }).withMessage('Total volume must be a positive number'),
    body('totalXP').isInt({ min: 0 }).withMessage('Total XP must be a positive number'),
    body('duration').isInt({ min: 300, max: 14400 }).withMessage('Duration must be between 5 min and 4 hours'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { totalVolume, totalXP, duration } = req.body;

      // Detect fraud patterns
      const fraudAnalysis = await detectFraudPatterns(userId, {
        totalVolume,
        totalXP,
        duration,
      });

      res.status(200).json(fraudAnalysis);
    } catch (error) {
      logger.error('Fraud detection endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.2: GET /fraud/flagged-workouts
 * Get flagged workouts for admin review
 */
router.get(
  '/flagged-workouts',
  verifyToken,
  fraudLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      // Check if user is admin
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const reviewed = req.query.reviewed ? req.query.reviewed === 'true' : undefined;

      // Get flagged workouts
      const flaggedWorkouts = await getFlaggedWorkouts(limit, offset, reviewed);

      res.status(200).json({
        workouts: flaggedWorkouts,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('Get flagged workouts endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.2: POST /fraud/review-workout
 * Review flagged workout
 */
router.post(
  '/review-workout',
  verifyToken,
  fraudLimiter,
  [
    body('flaggedWorkoutId').notEmpty().withMessage('Flagged workout ID is required'),
    body('approved').isBoolean().withMessage('Approved must be a boolean'),
    body('reviewNotes').isString().withMessage('Review notes must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { flaggedWorkoutId, approved, reviewNotes } = req.body;

      // Check if user is admin
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Review flagged workout
      await reviewFlaggedWorkout(flaggedWorkoutId, approved, reviewNotes, userId);

      res.status(200).json({
        message: 'Workout reviewed successfully',
        approved,
      });
    } catch (error) {
      logger.error('Review workout endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.2: POST /fraud/rollback-xp
 * Rollback XP for fraudulent workout
 */
router.post(
  '/rollback-xp',
  verifyToken,
  fraudLimiter,
  [
    body('workoutId').notEmpty().withMessage('Workout ID is required'),
    body('userId').notEmpty().withMessage('User ID is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const adminId = (req as any).userId;
      const { workoutId, userId } = req.body;

      // Check if user is admin
      const userResult = await query('SELECT role FROM users WHERE id = $1', [adminId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Rollback XP
      await rollbackWorkoutXP(workoutId, userId);

      res.status(200).json({
        message: 'XP rolled back successfully',
      });
    } catch (error) {
      logger.error('Rollback XP endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.2: GET /fraud/statistics
 * Get fraud statistics
 */
router.get(
  '/statistics',
  verifyToken,
  fraudLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      // Check if user is admin
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get fraud statistics
      const stats = await getFraudStatistics();

      res.status(200).json(stats);
    } catch (error) {
      logger.error('Get fraud statistics endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
