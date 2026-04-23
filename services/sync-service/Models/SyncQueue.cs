namespace SyncService.Models;

/// <summary>
/// Represents a sync queue entry for tracking pending, syncing, synced, and failed sync operations.
/// </summary>
public class SyncQueue
{
    /// <summary>
    /// Unique identifier for the sync queue entry.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// User ID associated with this sync operation.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Type of operation: CREATE, UPDATE, DELETE.
    /// </summary>
    public SyncOperation Operation { get; set; }

    /// <summary>
    /// Type of entity being synced: WORKOUT, WEIGHT, MEASUREMENT, PHOTO.
    /// </summary>
    public EntityType EntityType { get; set; }

    /// <summary>
    /// ID of the entity being synced.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// JSON payload containing the entity data.
    /// </summary>
    public string Payload { get; set; } = string.Empty;

    /// <summary>
    /// Current status of the sync operation.
    /// </summary>
    public SyncStatus Status { get; set; }

    /// <summary>
    /// Number of retry attempts made.
    /// </summary>
    public int RetryCount { get; set; }

    /// <summary>
    /// Last error message if sync failed.
    /// </summary>
    public string? LastError { get; set; }

    /// <summary>
    /// Timestamp when the sync queue entry was created.
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the sync queue entry was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Enum for sync operations.
/// </summary>
public enum SyncOperation
{
    Create,
    Update,
    Delete
}

/// <summary>
/// Enum for entity types.
/// </summary>
public enum EntityType
{
    Workout,
    Weight,
    Measurement,
    Photo
}

/// <summary>
/// Enum for sync status.
/// </summary>
public enum SyncStatus
{
    Pending,
    Syncing,
    Synced,
    Failed
}
