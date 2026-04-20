import dotenv from 'dotenv';
import crypto from 'crypto';
import { logger } from '../logging/logger';

dotenv.config();

/**
 * ✅ Fix 1.3: Validate JWT secrets on startup
 */
function validateJwtSecrets(): void {
  if (config.nodeEnv === 'production') {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_SECRET and JWT_REFRESH_SECRET must be set in production'
      );
    }

    // Validate minimum length (32 bytes = 256 bits)
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
    }
  }
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'fitquest',
    user: process.env.DB_USER || 'fitquest_user',
    password: process.env.DB_PASSWORD || 'secure_password',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  // JWT (top-level for easier access)
  // ✅ Fix 1.3: Generate strong random secrets for development
  jwtSecret: process.env.JWT_SECRET || 
    crypto.randomBytes(32).toString('hex'),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 
    crypto.randomBytes(32).toString('hex'),
  jwtExpiration: process.env.JWT_EXPIRATION || '1h',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',

  // JWT (nested for backward compatibility)
  jwt: {
    secret: process.env.JWT_SECRET || 
      crypto.randomBytes(32).toString('hex'),
    refreshSecret: process.env.JWT_REFRESH_SECRET || 
      crypto.randomBytes(32).toString('hex'),
    expiration: process.env.JWT_EXPIRATION || '1h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  },

  // AWS S3
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || 'fitquest-uploads',
  },

  // Email
  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
  },

  // Feature Flags
  features: {
    enableOfflineSync: process.env.ENABLE_OFFLINE_SYNC === 'true',
    enableSyncLogging: process.env.ENABLE_SYNC_LOGGING === 'true',
    enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION === 'true',
  },
};

// ✅ Fix 1.3: Validate JWT secrets on startup
validateJwtSecrets();

// ✅ Fix 1.3: Log warning if using generated secrets in development
if (config.nodeEnv === 'development' && !process.env.JWT_SECRET) {
  logger.warning('Using generated JWT secrets for development - not suitable for production');
}
