namespace SyncService.Models;

/// <summary>
/// Request model for pushing local changes to cloud.
/// </summary>
public class SyncPushRequest
{
    /// <summary>
    /// List of sync queue items to push to cloud.
    /// </summary>
    public List<SyncQueueItem> Items { get; set; } = new();
}

/// <summary>
/// Represents a single sync queue item in a push request.
/// </summary>
public class SyncQueueItem
{
    /// <summary>
    /// Unique identifier for the sync queue entry.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Type of operation: CREATE, UPDATE, DELETE.
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// Type of entity being synced.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the entity being synced.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// JSON payload containing the entity data.
    /// </summary>
    public string Payload { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when the entity was last updated on the client.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Request model for pulling changes from cloud.
/// </summary>
public class SyncPullRequest
{
    /// <summary>
    /// Timestamp of the last successful sync (for incremental sync).
    /// </summary>
    public DateTime? LastSyncAt { get; set; }
}
