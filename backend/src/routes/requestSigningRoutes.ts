import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  generateAPISecret,
  hashAPISecret,
  verifyAPISecret,
  generateSignature,
} from '../services/requestSigningService';
import { verifyToken } from './authRoutes';
import { query } from '../database/connection';
import { logger, SecurityEventType } from '../logging/logger';

const router = express.Router();

// Rate limiting for request signing endpoints
const signingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many request signing requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ✅ Task 3.3: POST /signing/generate-secret
 * Generate new API secret for user
 */
router.post(
  '/generate-secret',
  verifyToken,
  signingLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      // Generate new API secret
      const apiSecret = generateAPISecret();

      // Hash the secret for storage
      const hashedSecret = await hashAPISecret(apiSecret);

      // Store hashed secret in database
      await query(
        `UPDATE users SET api_secret_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hashedSecret, userId]
      );

      logger.logSecurityEvent(SecurityEventType.API_SECRET_GENERATED, {
        userId,
      });

      res.status(200).json({
        apiSecret,
        message: 'API secret generated successfully. Store this secret securely - you will not be able to see it again.',
      });
    } catch (error) {
      logger.error('Generate API secret endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.3: POST /signing/verify-secret
 * Verify API secret (for testing)
 */
router.post(
  '/verify-secret',
  verifyToken,
  signingLimiter,
  [body('apiSecret').notEmpty().withMessage('API secret is required')],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { apiSecret } = req.body;

      // Get user's API secret hash
      const userResult = await query(
        `SELECT api_secret_hash FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].api_secret_hash) {
        return res.status(400).json({ error: 'No API secret configured' });
      }

      // Verify secret
      const isValid = await verifyAPISecret(apiSecret, userResult.rows[0].api_secret_hash);

      if (!isValid) {
        logger.warning('Invalid API secret verification attempt', { userId });
        return res.status(401).json({ error: 'Invalid API secret' });
      }

      res.status(200).json({
        message: 'API secret verified successfully',
        isValid: true,
      });
    } catch (error) {
      logger.error('Verify API secret endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.3: POST /signing/generate-test-signature
 * Generate test signature for request (for client testing)
 */
router.post(
  '/generate-test-signature',
  verifyToken,
  signingLimiter,
  [
    body('requestBody').isObject().withMessage('Request body must be an object'),
    body('apiSecret').notEmpty().withMessage('API secret is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { requestBody, apiSecret } = req.body;

      // Generate timestamp
      const timestamp = Math.floor(Date.now() / 1000);

      // Generate signature
      const signature = generateSignature(requestBody, timestamp, apiSecret);

      res.status(200).json({
        signature,
        timestamp,
        headers: {
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
        },
        message: 'Test signature generated. Use these headers in your request.',
      });
    } catch (error) {
      logger.error('Generate test signature endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.3: GET /signing/status
 * Get API secret status for user
 */
router.get('/status', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get user's API secret status
    const userResult = await query(
      `SELECT api_secret_hash, updated_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasSecret = !!userResult.rows[0].api_secret_hash;
    const lastUpdated = userResult.rows[0].updated_at;

    res.status(200).json({
      hasAPISecret: hasSecret,
      lastUpdated,
      message: hasSecret
        ? 'API secret is configured'
        : 'No API secret configured. Generate one to enable request signing.',
    });
  } catch (error) {
    logger.error('Get API secret status endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
