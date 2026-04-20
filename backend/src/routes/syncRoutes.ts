import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { SyncService, SyncPushRequest } from '../services/syncService';
import { verifyToken } from './authRoutes';
import { getPool } from '../database/connection';
import { logger, SecurityEventType } from '../logging/logger';

const router = Router();
const syncService = new SyncService(getPool());

/**
 * ✅ Fix 2.3: Rate limiter for sync endpoints
 * 10 requests per minute per user
 */
const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many sync requests, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many sync requests, please try again later',
      retryAfter: 60, // 1 minute in seconds
    });
  },
});

/**
 * POST /sync/pull
 * Pull changes from cloud (get updates since last sync)
 * ✅ Fix 1.1: userId extracted only from JWT token, not request body
 * ✅ Fix 2.3: Rate limiting applied
 * ✅ Fix 2.4: Security logging
 */
router.post('/pull', syncLimiter, verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lastSyncAt } = req.body;

    // ✅ Fix 2.4: Log sync operation
    logger.security({
      eventType: SecurityEventType.SYNC_OPERATION,
      userId,
      timestamp: new Date(),
      details: { operation: 'pull', lastSyncAt },
    });

    const changes = await syncService.pullChanges(
      userId,
      lastSyncAt ? new Date(lastSyncAt) : undefined
    );

    res.json({
      success: true,
      changes,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Pull sync error:', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to pull changes',
    });
  }
});

/**
 * POST /sync/push
 * Push local changes to cloud
 * ✅ Fix 1.1: userId extracted only from JWT token, not request body
 * ✅ Fix 1.5: Input validation on operations array
 * ✅ Fix 2.3: Rate limiting applied
 * ✅ Fix 2.4: Security logging
 */
router.post(
  '/push',
  syncLimiter,
  verifyToken,
  [
    // ✅ Validate operations array
    body('operations')
      .isArray({ min: 1 })
      .withMessage('Operations must be a non-empty array'),

    // ✅ Validate each operation
    body('operations.*.operation')
      .isIn(['CREATE', 'UPDATE', 'DELETE'])
      .withMessage('Invalid operation type'),

    body('operations.*.entityType')
      .isIn(['WORKOUT', 'WEIGHT', 'MEASUREMENT', 'PHOTO'])
      .withMessage('Invalid entity type'),

    body('operations.*.entityId')
      .isUUID()
      .withMessage('Entity ID must be valid UUID'),

    body('operations.*.payload')
      .isObject()
      .withMessage('Payload must be an object'),

    body('operations.*.clientTimestamp')
      .isISO8601()
      .withMessage('Client timestamp must be ISO8601 date'),
  ],
  async (req: Request, res: Response) => {
    try {
      // ✅ Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warning('Invalid sync push request', {
          userId: (req as any).userId,
          errors: errors.array(),
        });
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { operations } = req.body as SyncPushRequest;

      // ✅ Fix 2.4: Log sync operation
      logger.security({
        eventType: SecurityEventType.SYNC_OPERATION,
        userId,
        timestamp: new Date(),
        details: {
          operation: 'push',
          operationCount: operations.length,
          entityTypes: [...new Set(operations.map((op) => op.entityType))],
        },
      });

      const result = await syncService.pushChanges(userId, operations);

      res.json({
        success: true,
        synced: result.synced,
        conflicts: result.conflicts,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Push sync error:', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to push changes',
      });
    }
  }
);

/**
 * GET /sync/status
 * Get sync status for current user
 * ✅ Fix 1.1: userId extracted only from JWT token
 * ✅ Fix 2.3: Rate limiting applied
 * ✅ Fix 2.4: Security logging
 */
router.get('/status', syncLimiter, verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // ✅ Fix 2.4: Log sync status check
    logger.security({
      eventType: SecurityEventType.SYNC_OPERATION,
      userId,
      timestamp: new Date(),
      details: { operation: 'status' },
    });

    const status = await syncService.getSyncStatus(userId);

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    logger.error('Sync status error:', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
    });
  }
});

export default router;
