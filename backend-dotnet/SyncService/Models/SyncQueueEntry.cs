namespace SyncService.Models;

public class SyncQueueEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Operation { get; set; } = string.Empty; // CREATE, UPDATE, DELETE
    public string EntityType { get; set; } = string.Empty; // WORKOUT, WEIGHT, MEASUREMENT, PHOTO
    public Guid EntityId { get; set; }
    public string Payload { get; set; } = string.Empty; // JSON payload
    public string Status { get; set; } = "PENDING"; // PENDING, SYNCING, SYNCED, FAILED
    public int RetryCount { get; set; } = 0;
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? SyncedAt { get; set; }
    public long Timestamp { get; set; } // Unix timestamp for conflict resolution
}

public class SyncConflict
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string LocalVersion { get; set; } = string.Empty; // JSON
    public string CloudVersion { get; set; } = string.Empty; // JSON
    public long LocalTimestamp { get; set; }
    public long CloudTimestamp { get; set; }
    public string ResolutionStrategy { get; set; } = "LAST_WRITE_WINS"; // LAST_WRITE_WINS, MANUAL
    public string? ResolvedVersion { get; set; } // JSON
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
