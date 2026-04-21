using SyncService.Models;

namespace SyncService.Services;

public interface ISyncService
{
    Task<SyncPullResponse> PullChangesAsync(Guid userId, long lastSyncTimestamp);
    Task<SyncPushResponse> PushChangesAsync(Guid userId, List<SyncQueueEntry> changes);
    Task<SyncStatus> GetSyncStatusAsync(Guid userId);
    Task<bool> ProcessSyncQueueAsync();
}

public record SyncPullResponse(
    List<SyncQueueEntry> Changes,
    long ServerTimestamp,
    bool HasMoreChanges
);

public record SyncPushResponse(
    int SuccessCount,
    int FailureCount,
    List<SyncConflict> Conflicts,
    long ServerTimestamp
);

public record SyncStatus(
    Guid UserId,
    int PendingCount,
    int SyncingCount,
    int FailedCount,
    DateTime? LastSyncAt,
    string Status // SYNCED, SYNCING, PENDING, FAILED
);

public record SyncQueueEntryRequest(
    string Operation,
    string EntityType,
    Guid EntityId,
    string Payload,
    long Timestamp
);
