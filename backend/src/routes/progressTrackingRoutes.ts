import { Router, Request, Response } from 'express';
import * as progressTrackingService from '../services/progressTrackingService';
import { logger } from '../logging/logger';

const router = Router();

// MARK: - Personal Records Endpoints

/**
 * GET /progress/prs
 * Get all personal records for the authenticated user
 */
router.get('/prs', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prs = await progressTrackingService.getUserPersonalRecords(userId);

    res.json({
      prs,
      total: prs.length,
    });
  } catch (error) {
    logger.error('Failed to get personal records', error as Error);
    res.status(500).json({ error: 'Failed to get personal records' });
  }
});

/**
 * GET /progress/prs/:exerciseId
 * Get PR history for a specific exercise
 */
router.get('/prs/:exerciseId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { exerciseId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await progressTrackingService.getExercisePRHistory(userId, exerciseId);

    res.json({
      exerciseId,
      history,
      total: history.length,
    });
  } catch (error) {
    logger.error('Failed to get exercise PR history', error as Error);
    res.status(500).json({ error: 'Failed to get exercise PR history' });
  }
});

// MARK: - Volume Endpoints

/**
 * GET /progress/volume
 * Get volume data for a specified period
 * Query params: period (week|month), startDate (ISO string)
 */
router.get('/volume', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { period = 'week', startDate } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!startDate || typeof startDate !== 'string') {
      return res.status(400).json({ error: 'startDate query parameter is required' });
    }

    let volumeData;

    if (period === 'week') {
      volumeData = await progressTrackingService.calculateWeeklyVolume(userId, startDate);
    } else if (period === 'month') {
      const date = new Date(startDate);
      volumeData = await progressTrackingService.calculateMonthlyVolume(userId, date.getFullYear(), date.getMonth() + 1);
    } else {
      return res.status(400).json({ error: 'Invalid period. Must be week or month' });
    }

    res.json(volumeData);
  } catch (error) {
    logger.error('Failed to get volume data', error as Error);
    res.status(500).json({ error: 'Failed to get volume data' });
  }
});

/**
 * GET /progress/volume/trends
 * Get volume trends over a date range
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/volume/trends', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const trends = await progressTrackingService.getVolumeTrends(userId, startDate, endDate);

    res.json({
      startDate,
      endDate,
      trends,
    });
  } catch (error) {
    logger.error('Failed to get volume trends', error as Error);
    res.status(500).json({ error: 'Failed to get volume trends' });
  }
});

/**
 * GET /progress/volume/by-muscle-group
 * Get volume breakdown by muscle group
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/volume/by-muscle-group', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const volumeByMuscleGroup = await progressTrackingService.getVolumeByMuscleGroup(userId, startDate, endDate);

    res.json({
      startDate,
      endDate,
      volumeByMuscleGroup,
    });
  } catch (error) {
    logger.error('Failed to get volume by muscle group', error as Error);
    res.status(500).json({ error: 'Failed to get volume by muscle group' });
  }
});

// MARK: - Chart Endpoints

/**
 * GET /progress/charts/:type
 * Get chart data for a specified type
 * Types: xp-progression, volume-muscle-group, exercise-distribution, pr-progression
 * Query params: startDate, endDate (ISO strings), exerciseId (for pr-progression)
 */
router.get('/charts/:type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type } = req.params;
    const { startDate, endDate, exerciseId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let chartData;

    switch (type) {
      case 'xp-progression':
        if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
          return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
        }
        chartData = await progressTrackingService.generateXPProgressionChart(userId, startDate, endDate);
        break;

      case 'volume-muscle-group':
        if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
          return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
        }
        chartData = await progressTrackingService.generateVolumeMuscleGroupChart(userId, startDate, endDate);
        break;

      case 'exercise-distribution':
        if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
          return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
        }
        chartData = await progressTrackingService.generateExerciseDistributionChart(userId, startDate, endDate);
        break;

      case 'pr-progression':
        if (!exerciseId || typeof exerciseId !== 'string') {
          return res.status(400).json({ error: 'exerciseId query parameter is required' });
        }
        chartData = await progressTrackingService.generatePRProgressionChart(userId, exerciseId);
        break;

      default:
        return res.status(400).json({
          error: 'Invalid chart type. Must be one of: xp-progression, volume-muscle-group, exercise-distribution, pr-progression',
        });
    }

    res.json(chartData);
  } catch (error) {
    logger.error('Failed to get chart data', error as Error);
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

export default router;
