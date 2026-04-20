import { Router, Request, Response } from 'express';
import * as workoutService from '../services/workoutService';
import logger from '../logging/logger';

const router = Router();

// MARK: - Middleware

/**
 * Verify user is authenticated
 */
function requireAuth(req: Request, res: Response, next: Function) {
  const userId = (req as any).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// MARK: - Routes

/**
 * POST /workouts - Create a new workout
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { startTime, exercises, notes, isOfflineCreated } = req.body;

    if (!startTime) {
      return res.status(400).json({ error: 'startTime is required' });
    }

    const workout = await workoutService.createWorkout({
      userId,
      startTime,
      exercises,
      notes,
      isOfflineCreated,
    });

    res.status(201).json(workout);
  } catch (error) {
    logger.error('Failed to create workout', error as Error);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

/**
 * GET /workouts - Get all workouts for user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const result = await workoutService.getWorkouts(userId, page, pageSize);

    res.json(result);
  } catch (error) {
    logger.error('Failed to get workouts', error as Error);
    res.status(500).json({ error: 'Failed to get workouts' });
  }
});

/**
 * GET /workouts/:id - Get a specific workout
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const workout = await workoutService.getWorkout(id, userId);

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json(workout);
  } catch (error) {
    logger.error('Failed to get workout', error as Error);
    res.status(500).json({ error: 'Failed to get workout' });
  }
});

/**
 * PUT /workouts/:id - Update a workout
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { endTime, notes } = req.body;

    const workout = await workoutService.updateWorkout(id, userId, {
      endTime,
      notes,
    });

    res.json(workout);
  } catch (error) {
    logger.error('Failed to update workout', error as Error);
    res.status(500).json({ error: 'Failed to update workout' });
  }
});

/**
 * DELETE /workouts/:id - Delete a workout
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    await workoutService.deleteWorkout(id, userId);

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete workout', error as Error);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

/**
 * POST /workouts/:id/exercises - Add exercise to workout
 */
router.post('/:id/exercises', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { exerciseId, sets } = req.body;

    if (!exerciseId || !sets) {
      return res.status(400).json({ error: 'exerciseId and sets are required' });
    }

    // Validate sets
    workoutService.validateExerciseSets(sets);

    const exercise = await workoutService.addExerciseToWorkout(id, userId, {
      exerciseId,
      sets,
    });

    res.status(201).json(exercise);
  } catch (error) {
    logger.error('Failed to add exercise to workout', error as Error);
    res.status(500).json({ error: 'Failed to add exercise to workout' });
  }
});

/**
 * POST /workouts/:id/complete - Complete a workout
 */
router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const workout = await workoutService.completeWorkout(id, userId);

    res.json(workout);
  } catch (error) {
    logger.error('Failed to complete workout', error as Error);
    res.status(500).json({ error: 'Failed to complete workout' });
  }
});

export default router;
