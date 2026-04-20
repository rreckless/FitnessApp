import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import Redis from 'ioredis';
import { config } from './config/config';
import { initializeSentry, logger } from './logging/logger';
import { initializeDatabase, closeDatabase } from './database/connection';
import { initializeRedis, startBatchJob, stopBatchJob } from './services/leaderboardService';
import { startGPSBatchJobs, stopGPSBatchJobs } from './services/gpsBatchJobService';
import authRoutes from './routes/authRoutes';
import mfaRoutes from './routes/mfaRoutes';
import fraudDetectionRoutes from './routes/fraudDetectionRoutes';
import requestSigningRoutes from './routes/requestSigningRoutes';
import userProfileRoutes from './routes/userProfileRoutes';
import exerciseRoutes from './routes/exerciseRoutes';
import syncRoutes from './routes/syncRoutes';
import workoutRoutes from './routes/workoutRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import friendRoutes from './routes/friendRoutes';
import activityFeedRoutes from './routes/activityFeedRoutes';
import challengeRoutes from './routes/challengeRoutes';
import progressTrackingRoutes from './routes/progressTrackingRoutes';
import bodyTrackingRoutes from './routes/bodyTrackingRoutes';
import gpsRoutes from './routes/gpsRoutes';
import routeRoutes from './routes/routeRoutes';

// Initialize Sentry
initializeSentry();

const app = express();

// ✅ Fix 2.5: Add security headers with helmet
app.use(
  helmet({
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:'],
        connectSrc: ["'self'"],
      },
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sentry request handler
app.use(Sentry.Handlers.requestHandler());

// ✅ Fix 2.5: Enforce HTTPS in production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    // Check x-forwarded-proto header (for load balancers)
    const proto = req.get('x-forwarded-proto');

    if (proto && proto !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }

    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/auth', authRoutes);

// MFA routes
app.use('/auth/mfa', mfaRoutes);

// Fraud detection routes
app.use('/fraud', fraudDetectionRoutes);

// Request signing routes
app.use('/signing', requestSigningRoutes);

// User profile routes
app.use('/users', userProfileRoutes);

// Exercise routes
app.use('/exercises', exerciseRoutes);

// Workout routes
app.use('/workouts', workoutRoutes);

// Leaderboard routes
app.use('/leaderboards', leaderboardRoutes);

// Friend routes
app.use('/friends', friendRoutes);

// Activity feed routes
app.use('/activity-feed', activityFeedRoutes);

// Challenge routes
app.use('/challenges', challengeRoutes);

// Progress tracking routes
app.use('/progress', progressTrackingRoutes);

// Body tracking routes
app.use('/body', bodyTrackingRoutes);

// GPS routes
app.use('/gps', gpsRoutes);

// Route routes
app.use('/routes', routeRoutes);

// Sync routes
app.use('/sync', syncRoutes);

// Sentry error handler
app.use(Sentry.Handlers.errorHandler());

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Start server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize Redis for leaderboard caching
    const redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis connection error', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    // Initialize leaderboard service with Redis
    initializeRedis(redisClient);

    // Start leaderboard batch job (recalculates rankings every 5 minutes)
    startBatchJob();

    // Start GPS batch jobs (downsampling and archiving)
    startGPSBatchJobs();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  stopBatchJob();
  stopGPSBatchJobs();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();

export default app;
