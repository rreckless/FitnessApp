import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { query, getRedisClient } from '../database/connection';
import { logger, SecurityEventType } from '../logging/logger';

interface User {
  id: string;
  email: string;
  name: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  subscriptionTier: string;
  createdAt: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token pair
 */
export function generateTokens(userId: string): TokenPair {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiration }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiration }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify JWT token
 */
function verifyToken(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  try {
    // Validate input
    if (!email || !password || !name) {
      throw new Error('Email, password, and name are required');
    }

    // ✅ Fix 2.2: Validate strong password requirements
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character (!@#$%^&*)');
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = uuidv4();
    const result = await query(
      `INSERT INTO users (id, email, password_hash, name, level, total_xp, current_streak, longest_streak, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, email, name, level, total_xp, current_streak, longest_streak, subscription_tier, created_at`,
      [userId, email.toLowerCase(), passwordHash, name, 1, 0, 0, 0]
    );

    const user = result.rows[0];

    // Initialize user preferences
    await query(
      `INSERT INTO user_preferences (user_id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())`,
      [userId]
    );

    // Generate tokens
    const tokens = generateTokens(userId);

    logger.info('User registered successfully', { userId, email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
        totalXp: user.total_xp,
        currentStreak: user.current_streak,
        longestStreak: user.longest_streak,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
      },
      tokens,
    };
  } catch (error) {
    logger.error('Registration failed', error as Error);
    throw error;
  }
}

/**
 * ✅ Fix 2.1: Account Lockout - Constants
 */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 30 * 60; // 30 minutes

/**
 * ✅ Fix 2.1: Check if account is locked
 */
async function checkAccountLockout(email: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const lockoutKey = `lockout:${email.toLowerCase()}`;

    const count = await redis.get(lockoutKey);
    return count ? parseInt(count) >= LOCKOUT_THRESHOLD : false;
  } catch (error) {
    logger.warning('Redis error checking lockout', { email });
    return false;
  }
}

/**
 * ✅ Fix 2.1: Increment failed login attempts
 */
async function incrementFailedAttempts(email: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const lockoutKey = `lockout:${email.toLowerCase()}`;

    await redis.incr(lockoutKey);
    await redis.expire(lockoutKey, LOCKOUT_DURATION);
  } catch (error) {
    logger.warning('Redis error incrementing failed attempts', { email });
  }
}

/**
 * ✅ Fix 2.1: Clear failed attempts on successful login
 */
async function clearFailedAttempts(email: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const lockoutKey = `lockout:${email.toLowerCase()}`;

    await redis.del(lockoutKey);
  } catch (error) {
    logger.warning('Redis error clearing failed attempts', { email });
  }
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // ✅ Fix 2.1: Check if account is locked
    const isLocked = await checkAccountLockout(email);
    if (isLocked) {
      // ✅ Fix 2.4: Log account lockout
      logger.security({
        eventType: SecurityEventType.LOGIN_LOCKED,
        email,
        timestamp: new Date(),
      });
      throw new Error('ACCOUNT_LOCKED');
    }

    // Find user
    const result = await query(
      `SELECT id, email, password_hash, name, level, total_xp, current_streak, longest_streak, subscription_tier, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // ✅ Fix 2.1: Increment failed attempts
      await incrementFailedAttempts(email);
      // ✅ Fix 2.4: Log failed login attempt
      logger.security({
        eventType: SecurityEventType.LOGIN_FAILED,
        email,
        timestamp: new Date(),
        details: { reason: 'user_not_found' },
      });
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      // ✅ Fix 2.1: Increment failed attempts
      await incrementFailedAttempts(email);
      // ✅ Fix 2.4: Log failed login attempt
      logger.security({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email,
        timestamp: new Date(),
        details: { reason: 'invalid_password' },
      });
      throw new Error('Invalid email or password');
    }

    // ✅ Fix 2.1: Clear failed attempts on success
    await clearFailedAttempts(email);

    // Generate tokens
    const tokens = generateTokens(user.id);

    // ✅ Fix 2.4: Log successful login
    logger.security({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email,
      timestamp: new Date(),
    });

    logger.info('User logged in successfully', { userId: user.id, email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
        totalXp: user.total_xp,
        currentStreak: user.current_streak,
        longestStreak: user.longest_streak,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
      },
      tokens,
    };
  } catch (error) {
    logger.error('Login failed', error as Error);
    throw error;
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken, config.jwtRefreshSecret);
    if (!decoded || decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Verify user still exists
    const result = await query('SELECT id FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Generate new token pair
    const tokens = generateTokens(decoded.userId);

    logger.info('Access token refreshed', { userId: decoded.userId });

    return tokens;
  } catch (error) {
    logger.error('Token refresh failed', error as Error);
    throw error;
  }
}

/**
 * ✅ Fix 1.4: Logout user and blacklist token
 */
export async function logout(userId: string, token: string): Promise<void> {
  try {
    const redis = getRedisClient();

    // Decode token to get expiration
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid token');
    }

    // Calculate TTL (time until expiration)
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;

    if (ttl > 0) {
      // ✅ Add token to blacklist with TTL
      await redis.setEx(`blacklist:${token}`, ttl, '1');
      logger.info('Token blacklisted', { userId, ttl });
    }

    // ✅ Fix 2.4: Log logout event
    logger.security({
      eventType: SecurityEventType.LOGOUT,
      userId,
      timestamp: new Date(),
    });

    logger.info('User logged out', { userId });
  } catch (error) {
    logger.error('Logout failed', error as Error);
    throw error;
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ resetToken: string }> {
  try {
    // Find user
    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      // Don't reveal if email exists (security best practice)
      logger.info('Password reset requested for non-existent email', { email });
      return { resetToken: 'token-sent-if-email-exists' };
    }

    const userId = result.rows[0].id;

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId, type: 'password-reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // ✅ Fix 2.4: Log password reset request
    logger.security({
      eventType: SecurityEventType.PASSWORD_RESET_REQUESTED,
      userId,
      email,
      timestamp: new Date(),
    });

    // In a real implementation, you would:
    // 1. Store the reset token in a password_resets table
    // 2. Send an email with the reset link
    // For now, we just return the token for testing

    logger.info('Password reset requested', { userId, email });

    return { resetToken };
  } catch (error) {
    logger.error('Password reset request failed', error as Error);
    throw error;
  }
}

/**
 * Confirm password reset
 */
export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean }> {
  try {
    // Validate input
    if (!resetToken || !newPassword) {
      throw new Error('Reset token and new password are required');
    }

    if (newPassword.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }

    // Verify reset token
    const decoded = verifyToken(resetToken, config.jwtSecret);
    if (!decoded || decoded.type !== 'password-reset') {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [passwordHash, decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // ✅ Fix 2.4: Log password reset confirmation
    logger.security({
      eventType: SecurityEventType.PASSWORD_RESET_CONFIRMED,
      userId: decoded.userId,
      timestamp: new Date(),
    });

    logger.info('Password reset confirmed', { userId: decoded.userId });

    return { success: true };
  } catch (error) {
    logger.error('Password reset confirmation failed', error as Error);
    throw error;
  }
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): { userId: string } | null {
  const decoded = verifyToken(token, config.jwtSecret);
  if (!decoded || decoded.type !== 'access') {
    return null;
  }
  return { userId: decoded.userId };
}


/**
 * ✅ Task 3.1: Verify MFA code during login
 * Returns true if MFA is not enabled or code is valid
 */
export async function verifyMFACode(userId: string, code: string): Promise<boolean> {
  try {
    // Import MFA service
    const mfaService = await import('./mfaService');

    // Get TOTP secret
    const totpSecret = await mfaService.getTOTPSecret(userId);

    // If MFA not enabled, return true
    if (!totpSecret) {
      return true;
    }

    // Verify TOTP code
    const isValidTOTP = mfaService.verifyTOTPCode(totpSecret, code);
    if (isValidTOTP) {
      logger.logSecurityEvent(SecurityEventType.MFA_VERIFICATION_SUCCESS, {
        userId,
      });
      return true;
    }

    // Try backup code
    const isValidBackupCode = await mfaService.verifyAndUseBackupCode(userId, code);
    if (isValidBackupCode) {
      logger.logSecurityEvent(SecurityEventType.MFA_VERIFICATION_SUCCESS, {
        userId,
        method: 'backup_code',
      });
      return true;
    }

    logger.logSecurityEvent(SecurityEventType.MFA_VERIFICATION_FAILED, {
      userId,
    });
    return false;
  } catch (error) {
    logger.error('Error verifying MFA code', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.1: Check if MFA is enabled for user
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  try {
    const mfaService = await import('./mfaService');
    const mfaSettings = await mfaService.getMFASettings(userId);
    return mfaSettings?.totpEnabled ?? false;
  } catch (error) {
    logger.error('Error checking MFA status', error as Error);
    return false;
  }
}
