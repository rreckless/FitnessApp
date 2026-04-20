import { Router, Request, Response } from 'express';
import * as bodyTrackingService from '../services/bodyTrackingService';
import { logger } from '../logging/logger';

const router = Router();

// MARK: - Body Weight Endpoints

/**
 * POST /body/weight
 * Log a new body weight entry
 */
router.post('/weight', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { weight, notes, recordedAt } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof weight !== 'number' || weight <= 0) {
      return res.status(400).json({ error: 'Weight must be a positive number' });
    }

    const bodyWeight = await bodyTrackingService.logBodyWeight(userId, weight, notes, recordedAt);

    res.status(201).json(bodyWeight);
  } catch (error) {
    logger.error('Failed to log body weight', error as Error);
    res.status(500).json({ error: 'Failed to log body weight' });
  }
});

/**
 * GET /body/weight
 * Get body weight history
 * Query params: limit, offset
 */
router.get('/weight', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await bodyTrackingService.getBodyWeightHistory(userId, limit, offset);
    const trendLine = await bodyTrackingService.calculateWeightTrendLine(userId);

    res.json({
      history,
      trendLine,
      total: history.length,
    });
  } catch (error) {
    logger.error('Failed to get body weight history', error as Error);
    res.status(500).json({ error: 'Failed to get body weight history' });
  }
});

/**
 * PUT /body/weight/:weightId
 * Update a body weight entry (within 7 days)
 */
router.put('/weight/:weightId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { weightId } = req.params;
    const { weight, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof weight !== 'number' || weight <= 0) {
      return res.status(400).json({ error: 'Weight must be a positive number' });
    }

    const updated = await bodyTrackingService.updateBodyWeight(userId, weightId, weight, notes);

    res.json(updated);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('Cannot edit') || errorMsg.includes('not found')) {
      return res.status(400).json({ error: errorMsg });
    }
    logger.error('Failed to update body weight', error as Error);
    res.status(500).json({ error: 'Failed to update body weight' });
  }
});

/**
 * DELETE /body/weight/:weightId
 * Delete a body weight entry (within 7 days)
 */
router.delete('/weight/:weightId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { weightId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await bodyTrackingService.deleteBodyWeight(userId, weightId);

    res.status(204).send();
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('Cannot delete') || errorMsg.includes('not found')) {
      return res.status(400).json({ error: errorMsg });
    }
    logger.error('Failed to delete body weight', error as Error);
    res.status(500).json({ error: 'Failed to delete body weight' });
  }
});

// MARK: - Body Measurement Endpoints

/**
 * POST /body/measurements
 * Log a new body measurement entry
 */
router.post('/measurements', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { chest, waist, hips, arms, thighs, notes, recordedAt } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // At least one measurement must be provided
    if (!chest && !waist && !hips && !arms && !thighs) {
      return res.status(400).json({ error: 'At least one measurement must be provided' });
    }

    const measurement = await bodyTrackingService.logBodyMeasurement(
      userId,
      { chest, waist, hips, arms, thighs },
      notes,
      recordedAt
    );

    res.status(201).json(measurement);
  } catch (error) {
    logger.error('Failed to log body measurement', error as Error);
    res.status(500).json({ error: 'Failed to log body measurement' });
  }
});

/**
 * GET /body/measurements
 * Get body measurement history
 * Query params: limit, offset
 */
router.get('/measurements', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await bodyTrackingService.getBodyMeasurementHistory(userId, limit, offset);

    // Calculate changes for each measurement type
    const changes = {
      chest: await bodyTrackingService.calculateMeasurementChange(userId, 'chest'),
      waist: await bodyTrackingService.calculateMeasurementChange(userId, 'waist'),
      hips: await bodyTrackingService.calculateMeasurementChange(userId, 'hips'),
      arms: await bodyTrackingService.calculateMeasurementChange(userId, 'arms'),
      thighs: await bodyTrackingService.calculateMeasurementChange(userId, 'thighs'),
    };

    res.json({
      history,
      changes,
      total: history.length,
    });
  } catch (error) {
    logger.error('Failed to get body measurement history', error as Error);
    res.status(500).json({ error: 'Failed to get body measurement history' });
  }
});

/**
 * PUT /body/measurements/:measurementId
 * Update a body measurement entry (within 7 days)
 */
router.put('/measurements/:measurementId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { measurementId } = req.params;
    const { chest, waist, hips, arms, thighs, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // At least one measurement must be provided
    if (!chest && !waist && !hips && !arms && !thighs) {
      return res.status(400).json({ error: 'At least one measurement must be provided' });
    }

    const updated = await bodyTrackingService.updateBodyMeasurement(
      userId,
      measurementId,
      { chest, waist, hips, arms, thighs },
      notes
    );

    res.json(updated);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('Cannot edit') || errorMsg.includes('not found')) {
      return res.status(400).json({ error: errorMsg });
    }
    logger.error('Failed to update body measurement', error as Error);
    res.status(500).json({ error: 'Failed to update body measurement' });
  }
});

/**
 * DELETE /body/measurements/:measurementId
 * Delete a body measurement entry (within 7 days)
 */
router.delete('/measurements/:measurementId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { measurementId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await bodyTrackingService.deleteBodyMeasurement(userId, measurementId);

    res.status(204).send();
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('Cannot delete') || errorMsg.includes('not found')) {
      return res.status(400).json({ error: errorMsg });
    }
    logger.error('Failed to delete body measurement', error as Error);
    res.status(500).json({ error: 'Failed to delete body measurement' });
  }
});

// MARK: - Progress Photo Endpoints

/**
 * POST /body/photos
 * Upload a progress photo
 */
router.post('/photos', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { imageUrl, thumbnailUrl, notes, recordedAt } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const photo = await bodyTrackingService.uploadProgressPhoto(userId, imageUrl, thumbnailUrl, notes, recordedAt);

    res.status(201).json(photo);
  } catch (error) {
    logger.error('Failed to upload progress photo', error as Error);
    res.status(500).json({ error: 'Failed to upload progress photo' });
  }
});

/**
 * GET /body/photos
 * Get progress photo gallery
 * Query params: limit, offset
 */
router.get('/photos', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const photos = await bodyTrackingService.getProgressPhotoGallery(userId, limit, offset);

    res.json({
      photos,
      total: photos.length,
    });
  } catch (error) {
    logger.error('Failed to get progress photo gallery', error as Error);
    res.status(500).json({ error: 'Failed to get progress photo gallery' });
  }
});

/**
 * GET /body/photos/:photoId
 * Get a specific progress photo
 */
router.get('/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { photoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const photo = await bodyTrackingService.getProgressPhoto(userId, photoId);

    res.json(photo);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    logger.error('Failed to get progress photo', error as Error);
    res.status(500).json({ error: 'Failed to get progress photo' });
  }
});

/**
 * DELETE /body/photos/:photoId
 * Delete a progress photo
 */
router.delete('/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { photoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await bodyTrackingService.deleteProgressPhoto(userId, photoId);

    res.status(204).send();
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    logger.error('Failed to delete progress photo', error as Error);
    res.status(500).json({ error: 'Failed to delete progress photo' });
  }
});

/**
 * GET /body/photos/compare
 * Get two photos for side-by-side comparison
 * Query params: photoId1, photoId2
 */
router.get('/photos/compare', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { photoId1, photoId2 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!photoId1 || !photoId2) {
      return res.status(400).json({ error: 'Both photoId1 and photoId2 are required' });
    }

    const comparison = await bodyTrackingService.getPhotoComparison(userId, photoId1 as string, photoId2 as string);

    res.json(comparison);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    logger.error('Failed to get photo comparison', error as Error);
    res.status(500).json({ error: 'Failed to get photo comparison' });
  }
});

/**
 * PUT /body/photos/:photoId
 * Update progress photo notes
 */
router.put('/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { photoId } = req.params;
    const { notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const photo = await bodyTrackingService.updateProgressPhotoNotes(userId, photoId, notes);

    res.json(photo);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    logger.error('Failed to update progress photo notes', error as Error);
    res.status(500).json({ error: 'Failed to update progress photo notes' });
  }
});

export default router;
