import express, { Request, Response } from 'express';
import {
  getExercises,
  getExerciseById,
  searchExercises,
  getExercisesByMuscleGroup,
  createCustomExercise,
  getMuscleGroups,
} from '../services/exerciseService';
import { verifyToken } from './authRoutes';
import { logger } from '../logging/logger';

const router = express.Router();

/**
 * GET /exercises
 * Get all exercises with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { muscleGroup, difficulty, limit = 100, offset = 0 } = req.query;

    const exercises = await getExercises(
      muscleGroup as string | undefined,
      difficulty as string | undefined,
      parseInt(limit as string) || 100,
      parseInt(offset as string) || 0
    );

    res.status(200).json(exercises);
  } catch (error) {
    logger.error('Get exercises endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /exercises/search
 * Search exercises by name or description
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const exercises = await searchExercises(q as string, parseInt(limit as string) || 50);

    res.status(200).json(exercises);
  } catch (error) {
    logger.error('Search exercises endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /exercises/muscle-groups/:group
 * Get exercises by muscle group
 */
router.get('/muscle-groups/:group', async (req: Request, res: Response) => {
  try {
    const { group } = req.params;
    const { limit = 100 } = req.query;

    const exercises = await getExercisesByMuscleGroup(group, parseInt(limit as string) || 100);

    res.status(200).json(exercises);
  } catch (error) {
    logger.error('Get exercises by muscle group endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /exercises/muscle-groups
 * Get all muscle groups
 */
router.get('/muscle-groups', async (req: Request, res: Response) => {
  try {
    const muscleGroups = await getMuscleGroups();

    res.status(200).json(muscleGroups);
  } catch (error) {
    logger.error('Get muscle groups endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /exercises/:id
 * Get exercise by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const exercise = await getExerciseById(id);

    res.status(200).json(exercise);
  } catch (error) {
    logger.error('Get exercise endpoint error', error as Error);
    res.status(404).json({ error: (error as Error).message });
  }
});

/**
 * POST /exercises/custom
 * Create custom exercise (requires authentication)
 */
router.post('/custom', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      description,
      primaryMuscleGroup,
      secondaryMuscleGroups = [],
      difficulty = 'INTERMEDIATE',
      equipment = [],
    } = req.body;

    // Validate input
    if (!name || !primaryMuscleGroup) {
      res.status(400).json({ error: 'Name and primary muscle group are required' });
      return;
    }

    const exercise = await createCustomExercise(
      userId,
      name,
      description,
      primaryMuscleGroup,
      secondaryMuscleGroups,
      difficulty,
      equipment
    );

    res.status(201).json(exercise);
  } catch (error) {
    logger.error('Create custom exercise endpoint error', error as Error);
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
