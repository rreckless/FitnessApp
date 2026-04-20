import * as Sentry from '@sentry/node';
import { config } from '../config/config';

/**
 * Initialize Sentry error tracking
 */
export function initializeSentry(): void {
  if (!config.sentry.dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    tracesSampleRate: config.sentry.tracesSampleRate,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });
}

/**
 * ✅ Fix 2.4: Security event types for structured logging
 */
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_LOCKED = 'LOGIN_LOCKED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_CONFIRMED = 'PASSWORD_RESET_CONFIRMED',
  LOGOUT = 'LOGOUT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PROFILE_MODIFIED = 'PROFILE_MODIFIED',
  SYNC_OPERATION = 'SYNC_OPERATION',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  MFA_SETUP_INITIATED = 'MFA_SETUP_INITIATED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFICATION_SUCCESS = 'MFA_VERIFICATION_SUCCESS',
  MFA_VERIFICATION_FAILED = 'MFA_VERIFICATION_FAILED',
  MFA_BACKUP_CODE_USED = 'MFA_BACKUP_CODE_USED',
  MFA_BACKUP_CODES_REGENERATED = 'MFA_BACKUP_CODES_REGENERATED',
  FRAUD_WORKOUT_FLAGGED = 'FRAUD_WORKOUT_FLAGGED',
  FRAUD_WORKOUT_REVIEWED = 'FRAUD_WORKOUT_REVIEWED',
  FRAUD_WORKOUT_XP_ROLLED_BACK = 'FRAUD_WORKOUT_XP_ROLLED_BACK',
  API_SECRET_GENERATED = 'API_SECRET_GENERATED',
}

/**
 * ✅ Fix 2.4: Security event context
 */
export interface SecurityEventContext {
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, any>;
  requestId?: string;
}

/**
 * Logger service for FitQuest backend
 */
export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, context?: Record<string, any>): void {
    console.log(`[INFO] ${message}`, context || '');
  }

  warning(message: string, context?: Record<string, any>): void {
    console.warn(`[WARNING] ${message}`, context || '');
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    console.error(`[ERROR] ${message}`, error || '', context || '');
    if (error) {
      Sentry.captureException(error, { extra: context });
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    if (config.nodeEnv === 'development') {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * ✅ Fix 2.4: Log security events with structured format
   */
  security(event: SecurityEventContext): void {
    const logEntry = {
      level: 'SECURITY',
      eventType: event.eventType,
      timestamp: event.timestamp.toISOString(),
      userId: event.userId,
      email: event.email,
      ip: event.ip,
      userAgent: event.userAgent,
      requestId: event.requestId,
      details: event.details,
    };

    console.log(`[SECURITY] ${event.eventType}`, logEntry);

    // Also send to Sentry for monitoring
    Sentry.captureMessage(`Security Event: ${event.eventType}`, 'info', {
      extra: logEntry,
    });
  }

  /**
   * Helper method to log security events
   */
  logSecurityEvent(eventType: SecurityEventType, details?: Record<string, any>): void {
    this.security({
      eventType,
      timestamp: new Date(),
      details,
    });
  }
}

export const logger = Logger.getInstance();

