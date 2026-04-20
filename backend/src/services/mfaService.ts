import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, getRedisClient } from '../database/connection';
import { logger, SecurityEventType } from '../logging/logger';

interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface MFASettings {
  userId: string;
  totpEnabled: boolean;
  backupCodesGeneratedAt: string | null;
}

/**
 * Generate TOTP secret and QR code for MFA setup
 */
export async function generateMFASecret(userId: string, email: string): Promise<MFASetupResponse> {
  try {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `FitQuest (${email})`,
      issuer: 'FitQuest',
      length: 32,
    });

    if (!secret.base32) {
      throw new Error('Failed to generate TOTP secret');
    }

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    logger.logSecurityEvent(SecurityEventType.MFA_SETUP_INITIATED, {
      userId,
      email,
      timestamp: new Date().toISOString(),
    });

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  } catch (error) {
    logger.error('Error generating MFA secret', error);
    throw error;
  }
}

/**
 * Verify TOTP code
 */
export function verifyTOTPCode(secret: string, token: string): boolean {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time windows (±30 seconds)
    });

    return verified;
  } catch (error) {
    logger.error('Error verifying TOTP code', error);
    return false;
  }
}

/**
 * Generate 10 backup codes
 */
function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup code
 */
async function hashBackupCode(code: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(code, salt);
}

/**
 * Compare backup code with hash
 */
async function compareBackupCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Enable MFA for user
 */
export async function enableMFA(
  userId: string,
  totpSecret: string,
  backupCodes: string[]
): Promise<void> {
  try {
    // Hash backup codes
    const hashedCodes = await Promise.all(backupCodes.map(code => hashBackupCode(code)));

    // Start transaction
    const client = await (query as any).connect();

    try {
      await client.query('BEGIN');

      // Insert or update MFA settings
      await client.query(
        `INSERT INTO mfa_settings (user_id, totp_secret, totp_enabled, backup_codes_generated_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
         totp_secret = $2,
         totp_enabled = $3,
         backup_codes_generated_at = $4,
         updated_at = NOW()`,
        [userId, totpSecret, true, new Date().toISOString()]
      );

      // Delete old backup codes
      await client.query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);

      // Insert new backup codes
      for (const hashedCode of hashedCodes) {
        await client.query(
          `INSERT INTO backup_codes (user_id, code_hash, used, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [userId, hashedCode, false]
        );
      }

      await client.query('COMMIT');

      logger.logSecurityEvent(SecurityEventType.MFA_ENABLED, {
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error enabling MFA', error);
    throw error;
  }
}

/**
 * Disable MFA for user
 */
export async function disableMFA(userId: string): Promise<void> {
  try {
    const client = await (query as any).connect();

    try {
      await client.query('BEGIN');

      // Update MFA settings
      await client.query(
        `UPDATE mfa_settings SET totp_enabled = FALSE, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );

      // Delete backup codes
      await client.query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);

      await client.query('COMMIT');

      logger.logSecurityEvent(SecurityEventType.MFA_DISABLED, {
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error disabling MFA', error);
    throw error;
  }
}

/**
 * Get MFA settings for user
 */
export async function getMFASettings(userId: string): Promise<MFASettings | null> {
  try {
    const result = await query(
      `SELECT user_id, totp_enabled, backup_codes_generated_at FROM mfa_settings WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      userId: result.rows[0].user_id,
      totpEnabled: result.rows[0].totp_enabled,
      backupCodesGeneratedAt: result.rows[0].backup_codes_generated_at,
    };
  } catch (error) {
    logger.error('Error getting MFA settings', error);
    throw error;
  }
}

/**
 * Get TOTP secret for user (for verification)
 */
export async function getTOTPSecret(userId: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT totp_secret FROM mfa_settings WHERE user_id = $1 AND totp_enabled = TRUE`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].totp_secret;
  } catch (error) {
    logger.error('Error getting TOTP secret', error);
    throw error;
  }
}

/**
 * Verify backup code and mark as used
 */
export async function verifyAndUseBackupCode(userId: string, code: string): Promise<boolean> {
  try {
    // Get all unused backup codes for user
    const result = await query(
      `SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used = FALSE`,
      [userId]
    );

    for (const row of result.rows) {
      const matches = await compareBackupCode(code, row.code_hash);
      if (matches) {
        // Mark as used
        await query(
          `UPDATE backup_codes SET used = TRUE, used_at = NOW() WHERE id = $1`,
          [row.id]
        );

        logger.logSecurityEvent(SecurityEventType.MFA_BACKUP_CODE_USED, {
          userId,
          timestamp: new Date().toISOString(),
        });

        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Error verifying backup code', error);
    throw error;
  }
}

/**
 * Get remaining backup codes count
 */
export async function getBackupCodesCount(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM backup_codes WHERE user_id = $1 AND used = FALSE`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Error getting backup codes count', error);
    throw error;
  }
}

/**
 * Generate new backup codes
 */
export async function generateNewBackupCodes(userId: string): Promise<string[]> {
  try {
    const backupCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(backupCodes.map(code => hashBackupCode(code)));

    const client = await (query as any).connect();

    try {
      await client.query('BEGIN');

      // Delete old backup codes
      await client.query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);

      // Insert new backup codes
      for (const hashedCode of hashedCodes) {
        await client.query(
          `INSERT INTO backup_codes (user_id, code_hash, used, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [userId, hashedCode, false]
        );
      }

      // Update backup codes generated timestamp
      await client.query(
        `UPDATE mfa_settings SET backup_codes_generated_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );

      await client.query('COMMIT');

      logger.logSecurityEvent(SecurityEventType.MFA_BACKUP_CODES_REGENERATED, {
        userId,
        timestamp: new Date().toISOString(),
      });

      return backupCodes;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error generating new backup codes', error);
    throw error;
  }
}
