namespace SyncService.Services;

/// <summary>
/// Service for managing retry logic with exponential backoff.
/// </summary>
public class RetryService : IRetryService
{
    private readonly ILogger<RetryService> _logger;
    private const int MaxRetries = 4;
    private const int InitialDelayMs = 1000; // 1 second

    /// <summary>
    /// Initializes a new instance of the RetryService class.
    /// </summary>
    public RetryService(ILogger<RetryService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Calculates the delay in milliseconds for a given retry attempt using exponential backoff.
    /// Retry delays: 1s, 2s, 4s, 8s (max 4 retries).
    /// </summary>
    /// <param name="retryCount">The current retry attempt number (0-based).</param>
    /// <returns>The delay in milliseconds.</returns>
    public int GetRetryDelayMs(int retryCount)
    {
        if (retryCount < 0 || retryCount >= MaxRetries)
        {
            _logger.LogWarning("Invalid retry count: {RetryCount}. Max retries: {MaxRetries}", 
                retryCount, MaxRetries);
            return 0;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s
        int delayMs = InitialDelayMs * (int)Math.Pow(2, retryCount);
        _logger.LogInformation("Retry {RetryCount}: Delay {DelayMs}ms", retryCount, delayMs);
        return delayMs;
    }

    /// <summary>
    /// Determines if a retry should be attempted based on the retry count.
    /// </summary>
    /// <param name="retryCount">The current retry count.</param>
    /// <returns>True if retry should be attempted, false if max retries exceeded.</returns>
    public bool ShouldRetry(int retryCount)
    {
        bool shouldRetry = retryCount < MaxRetries;
        
        if (!shouldRetry)
        {
            _logger.LogWarning("Max retries ({MaxRetries}) exceeded for retry count {RetryCount}", 
                MaxRetries, retryCount);
        }

        return shouldRetry;
    }

    /// <summary>
    /// Gets the maximum number of retries allowed.
    /// </summary>
    /// <returns>The maximum number of retries.</returns>
    public int GetMaxRetries()
    {
        return MaxRetries;
    }
}
