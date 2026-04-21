using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SyncService.Data;
using SyncService.Models;

namespace SyncService.Services;

public class SyncServiceImpl : ISyncService
{
    private readonly SyncDbContext _dbContext;
    private readonly ILogger<SyncServiceImpl> _logger;
    private readonly IConfiguration _configuration;

    private static readonly int[] RetryDelays = { 1000, 2000, 4000, 8000 }; // Exponential backoff in ms

    public SyncServiceImpl(
        SyncDbContext dbContext,
        ILogger<SyncServiceImpl> logger,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task<SyncPullResponse> PullChangesAsync(Guid userId, long lastSyncTimestamp)
    {
        try
        {
            // Get all synced changes since last sync
            var changes = await _dbContext.SyncQueueEntries
                .Where(e => e.UserId == userId && e.Status == "SYNCED" && e.Timestamp > lastSyncTimestamp)
                .OrderBy(e => e.Timestamp)
                .ToListAsync();

            var serverTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var hasMoreChanges = changes.Count >= 100; // Pagination indicator

            _logger.LogInformation("Pulled {Count} changes for user {UserId} since {Timestamp}", 
                changes.Count, userId, lastSyncTimestamp);

            return new SyncPullResponse(changes, serverTimestamp, hasMoreChanges);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pulling changes for user {UserId}", userId);
            throw;
        }
    }

    public async Task<SyncPushResponse> PushChangesAsync(Guid userId, List<SyncQueueEntry> changes)
    {
        var successCount = 0;
        var failureCount = 0;
        var conflicts = new List<SyncConflict>();
        var serverTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        try
        {
            foreach (var change in changes)
            {
                change.UserId = userId;
                change.Status = "PENDING";
                change.RetryCount = 0;
                change.CreatedAt = DateTime.UtcNow;
                change.UpdatedAt = DateTime.UtcNow;

                // Check for conflicts
                var existingEntry = await _dbContext.SyncQueueEntries
                    .FirstOrDefaultAsync(e => e.EntityId == change.EntityId && 
                                             e.EntityType == change.EntityType &&
                                             e.UserId == userId &&
                                             e.Status == "SYNCED");

                if (existingEntry != null && existingEntry.Timestamp > change.Timestamp)
                {
                    // Conflict detected - cloud version is newer
                    var conflict = new SyncConflict
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        EntityType = change.EntityType,
                        EntityId = change.EntityId,
                        LocalVersion = change.Payload,
                        CloudVersion = existingEntry.Payload,
                        LocalTimestamp = change.Timestamp,
                        CloudTimestamp = existingEntry.Timestamp,
                        ResolutionStrategy = "LAST_WRITE_WINS",
                        ResolvedVersion = existingEntry.Payload, // Cloud wins
                        CreatedAt = DateTime.UtcNow,
                        ResolvedAt = DateTime.UtcNow
                    };
                    _dbContext.SyncConflicts.Add(conflict);
                    conflicts.Add(conflict);
                    failureCount++;

                    _logger.LogWarning("Conflict detected for entity {EntityId} of type {EntityType} for user {UserId}", 
                        change.EntityId, change.EntityType, userId);
                }
                else
                {
                    // No conflict, add to queue
                    _dbContext.SyncQueueEntries.Add(change);
                    successCount++;
                }
            }

            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Pushed {SuccessCount} changes with {FailureCount} conflicts for user {UserId}", 
                successCount, failureCount, userId);

            return new SyncPushResponse(successCount, failureCount, conflicts, serverTimestamp);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pushing changes for user {UserId}", userId);
            throw;
        }
    }

    public async Task<SyncStatus> GetSyncStatusAsync(Guid userId)
    {
        try
        {
            var pendingCount = await _dbContext.SyncQueueEntries
                .CountAsync(e => e.UserId == userId && e.Status == "PENDING");

            var syncingCount = await _dbContext.SyncQueueEntries
                .CountAsync(e => e.UserId == userId && e.Status == "SYNCING");

            var failedCount = await _dbContext.SyncQueueEntries
                .CountAsync(e => e.UserId == userId && e.Status == "FAILED");

            var lastSync = await _dbContext.SyncQueueEntries
                .Where(e => e.UserId == userId && e.Status == "SYNCED")
                .OrderByDescending(e => e.SyncedAt)
                .FirstOrDefaultAsync();

            var status = pendingCount > 0 ? "PENDING" : 
                        syncingCount > 0 ? "SYNCING" : 
                        failedCount > 0 ? "FAILED" : "SYNCED";

            return new SyncStatus(userId, pendingCount, syncingCount, failedCount, lastSync?.SyncedAt, status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sync status for user {UserId}", userId);
            throw;
        }
    }

    public async Task<bool> ProcessSyncQueueAsync()
    {
        try
        {
            // Get pending entries with retry count < max retries
            var maxRetries = _configuration.GetValue<int>("Sync:MaxRetries", 4);
            var pendingEntries = await _dbContext.SyncQueueEntries
                .Where(e => e.Status == "PENDING" && e.RetryCount < maxRetries)
                .OrderBy(e => e.CreatedAt)
                .Take(100)
                .ToListAsync();

            if (pendingEntries.Count == 0)
                return false;

            foreach (var entry in pendingEntries)
            {
                try
                {
                    entry.Status = "SYNCING";
                    entry.UpdatedAt = DateTime.UtcNow;
                    await _dbContext.SaveChangesAsync();

                    // Simulate sync operation (in real implementation, call other services)
                    await Task.Delay(100);

                    entry.Status = "SYNCED";
                    entry.SyncedAt = DateTime.UtcNow;
                    entry.UpdatedAt = DateTime.UtcNow;
                    entry.LastError = null;

                    _logger.LogInformation("Synced entry {EntryId} for user {UserId}", entry.Id, entry.UserId);
                }
                catch (Exception ex)
                {
                    entry.Status = "PENDING";
                    entry.RetryCount++;
                    entry.LastError = ex.Message;
                    entry.UpdatedAt = DateTime.UtcNow;

                    // Calculate backoff delay
                    var delayIndex = Math.Min(entry.RetryCount - 1, RetryDelays.Length - 1);
                    var nextRetryTime = DateTime.UtcNow.AddMilliseconds(RetryDelays[delayIndex]);

                    _logger.LogWarning(ex, "Failed to sync entry {EntryId} for user {UserId}, retry {RetryCount} at {NextRetryTime}", 
                        entry.Id, entry.UserId, entry.RetryCount, nextRetryTime);

                    if (entry.RetryCount >= maxRetries)
                    {
                        entry.Status = "FAILED";
                        _logger.LogError("Entry {EntryId} for user {UserId} failed after {RetryCount} retries", 
                            entry.Id, entry.UserId, entry.RetryCount);
                    }
                }
            }

            await _dbContext.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing sync queue");
            return false;
        }
    }
}
