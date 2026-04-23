namespace SyncService.Services;

/// <summary>
/// Interface for retry service with exponential backoff.
/// </summary>
public interface IRetryService
{
    /// <summary>
    /// Calculates the delay in milliseconds for a given retry attempt using exponential backoff.
    /// Retry delays: 1s, 2s, 4s, 8s (max 4 retries).
    /// </summary>
    /// <param name="retryCount">The current retry attempt number (0-based).</param>
    /// <returns>The delay in milliseconds.</returns>
    int GetRetryDelayMs(int retryCount);

    /// <summary>
    /// Determines if a retry should be attempted based on the retry count.
    /// </summary>
    /// <param name="retryCount">The current retry count.</param>
    /// <returns>True if retry should be attempted, false if max retries exceeded.</returns>
    bool ShouldRetry(int retryCount);

    /// <summary>
    /// Gets the maximum number of retries allowed.
    /// </summary>
    /// <returns>The maximum number of retries.</returns>
    int GetMaxRetries();
}
