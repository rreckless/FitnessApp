import crypto from 'crypto';
import { config } from '../config/config';
import { logger } from '../logging/logger';

interface SignatureVerificationResult {
  isValid: boolean;
  error?: string;
  timestamp?: number;
  age?: number;
}

/**
 * ✅ Task 3.3: Generate HMAC-SHA256 signature for request body
 */
export function generateSignature(
  requestBody: any,
  timestamp: number,
  apiSecret: string
): string {
  try {
    // Create signature payload: body + timestamp
    const payload = JSON.stringify(requestBody) + timestamp.toString();

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(payload)
      .digest('hex');

    return signature;
  } catch (error) {
    logger.error('Error generating signature', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.3: Verify HMAC-SHA256 signature
 */
export function verifySignature(
  requestBody: any,
  signature: string,
  timestamp: number,
  apiSecret: string,
  maxAge: number = 300 // 5 minutes in seconds
): SignatureVerificationResult {
  try {
    // Check timestamp freshness (5 minute window)
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - timestamp;

    if (age < 0) {
      return {
        isValid: false,
        error: 'Timestamp is in the future',
        timestamp,
        age,
      };
    }

    if (age > maxAge) {
      return {
        isValid: false,
        error: `Request is too old (${age} seconds old, max ${maxAge} seconds)`,
        timestamp,
        age,
      };
    }

    // Generate expected signature
    const expectedSignature = generateSignature(requestBody, timestamp, apiSecret);

    // Compare signatures using constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    return {
      isValid,
      timestamp,
      age,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timingSafeEqual')) {
      return {
        isValid: false,
        error: 'Signature verification failed',
        timestamp,
      };
    }

    logger.error('Error verifying signature', error as Error);
    return {
      isValid: false,
      error: 'Signature verification error',
      timestamp,
    };
  }
}

/**
 * ✅ Task 3.3: Generate API secret for user
 */
export function generateAPISecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * ✅ Task 3.3: Hash API secret for storage
 */
export async function hashAPISecret(secret: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
}

/**
 * ✅ Task 3.3: Verify API secret
 */
export async function verifyAPISecret(secret: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(secret, hash);
}

/**
 * ✅ Task 3.3: Extract signature from request headers
 */
export function extractSignatureFromHeaders(headers: any): {
  signature?: string;
  timestamp?: number;
  error?: string;
} {
  try {
    const signature = headers['x-signature'];
    const timestampStr = headers['x-timestamp'];

    if (!signature) {
      return { error: 'Missing X-Signature header' };
    }

    if (!timestampStr) {
      return { error: 'Missing X-Timestamp header' };
    }

    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { error: 'Invalid X-Timestamp header' };
    }

    return { signature, timestamp };
  } catch (error) {
    logger.error('Error extracting signature from headers', error as Error);
    return { error: 'Error extracting signature' };
  }
}

/**
 * ✅ Task 3.3: Detect replay attacks
 */
export async function isReplayAttack(
  userId: string,
  signature: string,
  timestamp: number,
  recentSignatures: Map<string, Set<string>>
): Promise<boolean> {
  try {
    // Create key for user's recent signatures
    const key = `${userId}:${timestamp}`;

    // Check if this signature was already used
    if (!recentSignatures.has(key)) {
      recentSignatures.set(key, new Set());
    }

    const signatures = recentSignatures.get(key)!;

    if (signatures.has(signature)) {
      logger.warning('Replay attack detected', { userId, timestamp });
      return true;
    }

    // Add signature to recent set
    signatures.add(signature);

    // Clean up old entries (older than 10 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    for (const [k] of recentSignatures) {
      const [, ts] = k.split(':');
      if (currentTime - parseInt(ts, 10) > 600) {
        recentSignatures.delete(k);
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking replay attack', error as Error);
    return false;
  }
}
