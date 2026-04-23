using SyncService.Models;

namespace SyncService.Services;

/// <summary>
/// Interface for sync service.
/// </summary>
public interface ISyncService
{
    /// <summary>
    /// Pushes local changes to the cloud.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The sync push request containing items to sync.</param>
    /// <returns>The sync response with results.</returns>
    Task<SyncResponse> PushAsync(Guid userId, SyncPushRequest request);

    /// <summary>
    /// Pulls changes from the cloud.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The sync pull request with last sync timestamp.</param>
    /// <returns>The sync pull response with cloud changes.</returns>
    Task<SyncPullResponse> PullAsync(Guid userId, SyncPullRequest request);

    /// <summary>
    /// Gets the sync status for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>The sync status response.</returns>
    Task<SyncStatusResponse> GetStatusAsync(Guid userId);

    /// <summary>
    /// Processes pending sync items with retry logic.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>The number of items processed.</returns>
    Task<int> ProcessPendingItemsAsync(Guid userId);
}
