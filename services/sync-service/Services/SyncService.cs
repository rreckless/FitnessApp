using SyncService.Data;
using SyncService.Models;
using Microsoft.EntityFrameworkCore;

namespace SyncService.Services;

/// <summary>
/// Service for managing data synchronization between local and cloud.
/// </summary>
public class SyncService : ISyncService
{
    private readonly SyncDbContext _dbContext;
    private readonly IConflictResolutionService _conflictResolutionService;
    private readonly IRetryService _retryService;
    private readonly ILogger<SyncService> _logger;

    /// <summary>
    /// Initializes a new instance of the SyncService class.
    /// </summary>
    public SyncService(
        SyncDbContext dbContext,
        IConflictResolutionService conflictResolutionService,
        IRetryService retryService,
        ILogger<SyncService> logger)
    {
        _dbContext = dbContext;
        _conflictResolutionService = conflictResolutionService;
        _retryService = retryService;
        _logger = logger;
    }

    /// <summary>
    /// Pushes local changes to the cloud.
    /// </summary>
    public async Task<SyncResponse> PushAsync(Guid userId, SyncPushRequest request)
    {
        _logger.LogInformation("Starting push sync for user {UserId} with {ItemCount} items", 
            userId, request.Items.Count);

        var response = new SyncResponse
        {
            Success = true,
            Message = "Sync push completed",
            SyncedAt = DateTime.UtcNow
        };

        foreach (var item in request.Items)
        {
            try
            {
                // Create or update sync queue entry
                var syncQueueEntry = new SyncQueue
                {
                    Id = item.Id,
                    UserId = userId,
                    Operation = Enum.Parse<SyncOperation>(item.Operation, ignoreCase: true),
                    EntityType = Enum.Parse<EntityType>(item.EntityType, ignoreCase: true),
                    EntityId = item.EntityId,
                    Payload = item.Payload,
                    Status = SyncStatus.Pending,
                    RetryCount = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = item.UpdatedAt
                };

                // Check if entry already exists
                var existingEntry = await _dbContext.SyncQueues
                    .FirstOrDefaultAsync(sq => sq.Id == item.Id && sq.UserId == userId);

                if (existingEntry != null)
                {
                    // Check for conflicts
                    if (_conflictResolutionService.DetectConflict(item.UpdatedAt, existingEntry.UpdatedAt))
                    {
                        var (useLocal, resolvedTimestamp) = _conflictResolutionService.ResolveConflict(
                            item.UpdatedAt, existingEntry.UpdatedAt);

                        if (!useLocal)
                        {
                            _logger.LogInformation("Conflict resolved: Using existing cloud data for entity {EntityId}", 
                                item.EntityId);
                            continue;
                        }
                    }

                    // Update existing entry
                    existingEntry.Payload = item.Payload;
                    existingEntry.Status = SyncStatus.Pending;
                    existingEntry.RetryCount = 0;
                    existingEntry.UpdatedAt = item.UpdatedAt;
                    existingEntry.LastError = null;
                }
                else
                {
                    // Add new entry
                    _dbContext.SyncQueues.Add(syncQueueEntry);
                }

                await _dbContext.SaveChangesAsync();

                response.SyncedItems.Add(new SyncedItem
                {
                    Id = item.Id,
                    EntityType = item.EntityType,
                    EntityId = item.EntityId,
                    Operation = item.Operation,
                    SyncedAt = DateTime.UtcNow
                });

                _logger.LogInformation("Successfully queued sync item {ItemId} for user {UserId}", 
                    item.Id, userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pushing sync item {ItemId} for user {UserId}", 
                    item.Id, userId);

                response.Success = false;
                response.FailedItems.Add(new FailedSyncItem
                {
                    Id = item.Id,
                    EntityType = item.EntityType,
                    EntityId = item.EntityId,
                    Error = ex.Message,
                    RetryCount = 0
                });
            }
        }

        return response;
    }

    /// <summary>
    /// Pulls changes from the cloud.
    /// </summary>
    public async Task<SyncPullResponse> PullAsync(Guid userId, SyncPullRequest request)
    {
        _logger.LogInformation("Starting pull sync for user {UserId} with lastSyncAt {LastSyncAt}", 
            userId, request.LastSyncAt);

        var response = new SyncPullResponse
        {
            SyncedAt = DateTime.UtcNow
        };

        // Get synced items since last sync
        var query = _dbContext.SyncQueues
            .Where(sq => sq.UserId == userId && sq.Status == SyncStatus.Synced);

        if (request.LastSyncAt.HasValue)
        {
            query = query.Where(sq => sq.UpdatedAt > request.LastSyncAt.Value);
        }

        var syncedItems = await query
            .OrderBy(sq => sq.UpdatedAt)
            .ToListAsync();

        foreach (var item in syncedItems)
        {
            response.Changes.Add(new CloudChange
            {
                Operation = item.Operation.ToString(),
                EntityType = item.EntityType.ToString(),
                EntityId = item.EntityId,
                Payload = item.Payload,
                UpdatedAt = item.UpdatedAt
            });
        }

        _logger.LogInformation("Pull sync completed for user {UserId}: {ChangeCount} changes", 
            userId, response.Changes.Count);

        return response;
    }

    /// <summary>
    /// Gets the sync status for a user.
    /// </summary>
    public async Task<SyncStatusResponse> GetStatusAsync(Guid userId)
    {
        _logger.LogInformation("Getting sync status for user {UserId}", userId);

        var pendingCount = await _dbContext.SyncQueues
            .CountAsync(sq => sq.UserId == userId && sq.Status == SyncStatus.Pending);

        var syncingCount = await _dbContext.SyncQueues
            .CountAsync(sq => sq.UserId == userId && sq.Status == SyncStatus.Syncing);

        var failedCount = await _dbContext.SyncQueues
            .CountAsync(sq => sq.UserId == userId && sq.Status == SyncStatus.Failed);

        var lastSyncedItem = await _dbContext.SyncQueues
            .Where(sq => sq.UserId == userId && sq.Status == SyncStatus.Synced)
            .OrderByDescending(sq => sq.UpdatedAt)
            .FirstOrDefaultAsync();

        var lastSyncAttempt = await _dbContext.SyncQueues
            .Where(sq => sq.UserId == userId)
            .OrderByDescending(sq => sq.UpdatedAt)
            .FirstOrDefaultAsync();

        string status = "synced";
        if (syncingCount > 0)
            status = "syncing";
        else if (pendingCount > 0)
            status = "pending";

        return new SyncStatusResponse
        {
            Status = status,
            PendingCount = pendingCount,
            SyncingCount = syncingCount,
            FailedCount = failedCount,
            LastSyncAt = lastSyncedItem?.UpdatedAt,
            LastSyncAttemptAt = lastSyncAttempt?.UpdatedAt
        };
    }

    /// <summary>
    /// Processes pending sync items with retry logic.
    /// </summary>
    public async Task<int> ProcessPendingItemsAsync(Guid userId)
    {
        _logger.LogInformation("Processing pending sync items for user {UserId}", userId);

        var pendingItems = await _dbContext.SyncQueues
            .Where(sq => sq.UserId == userId && 
                   (sq.Status == SyncStatus.Pending || sq.Status == SyncStatus.Failed))
            .ToListAsync();

        int processedCount = 0;

        foreach (var item in pendingItems)
        {
            try
            {
                // Check if should retry
                if (item.Status == SyncStatus.Failed && !_retryService.ShouldRetry(item.RetryCount))
                {
                    _logger.LogWarning("Max retries exceeded for sync item {ItemId}", item.Id);
                    continue;
                }

                // Update status to syncing
                item.Status = SyncStatus.Syncing;
                item.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                // Simulate sync to cloud (in real implementation, this would call cloud API)
                // For now, mark as synced
                item.Status = SyncStatus.Synced;
                item.UpdatedAt = DateTime.UtcNow;
                item.LastError = null;
                await _dbContext.SaveChangesAsync();

                processedCount++;
                _logger.LogInformation("Successfully processed sync item {ItemId}", item.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing sync item {ItemId}", item.Id);

                item.Status = SyncStatus.Failed;
                item.RetryCount++;
                item.LastError = ex.Message;
                item.UpdatedAt = DateTime.UtcNow;

                // If should retry, schedule retry with exponential backoff
                if (_retryService.ShouldRetry(item.RetryCount))
                {
                    int delayMs = _retryService.GetRetryDelayMs(item.RetryCount);
                    _logger.LogInformation("Scheduling retry for sync item {ItemId} in {DelayMs}ms", 
                        item.Id, delayMs);
                    // In real implementation, would schedule background job with delay
                }

                await _dbContext.SaveChangesAsync();
            }
        }

        _logger.LogInformation("Processed {ProcessedCount} sync items for user {UserId}", 
            processedCount, userId);

        return processedCount;
    }
}
