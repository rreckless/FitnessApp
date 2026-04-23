using Xunit;
using SyncService.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace SyncService.Tests;

/// <summary>
/// Property-based tests for sync retry logic with exponential backoff.
/// </summary>
public class SyncRetryLogicPropertyTests
{
    private readonly Mock<ILogger<RetryService>> _mockLogger;
    private readonly RetryService _service;

    public SyncRetryLogicPropertyTests()
    {
        _mockLogger = new Mock<ILogger<RetryService>>();
        _service = new RetryService(_mockLogger.Object);
    }

    [Fact]
    public void GetRetryDelayMs_ExponentialBackoff_Property()
    {
        // Property: Retry delays should follow exponential backoff pattern (1s, 2s, 4s, 8s)
        for (int retryCount = 0; retryCount < 4; retryCount++)
        {
            int delayMs = _service.GetRetryDelayMs(retryCount);
            int expectedDelayMs = 1000 * (int)Math.Pow(2, retryCount);

            Assert.Equal(expectedDelayMs, delayMs);
        }
    }

    [Fact]
    public void GetRetryDelayMs_IncreasingDelays_Property()
    {
        // Property: Each retry should have a longer delay than the previous
        for (int retryCount = 0; retryCount < 3; retryCount++)
        {
            int currentDelay = _service.GetRetryDelayMs(retryCount);
            int nextDelay = _service.GetRetryDelayMs(retryCount + 1);

            Assert.True(nextDelay > currentDelay);
        }
    }

    [Fact]
    public void ShouldRetry_MaxRetriesEnforced_Property()
    {
        // Property: Should retry for counts 0-3, but not for 4+
        for (int retryCount = 0; retryCount <= 10; retryCount++)
        {
            bool shouldRetry = _service.ShouldRetry(retryCount);

            if (retryCount < 4)
            {
                Assert.True(shouldRetry);
            }
            else
            {
                Assert.False(shouldRetry);
            }
        }
    }

    [Fact]
    public void GetMaxRetries_Consistent_Property()
    {
        // Property: GetMaxRetries should always return 4
        for (int i = 0; i < 100; i++)
        {
            int maxRetries = _service.GetMaxRetries();
            Assert.Equal(4, maxRetries);
        }
    }

    [Fact]
    public void RetryLogic_Idempotent_Property()
    {
        // Property: Calling retry logic multiple times with same input should produce same output
        for (int retryCount = 0; retryCount < 4; retryCount++)
        {
            int delay1 = _service.GetRetryDelayMs(retryCount);
            int delay2 = _service.GetRetryDelayMs(retryCount);
            bool shouldRetry1 = _service.ShouldRetry(retryCount);
            bool shouldRetry2 = _service.ShouldRetry(retryCount);

            Assert.Equal(delay1, delay2);
            Assert.Equal(shouldRetry1, shouldRetry2);
        }
    }

    [Fact]
    public void RetryDelays_SpecificValues_Property()
    {
        // Property: Verify specific exponential backoff values
        var expectedDelays = new[] { 1000, 2000, 4000, 8000 };

        for (int i = 0; i < expectedDelays.Length; i++)
        {
            int delayMs = _service.GetRetryDelayMs(i);
            Assert.Equal(expectedDelays[i], delayMs);
        }
    }
}
