import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  verifyAccessToken,
  verifyMFACode,
  isMFAEnabled,
  generateTokens,
} from '../services/authService';
import { getRedisClient, query } from '../database/connection';
import { logger } from '../logging/logger';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for MFA endpoints
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many MFA attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ✅ Fix 1.4: Middleware to verify JWT token and check blacklist
 */
export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  // ✅ Fix 1.4: Check if token is blacklisted
  try {
    const redis = getRedisClient();
    redis.get(`blacklist:${token}`, (err, result) => {
      if (err) {
        logger.error('Redis error checking blacklist:', err);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      if (result) {
        logger.warning('Attempt to use blacklisted token');
        res.status(401).json({ error: 'Token has been revoked' });
        return;
      }

      const decoded = verifyAccessToken(token);

      if (!decoded) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      (req as any).userId = decoded.userId;
      next();
    });
  } catch (error) {
    // Redis not available - skip blacklist check
    logger.warning('Redis unavailable, skipping blacklist check');
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    (req as any).userId = decoded.userId;
    next();
  }
}

/**
 * POST /auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    // ✅ Fix 2.2: Strong password requirements
    body('password')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Password must contain at least one special character (!@#$%^&*)'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password, name } = req.body;

      const result = await register(email, password, name);

      res.status(201).json(result);
    } catch (error) {
      logger.error('Registration endpoint error', error as Error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      try {
        const result = await login(email, password);
        res.status(200).json(result);
      } catch (error) {
        const message = (error as Error).message;

        // ✅ Fix 2.1: Return 429 for locked accounts
        if (message === 'ACCOUNT_LOCKED') {
          return res.status(429).json({
            error: 'Account locked due to too many failed login attempts. Please try again in 30 minutes.',
            retryAfter: 1800, // 30 minutes in seconds
          });
        }

        res.status(401).json({ error: message });
      }
    } catch (error) {
      logger.error('Login endpoint error', error as Error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { refreshToken } = req.body;

      const tokens = await refreshAccessToken(refreshToken);

      res.status(200).json(tokens);
    } catch (error) {
      logger.error('Token refresh endpoint error', error as Error);
      res.status(401).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Fix 1.4: POST /auth/logout
 * Logout user and blacklist token
 */
router.post('/logout', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const token = req.headers.authorization?.substring(7);

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // ✅ Fix 1.4: Pass token to logout for blacklisting
    await logout(userId, token);

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout endpoint error', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /auth/password-reset
 * Request password reset
 */
router.post(
  '/password-reset',
  passwordResetLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email } = req.body;

      const result = await requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.status(200).json({
        message: 'If an account exists with this email, a password reset link has been sent',
        ...result,
      });
    } catch (error) {
      logger.error('Password reset request endpoint error', error as Error);
      res.status(200).json({
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }
  }
);

/**
 * POST /auth/password-reset/confirm
 * Confirm password reset with token
 */
router.post(
  '/password-reset/confirm',
  [
    body('resetToken').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { resetToken, newPassword } = req.body;

      const result = await confirmPasswordReset(resetToken, newPassword);

      res.status(200).json(result);
    } catch (error) {
      logger.error('Password reset confirm endpoint error', error as Error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.1: POST /auth/mfa/verify
 * Verify MFA code during login
 */
router.post(
  '/mfa/verify',
  mfaLimiter,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('code').isLength({ min: 6 }).withMessage('Code must be at least 6 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, code } = req.body;

      // Verify MFA code
      const isValid = await verifyMFACode(userId, code);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid MFA code' });
      }

      // Generate tokens after MFA verification
      const tokens = generateTokens(userId);

      res.status(200).json(tokens);
    } catch (error) {
      logger.error('MFA verify endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * ✅ Task 3.1: POST /auth/check-mfa
 * Check if MFA is required for user
 */
router.post(
  '/check-mfa',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Get user
      const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

      if (result.rows.length === 0) {
        // Don't reveal if user exists
        return res.status(200).json({ mfaRequired: false });
      }

      const userId = result.rows[0].id;

      // Check if MFA is enabled
      const mfaRequired = await isMFAEnabled(userId);

      res.status(200).json({
        mfaRequired,
        userId: mfaRequired ? userId : undefined,
      });
    } catch (error) {
      logger.error('Check MFA endpoint error', error as Error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
