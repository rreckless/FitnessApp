import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  generateMFASecret,
  enableMFA,
  disableMFA,
  getMFASettings,
  getTOTPSecret,
  verifyAndUseBackupCode,
  verifyTOTPCode,
  getBackupCodesCount,
  generateNewBackupCodes,
} from '../services/mfaService';
import { verifyToken } from './authRoutes';
import { query } from '../database/connection';
import { logger } from '../logging/logger';

const router = express.Router();

// Rate limiting for MFA endpoints
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many MFA attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /auth/mfa/setup
 * Generate TOTP secret and backup codes for MFA setup
 */
router.post('/setup', verifyToken, mfaLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get user email for QR code
    const result = await query('SELECT email FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = result.rows[0].email;

    // Generate MFA secret and backup codes
    const mfaSetup = await generateMFASecret(userId, email);

    res.status(200).json({
      secret: mfaSetup.secret,
      qrCode: mfaSetup.qrCode,
      backupCodes: mfaSetup.backupCodes,
      message: 'Scan the QR code with your authenticator app and save the backup codes in a secure location',
    });
  } catch (error) {
    logger.error('MFA setup endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /auth/mfa/enable
 * Enable MFA for user after verifying TOTP code
 */
router.post(
  '/enable',
  verifyToken,
  mfaLimiter,
  [
    body('totpSecret').notEmpty().withMessage('TOTP secret is required'),
    body('totpCode').isLength({ min: 6, max: 6 }).withMessage('TOTP code must be 6 digits'),
    body('backupCodes').isArray().withMessage('Backup codes must be an array'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { totpSecret, totpCode, backupCodes } = req.body;

      // Verify TOTP code before enabling
      const isValidCode = verifyTOTPCode(totpSecret, totpCode);
      if (!isValidCode) {
        logger.warning('Invalid TOTP code during MFA enable', { userId });
        return res.status(400).json({ error: 'Invalid TOTP code. Please try again.' });
      }

      // Enable MFA
      await enableMFA(userId, totpSecret, backupCodes);

      res.status(200).json({
        message: 'MFA enabled successfully',
        mfaEnabled: true,
      });
    } catch (error) {
      logger.error('MFA enable endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /auth/mfa/disable
 * Disable MFA for user
 */
router.post(
  '/disable',
  verifyToken,
  mfaLimiter,
  [body('password').notEmpty().withMessage('Password is required for security')],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { password } = req.body;

      // Verify password before disabling MFA
      const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const bcrypt = await import('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, userResult.rows[0].password_hash);

      if (!isPasswordValid) {
        logger.warning('Invalid password during MFA disable', { userId });
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Disable MFA
      await disableMFA(userId);

      res.status(200).json({
        message: 'MFA disabled successfully',
        mfaEnabled: false,
      });
    } catch (error) {
      logger.error('MFA disable endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /auth/mfa/status
 * Get MFA status for user
 */
router.get('/status', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const mfaSettings = await getMFASettings(userId);

    if (!mfaSettings) {
      return res.status(200).json({
        mfaEnabled: false,
        backupCodesRemaining: 0,
      });
    }

    const backupCodesCount = await getBackupCodesCount(userId);

    res.status(200).json({
      mfaEnabled: mfaSettings.totpEnabled,
      backupCodesRemaining: backupCodesCount,
      backupCodesGeneratedAt: mfaSettings.backupCodesGeneratedAt,
    });
  } catch (error) {
    logger.error('MFA status endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /auth/mfa/backup-codes
 * Generate new backup codes
 */
router.post('/backup-codes', verifyToken, mfaLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Check if MFA is enabled
    const mfaSettings = await getMFASettings(userId);
    if (!mfaSettings || !mfaSettings.totpEnabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Generate new backup codes
    const newBackupCodes = await generateNewBackupCodes(userId);

    res.status(200).json({
      backupCodes: newBackupCodes,
      message: 'New backup codes generated. Save them in a secure location.',
    });
  } catch (error) {
    logger.error('MFA backup codes endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
