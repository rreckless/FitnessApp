/**
 * Sync Models
 * Defines types and interfaces for sync operations
 */

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum SyncEntityType {
  WORKOUT = 'WORKOUT',
  WEIGHT = 'WEIGHT',
  MEASUREMENT = 'MEASUREMENT',
  PHOTO = 'PHOTO',
  EXERCISE = 'EXERCISE',
  ACHIEVEMENT = 'ACHIEVEMENT',
  FRIENDSHIP = 'FRIENDSHIP',
}

export enum SyncStatusEnum {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface SyncQueueEntry {
  id: string;
  operation: SyncOperation;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, any>;
  status: SyncStatusEnum;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncConflict {
  entityType: SyncEntityType;
  entityId: string;
  localTimestamp: number;
  remoteTimestamp: number;
  localData: Record<string, any>;
  remoteData: Record<string, any>;
  resolution: 'LOCAL' | 'REMOTE';
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: number;
  pendingCount: number;
  failedCount: number;
  conflicts: SyncConflict[];
}

export interface PullResponse {
  data: Record<string, any>[];
  timestamp: number;
  hasMore: boolean;
}

export interface PushRequest {
  operations: SyncQueueEntry[];
}

export interface PushResponse {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  conflicts: SyncConflict[];
}

export enum SyncError {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  INVALID_DATA = 'INVALID_DATA',
  SERVER_ERROR = 'SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}

export class SyncException extends Error {
  constructor(
    public code: SyncError,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SyncException';
  }
}
