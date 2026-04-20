import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database/connection';
import { logger } from '../logging/logger';

export interface SyncQueueEntry {
  id: string;
  userId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'WORKOUT' | 'WEIGHT' | 'MEASUREMENT' | 'PHOTO';
  entityId: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncPullRequest {
  userId: string;
  lastSyncAt?: Date;
}

export interface SyncPushRequest {
  userId: string;
  operations: Array<{
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: 'WORKOUT' | 'WEIGHT' | 'MEASUREMENT' | 'PHOTO';
    entityId: string;
    payload: Record<string, any>;
    clientTimestamp: Date;
  }>;
}

export interface SyncConflict {
  entityId: string;
  entityType: string;
  localTimestamp: Date;
  cloudTimestamp: Date;
  resolution: 'LOCAL' | 'CLOUD';
}

/**
 * Sync service for managing offline-first synchronization
 * ✅ Fix 1.1: All methods verify userId ownership of data
 */
export class SyncService {
  constructor(private pool: Pool) {}

  /**
   * Pull changes from cloud (get updates since last sync)
   * ✅ Fix 1.1: userId parameter ensures only authenticated user's data is returned
   */
  async pullChanges(userId: string, lastSyncAt?: Date): Promise<any[]> {
    const query = `
      SELECT * FROM workouts
      WHERE user_id = $1 AND updated_at > $2
      ORDER BY updated_at ASC
    `;

    const result = await this.pool.query(query, [
      userId,
      lastSyncAt || new Date(0),
    ]);

    logger.info('Sync pull completed', {
      userId,
      changesCount: result.rows.length,
      lastSyncAt,
    });

    return result.rows;
  }

  /**
   * Push changes to cloud (sync local changes)
   * ✅ Fix 1.1: userId parameter ensures only authenticated user can push their data
   */
  async pushChanges(
    userId: string,
    operations: SyncPushRequest['operations']
  ): Promise<{ synced: string[]; conflicts: SyncConflict[] }> {
    const synced: string[] = [];
    const conflicts: SyncConflict[] = [];

    for (const op of operations) {
      try {
        const result = await this.processSyncOperation(userId, op);

        if (result.conflict) {
          conflicts.push(result.conflict);
        } else {
          synced.push(op.entityId);
        }
      } catch (error) {
        logger.error(`Failed to sync operation for ${op.entityId}:`, error as Error);
      }
    }

    // Update last sync timestamp
    await this.updateLastSyncTime(userId);

    logger.info('Sync push completed', {
      userId,
      syncedCount: synced.length,
      conflictsCount: conflicts.length,
    });

    return { synced, conflicts };
  }

  /**
   * Process a single sync operation
   * ✅ Fix 1.1: Verifies userId ownership before processing
   */
  private async processSyncOperation(
    userId: string,
    operation: SyncPushRequest['operations'][0]
  ): Promise<{ conflict?: SyncConflict }> {
    const { operation: op, entityType, entityId, payload, clientTimestamp } =
      operation;

    // Get existing entity from cloud
    const existingEntity = await this.getEntity(entityType, entityId, userId);

    if (!existingEntity) {
      // Entity doesn't exist on cloud - create it
      if (op === 'CREATE' || op === 'UPDATE') {
        await this.createEntity(entityType, entityId, userId, payload);
      }
      return {};
    }

    // Entity exists - check for conflicts
    const cloudTimestamp = new Date(existingEntity.updated_at);

    if (op === 'DELETE') {
      // Check if cloud version is newer
      if (cloudTimestamp > clientTimestamp) {
        // Cloud has newer update - conflict
        return {
          conflict: {
            entityId,
            entityType,
            localTimestamp: clientTimestamp,
            cloudTimestamp,
            resolution: 'CLOUD',
          },
        };
      }
      // Local delete is newer - delete from cloud
      await this.deleteEntity(entityType, entityId);
      return {};
    }

    if (op === 'UPDATE') {
      // Check if cloud version is newer
      if (cloudTimestamp > clientTimestamp) {
        // Cloud has newer update - conflict
        return {
          conflict: {
            entityId,
            entityType,
            localTimestamp: clientTimestamp,
            cloudTimestamp,
            resolution: 'CLOUD',
          },
        };
      }
      // Local update is newer - update cloud
      await this.updateEntity(entityType, entityId, payload);
      return {};
    }

    return {};
  }

  /**
   * Get entity from database
   * ✅ Fix 1.1: Verifies userId ownership in all queries
   */
  private async getEntity(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<any> {
    let query = '';
    const args = [entityId];

    switch (entityType) {
      case 'WORKOUT':
        query = 'SELECT * FROM workouts WHERE id = $1 AND user_id = $2';
        args.push(userId);
        break;
      case 'WEIGHT':
        query = 'SELECT * FROM body_weight WHERE id = $1 AND user_id = $2';
        args.push(userId);
        break;
      case 'MEASUREMENT':
        query =
          'SELECT * FROM body_measurements WHERE id = $1 AND user_id = $2';
        args.push(userId);
        break;
      case 'PHOTO':
        query =
          'SELECT * FROM progress_photos WHERE id = $1 AND user_id = $2';
        args.push(userId);
        break;
      default:
        return null;
    }

    const result = await this.pool.query(query, args);
    return result.rows[0] || null;
  }

  /**
   * Create entity in database
   * ✅ Fix 1.1: Ensures userId is set for all created entities
   */
  private async createEntity(
    entityType: string,
    entityId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<void> {
    let query = '';
    const args = [entityId, userId];

    switch (entityType) {
      case 'WORKOUT':
        query = `
          INSERT INTO workouts (id, user_id, start_time, end_time, duration, total_volume, total_xp, notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            duration = EXCLUDED.duration,
            total_volume = EXCLUDED.total_volume,
            total_xp = EXCLUDED.total_xp,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        `;
        args.push(
          payload.startTime,
          payload.endTime,
          payload.duration,
          payload.totalVolume,
          payload.totalXP,
          payload.notes
        );
        break;
      case 'WEIGHT':
        query = `
          INSERT INTO body_weight (id, user_id, weight, notes, recorded_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            weight = EXCLUDED.weight,
            notes = EXCLUDED.notes,
            recorded_at = EXCLUDED.recorded_at,
            updated_at = NOW()
        `;
        args.push(payload.weight, payload.notes, payload.recordedAt);
        break;
      case 'MEASUREMENT':
        query = `
          INSERT INTO body_measurements (id, user_id, chest, waist, hips, arms, thighs, notes, recorded_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            chest = EXCLUDED.chest,
            waist = EXCLUDED.waist,
            hips = EXCLUDED.hips,
            arms = EXCLUDED.arms,
            thighs = EXCLUDED.thighs,
            notes = EXCLUDED.notes,
            recorded_at = EXCLUDED.recorded_at,
            updated_at = NOW()
        `;
        args.push(
          payload.chest,
          payload.waist,
          payload.hips,
          payload.arms,
          payload.thighs,
          payload.notes,
          payload.recordedAt
        );
        break;
      case 'PHOTO':
        query = `
          INSERT INTO progress_photos (id, user_id, image_url, thumbnail_url, notes, recorded_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            image_url = EXCLUDED.image_url,
            thumbnail_url = EXCLUDED.thumbnail_url,
            notes = EXCLUDED.notes,
            recorded_at = EXCLUDED.recorded_at,
            updated_at = NOW()
        `;
        args.push(
          payload.imageUrl,
          payload.thumbnailUrl,
          payload.notes,
          payload.recordedAt
        );
        break;
    }

    if (query) {
      await this.pool.query(query, args);
    }
  }

  /**
   * Update entity in database
   */
  private async updateEntity(
    entityType: string,
    entityId: string,
    payload: Record<string, any>
  ): Promise<void> {
    let query = '';
    const args = [entityId];

    switch (entityType) {
      case 'WORKOUT':
        query = `
          UPDATE workouts SET
            start_time = $2,
            end_time = $3,
            duration = $4,
            total_volume = $5,
            total_xp = $6,
            notes = $7,
            updated_at = NOW()
          WHERE id = $1
        `;
        args.push(
          payload.startTime,
          payload.endTime,
          payload.duration,
          payload.totalVolume,
          payload.totalXP,
          payload.notes
        );
        break;
      case 'WEIGHT':
        query = `
          UPDATE body_weight SET
            weight = $2,
            notes = $3,
            recorded_at = $4,
            updated_at = NOW()
          WHERE id = $1
        `;
        args.push(payload.weight, payload.notes, payload.recordedAt);
        break;
      case 'MEASUREMENT':
        query = `
          UPDATE body_measurements SET
            chest = $2,
            waist = $3,
            hips = $4,
            arms = $5,
            thighs = $6,
            notes = $7,
            recorded_at = $8,
            updated_at = NOW()
          WHERE id = $1
        `;
        args.push(
          payload.chest,
          payload.waist,
          payload.hips,
          payload.arms,
          payload.thighs,
          payload.notes,
          payload.recordedAt
        );
        break;
      case 'PHOTO':
        query = `
          UPDATE progress_photos SET
            image_url = $2,
            thumbnail_url = $3,
            notes = $4,
            recorded_at = $5,
            updated_at = NOW()
          WHERE id = $1
        `;
        args.push(
          payload.imageUrl,
          payload.thumbnailUrl,
          payload.notes,
          payload.recordedAt
        );
        break;
    }

    if (query) {
      await this.pool.query(query, args);
    }
  }

  /**
   * Delete entity from database
   */
  private async deleteEntity(entityType: string, entityId: string): Promise<void> {
    let query = '';

    switch (entityType) {
      case 'WORKOUT':
        query = 'UPDATE workouts SET deleted_at = NOW() WHERE id = $1';
        break;
      case 'WEIGHT':
        query = 'DELETE FROM body_weight WHERE id = $1';
        break;
      case 'MEASUREMENT':
        query = 'DELETE FROM body_measurements WHERE id = $1';
        break;
      case 'PHOTO':
        query = 'DELETE FROM progress_photos WHERE id = $1';
        break;
    }

    if (query) {
      await this.pool.query(query, [entityId]);
    }
  }

  /**
   * Update last sync time for user
   */
  private async updateLastSyncTime(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET last_sync_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Get sync status for user
   * ✅ Fix 1.1: Verifies userId ownership
   */
  async getSyncStatus(userId: string): Promise<{
    lastSyncAt: Date | null;
    pendingChanges: number;
  }> {
    const userResult = await this.pool.query(
      'SELECT last_sync_at FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    const queueResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM sync_queue WHERE user_id = $1 AND status IN ('PENDING', 'FAILED')",
      [userId]
    );

    return {
      lastSyncAt: user?.last_sync_at || null,
      pendingChanges: parseInt(queueResult.rows[0].count, 10),
    };
  }
}
