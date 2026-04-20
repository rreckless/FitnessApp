import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config';
import { logger } from '../logging/logger';

/**
 * PostgreSQL connection pool
 */
let pool: Pool;

/**
 * ✅ Fix 1.4: Redis client for token blacklist
 */
let redisClient: RedisClientType;

/**
 * Initialize database connection pool
 */
export async function initializeDatabase(): Promise<void> {
  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
  });

  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database', error as Error);
    throw error;
  }
}

/**
 * ✅ Fix 1.4: Initialize Redis client for token blacklist
 */
export async function initializeRedis(): Promise<void> {
  try {
    redisClient = createClient({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
    }) as RedisClientType;

    redisClient.on('error', (err) => {
      logger.error('Redis client error', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', error as Error);
    // Don't throw - Redis is optional for development
    if (config.nodeEnv === 'production') {
      throw error;
    }
  }
}

/**
 * Get database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}

/**
 * ✅ Fix 1.4: Get Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Get a client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

/**
 * ✅ Fix 1.4: Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const client = await getClient();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
