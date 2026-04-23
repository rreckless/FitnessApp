namespace SyncService.Models;

/// <summary>
/// Response model for sync operations.
/// </summary>
public class SyncResponse
{
    /// <summary>
    /// Indicates if the sync operation was successful.
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Message describing the result of the sync operation.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// List of synced items.
    /// </summary>
    public List<SyncedItem> SyncedItems { get; set; } = new();

    /// <summary>
    /// List of items that failed to sync.
    /// </summary>
    public List<FailedSyncItem> FailedItems { get; set; } = new();

    /// <summary>
    /// Timestamp of the sync operation.
    /// </summary>
    public DateTime SyncedAt { get; set; }
}

/// <summary>
/// Represents a successfully synced item.
/// </summary>
public class SyncedItem
{
    /// <summary>
    /// ID of the synced item.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Type of entity that was synced.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the entity that was synced.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// Operation that was performed.
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when the item was synced.
    /// </summary>
    public DateTime SyncedAt { get; set; }
}

/// <summary>
/// Represents an item that failed to sync.
/// </summary>
public class FailedSyncItem
{
    /// <summary>
    /// ID of the failed sync item.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Type of entity that failed to sync.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the entity that failed to sync.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// Error message describing why the sync failed.
    /// </summary>
    public string Error { get; set; } = string.Empty;

    /// <summary>
    /// Number of retry attempts made.
    /// </summary>
    public int RetryCount { get; set; }
}

/// <summary>
/// Response model for sync pull operations.
/// </summary>
public class SyncPullResponse
{
    /// <summary>
    /// List of changes from the cloud.
    /// </summary>
    public List<CloudChange> Changes { get; set; } = new();

    /// <summary>
    /// Timestamp of the sync operation.
    /// </summary>
    public DateTime SyncedAt { get; set; }
}

/// <summary>
/// Represents a change from the cloud.
/// </summary>
public class CloudChange
{
    /// <summary>
    /// Type of operation: CREATE, UPDATE, DELETE.
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// Type of entity.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the entity.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// JSON payload containing the entity data.
    /// </summary>
    public string Payload { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when the entity was last updated on the cloud.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Response model for sync status.
/// </summary>
public class SyncStatusResponse
{
    /// <summary>
    /// Current sync status: synced, syncing, pending.
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Number of pending sync items.
    /// </summary>
    public int PendingCount { get; set; }

    /// <summary>
    /// Number of syncing items.
    /// </summary>
    public int SyncingCount { get; set; }

    /// <summary>
    /// Number of failed sync items.
    /// </summary>
    public int FailedCount { get; set; }

    /// <summary>
    /// Timestamp of the last successful sync.
    /// </summary>
    public DateTime? LastSyncAt { get; set; }

    /// <summary>
    /// Timestamp of the last sync attempt.
    /// </summary>
    public DateTime? LastSyncAttemptAt { get; set; }
}
