using Xunit;
using SyncService.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace SyncService.Tests;

/// <summary>
/// Unit tests for ConflictResolutionService.
/// </summary>
public class ConflictResolutionServiceTests
{
    private readonly Mock<ILogger<ConflictResolutionService>> _mockLogger;
    private readonly ConflictResolutionService _service;

    public ConflictResolutionServiceTests()
    {
        _mockLogger = new Mock<ILogger<ConflictResolutionService>>();
        _service = new ConflictResolutionService(_mockLogger.Object);
    }

    [Fact]
    public void ResolveConflict_WhenLocalIsNewer_ReturnsLocal()
    {
        // Arrange
        var cloudTime = DateTime.UtcNow;
        var localTime = cloudTime.AddSeconds(10);

        // Act
        var (useLocal, resolvedTime) = _service.ResolveConflict(localTime, cloudTime);

        // Assert
        Assert.True(useLocal);
        Assert.Equal(localTime, resolvedTime);
    }

    [Fact]
    public void ResolveConflict_WhenCloudIsNewer_ReturnsCloud()
    {
        // Arrange
        var localTime = DateTime.UtcNow;
        var cloudTime = localTime.AddSeconds(10);

        // Act
        var (useLocal, resolvedTime) = _service.ResolveConflict(localTime, cloudTime);

        // Assert
        Assert.False(useLocal);
        Assert.Equal(cloudTime, resolvedTime);
    }

    [Fact]
    public void ResolveConflict_WhenTimestampsAreEqual_ReturnsLocal()
    {
        // Arrange
        var timestamp = DateTime.UtcNow;

        // Act
        var (useLocal, resolvedTime) = _service.ResolveConflict(timestamp, timestamp);

        // Assert
        Assert.True(useLocal);
        Assert.Equal(timestamp, resolvedTime);
    }

    [Fact]
    public void DetectConflict_WhenTimestampsAreDifferent_ReturnsTrue()
    {
        // Arrange
        var localTime = DateTime.UtcNow;
        var cloudTime = localTime.AddSeconds(5);

        // Act
        var hasConflict = _service.DetectConflict(localTime, cloudTime);

        // Assert
        Assert.True(hasConflict);
    }

    [Fact]
    public void DetectConflict_WhenTimestampsAreEqual_ReturnsFalse()
    {
        // Arrange
        var timestamp = DateTime.UtcNow;

        // Act
        var hasConflict = _service.DetectConflict(timestamp, timestamp);

        // Assert
        Assert.False(hasConflict);
    }
}
