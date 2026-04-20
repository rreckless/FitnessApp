import { getPool } from '../database/connection';
import { logger } from '../logging/logger';
import * as gpsService from './gpsService';

/**
 * Batch job to downsample GPS data older than 30 days
 * Keeps 1 point per minute, reducing storage by ~60x
 * Runs daily
 */
export async function downsampleOldGPSData(): Promise<void> {
  try {
    logger.info('Starting GPS downsampling batch job');

    // Find sessions that are older than 30 days and still in RAW tier
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const query = `
      SELECT id
      FROM gps_sessions
      WHERE created_at < $1 AND retention_tier = 'RAW'
      LIMIT 1000
    `;

    const result = await getPool().query(query, [thirtyDaysAgo.toISOString()]);
    const sessionIds = result.rows.map((row: any) => row.id);

    logger.info(`Found ${sessionIds.length} sessions to downsample`);

    // Downsample each session
    for (const sessionId of sessionIds) {
      try {
        await gpsService.downsampleGPSCoordinates(sessionId);
        logger.debug(`Downsampled GPS session ${sessionId}`);
      } catch (error) {
        logger.error(`Failed to downsample GPS session ${sessionId}`, error as Error);
      }
    }

    logger.info(`Completed GPS downsampling batch job. Processed ${sessionIds.length} sessions`);
  } catch (error) {
    logger.error('GPS downsampling batch job failed', error as Error);
  }
}

/**
 * Batch job to archive GPS data older than 1 year
 * Runs daily
 */
export async function archiveOldGPSData(): Promise<void> {
  try {
    logger.info('Starting GPS archiving batch job');

    await gpsService.archiveOldGPSData();

    logger.info('Completed GPS archiving batch job');
  } catch (error) {
    logger.error('GPS archiving batch job failed', error as Error);
  }
}

/**
 * Start GPS batch jobs
 * Downsampling runs daily at 2 AM UTC
 * Archiving runs daily at 3 AM UTC
 */
export function startGPSBatchJobs(): void {
  // Schedule downsampling job
  const downsampleInterval = setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() === 2 && now.getUTCMinutes() === 0) {
      await downsampleOldGPSData();
    }
  }, 60000); // Check every minute

  // Schedule archiving job
  const archiveInterval = setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() === 3 && now.getUTCMinutes() === 0) {
      await archiveOldGPSData();
    }
  }, 60000); // Check every minute

  logger.info('GPS batch jobs started');

  // Store intervals for cleanup
  (global as any).gpsBatchJobs = { downsampleInterval, archiveInterval };
}

/**
 * Stop GPS batch jobs
 */
export function stopGPSBatchJobs(): void {
  if ((global as any).gpsBatchJobs) {
    clearInterval((global as any).gpsBatchJobs.downsampleInterval);
    clearInterval((global as any).gpsBatchJobs.archiveInterval);
    logger.info('GPS batch jobs stopped');
  }
}
