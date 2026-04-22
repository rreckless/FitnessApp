using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StreakService.Data;
using StreakService.Models;
using StreakService.Services;
using Xunit;

namespace StreakService.Tests;

public class StreakIncrementTests
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
    public async Task IncrementStreak_FirstWorkout_SetsStreakToOne()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(0, result.LongestStreak);
    }

    [Fact]
    public async Task IncrementStreak_ConsecutiveDays_IncrementsStreak()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create initial streak
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 1,
            LongestStreak = 1,
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
        Assert.Equal(2, result.CurrentStreak);
        Assert.Equal(1, result.LongestStreak);
    }

    [Fact]
    public async Task IncrementStreak_SkippedDay_ResetsStreakAndPreservesLongest()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var twoDaysAgo = today.AddDays(-2);

        // Create streak with 5 days
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
        Assert.Equal(1, result.CurrentStreak);
        Assert.Equal(5, result.LongestStreak); // Longest streak preserved
    }

    [Fact]
    public async Task IncrementStreak_AlreadyWorkedOutToday_DoesNotIncrement()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;

        // Create streak with today's workout
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 3,
            LongestStreak = 3,
            LastWorkoutDate = today.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.CurrentStreak); // No change
    }

    [Fact]
    public async Task IncrementStreak_MilestoneDay7_PublishesEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 6 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 6,
            LongestStreak = 6,
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
        Assert.Equal(7, result.CurrentStreak);
        Assert.Equal(7, result.MilestoneReached);
        Assert.Equal(100, result.XPReward);
        mockPublisher.Verify(p => p.PublishStreakMilestoneAsync(It.IsAny<StreakMilestoneEvent>()), Times.Once);
    }

    [Fact]
    public async Task IncrementStreak_MilestoneDay14_PublishesEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 13 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 13,
            LongestStreak = 13,
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
        Assert.Equal(14, result.CurrentStreak);
        Assert.Equal(14, result.MilestoneReached);
        Assert.Equal(250, result.XPReward);
    }

    [Fact]
    public async Task IncrementStreak_MilestoneDay30_PublishesEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 29 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 29,
            LongestStreak = 29,
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
        Assert.Equal(30, result.CurrentStreak);
        Assert.Equal(30, result.MilestoneReached);
        Assert.Equal(500, result.XPReward);
    }

    [Fact]
    public async Task IncrementStreak_MilestoneDay60_PublishesEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 59 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 59,
            LongestStreak = 59,
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
        Assert.Equal(60, result.CurrentStreak);
        Assert.Equal(60, result.MilestoneReached);
        Assert.Equal(1000, result.XPReward);
    }

    [Fact]
    public async Task IncrementStreak_MilestoneDay100_PublishesEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 99 days
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 99,
            LongestStreak = 99,
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
        Assert.Equal(100, result.CurrentStreak);
        Assert.Equal(100, result.MilestoneReached);
        Assert.Equal(2000, result.XPReward);
    }

    [Fact]
    public async Task IncrementStreak_NonMilestoneDay_DoesNotPublishEvent()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 5 days
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
        Assert.Equal(6, result.CurrentStreak);
        Assert.Null(result.MilestoneReached);
        Assert.Null(result.XPReward);
        mockPublisher.Verify(p => p.PublishStreakMilestoneAsync(It.IsAny<StreakMilestoneEvent>()), Times.Never);
    }

    [Fact]
    public async Task IncrementStreak_DuplicateMilestone_DoesNotPublishAgain()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var mockPublisher = new Mock<IRabbitMQPublisher>();
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        var service = new StreakServiceImpl(context, mockPublisher.Object, mockLogger.Object);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;
        var yesterday = today.AddDays(-1);

        // Create streak with 7 days and existing milestone
        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 7,
            LongestStreak = 7,
            LastWorkoutDate = yesterday.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);

        var milestone = new StreakMilestone
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Days = 7,
            XPReward = 100,
            AchievedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        context.StreakMilestones.Add(milestone);
        await context.SaveChangesAsync();

        // Act
        var result = await service.IncrementStreakAsync(userId, today);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(8, result.CurrentStreak);
        Assert.Null(result.MilestoneReached);
        mockPublisher.Verify(p => p.PublishStreakMilestoneAsync(It.IsAny<StreakMilestoneEvent>()), Times.Never);
    }
}
