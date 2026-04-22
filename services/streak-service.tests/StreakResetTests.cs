using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StreakService.Data;
using StreakService.Models;
using StreakService.Services;
using Xunit;

namespace StreakService.Tests;

public class StreakResetTests
{
    private StreakDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<StreakDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new StreakDbContext(options);
    }

    private IStreakService CreateStreakService(StreakDbContext context, IRabbitMQPublisher? publisher = null)
    {
        var mockPublisher = publisher ?? new Mock<IRabbitMQPublisher>().Object;
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        return new StreakServiceImpl(context, mockPublisher, mockLogger.Object);
    }

    [Fact]
    public async Task IncrementStreak_SkippedOneDay_ResetsStreakToOne()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with 10 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 10,
            LongestStreak = 10,
            LastWorkoutDate = twoDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(10, result.LongestStreak);
    }

    [Fact]
    public async Task IncrementStreak_SkippedMultipleDays_ResetsStreakToOne()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var fiveDaysAgo = today.AddDays(-5);

        // Create streak with 15 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 15,
            LongestStreak = 15,
            LastWorkoutDate = fiveDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(15, result.LongestStreak);
    }

    [Fact]
    public async Task IncrementStreak_ResetPreservesLongestStreak()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with current 8 days and longest 20 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 8,
            LongestStreak = 20,
            LastWorkoutDate = twoDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(20, result.LongestStreak); // Longest streak unchanged
    }

    [Fact]
    public async Task IncrementStreak_ResetUpdatesLongestIfCurrentWasHigher()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with current 25 days and longest 20 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 25,
            LongestStreak = 20,
            LastWorkoutDate = twoDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(25, result.LongestStreak); // Updated to current streak
    }

    [Fact]
    public async Task IncrementStreak_ResetDoesNotPublishEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with 10 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 10,
            LongestStreak = 10,
            LastWorkoutDate = twoDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Null(result.MilestoneReached);
        Assert.Null(result.XPReward);
        mockPublisher.Verify(p => p.PublishStreakMilestoneAsync(It.IsAny<StreakMilestoneEvent>()), Times.Never);
    }

    [Fact]
    public async Task IncrementStreak_24HourBoundary_ConsecutiveDay()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with yesterday's workout
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 5,
            LongestStreak = 5,
            LastWorkoutDate = yesterday.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(6, result.CurrentStreak); // Incremented, not reset
    }

    [Fact]
    public async Task IncrementStreak_ExactlyTwoDaysAgo_StreakReset()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with workout 2 days ago
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 5,
            LongestStreak = 5,
            LastWorkoutDate = twoDaysAgo.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.CurrentStreak); // Reset
        Assert.Equal(5, result.LongestStreak); // Preserved
    }
}
