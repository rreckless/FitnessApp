using Xunit;
using SyncService.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace SyncService.Tests;

/// <summary>
/// Unit tests for RetryService.
/// </summary>
public class RetryServiceTests
{
    private readonly Mock<ILogger<RetryService>> _mockLogger;
    private readonly RetryService _service;

    public RetryServiceTests()
    {
        _mockLogger = new Mock<ILogger<RetryService>>();
        _service = new RetryService(_mockLogger.Object);
    }

    [Theory]
    [InlineData(0, 1000)]   // First retry: 1 second
    [InlineData(1, 2000)]   // Second retry: 2 seconds
    [InlineData(2, 4000)]   // Third retry: 4 seconds
    [InlineData(3, 8000)]   // Fourth retry: 8 seconds
    public void GetRetryDelayMs_ReturnsExponentialBackoff(int retryCount, int expectedDelayMs)
    {
        // Act
        int delayMs = _service.GetRetryDelayMs(retryCount);

        // Assert
        Assert.Equal(expectedDelayMs, delayMs);
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, true)]
    [InlineData(4, false)]  // Max retries exceeded
    [InlineData(5, false)]  // Beyond max retries
    public void ShouldRetry_ReturnsCorrectValue(int retryCount, bool expected)
    {
        // Act
        bool shouldRetry = _service.ShouldRetry(retryCount);

        // Assert
        Assert.Equal(expected, shouldRetry);
    }

    [Fact]
    public void GetMaxRetries_Returns4()
    {
        // Act
        int maxRetries = _service.GetMaxRetries();

        // Assert
        Assert.Equal(4, maxRetries);
    }

    [Fact]
    public void GetRetryDelayMs_WithInvalidRetryCount_Returns0()
    {
        // Act
        int delayMs = _service.GetRetryDelayMs(-1);

        // Assert
        Assert.Equal(0, delayMs);
    }
}
