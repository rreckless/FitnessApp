using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StreakService.Data;
using StreakService.Models;
using StreakService.Services;
using Xunit;

namespace StreakService.Tests;

public class StreakGetTests
{
    private StreakDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<StreakDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new StreakDbContext(options);
    }

    private IStreakService CreateStreakService(StreakDbContext context)
    {
        var mockPublisher = new Mock<IRabbitMQPublisher>().Object;
        var mockLogger = new Mock<ILogger<StreakServiceImpl>>();
        return new StreakServiceImpl(context, mockPublisher, mockLogger.Object);
    }

    [Fact]
    public async Task GetStreak_ExistingUser_ReturnsStreakData()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();
        var today = DateTime.UtcNow;

        var streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 5,
            LongestStreak = 10,
            LastWorkoutDate = today.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(streak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetStreakAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(5, result.CurrentStreak);
        Assert.Equal(10, result.LongestStreak);
    }

    [Fact]
    public async Task GetStreak_NonExistentUser_ThrowsKeyNotFoundException()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.GetStreakAsync(userId));
    }

    [Fact]
    public async Task GetMilestones_ExistingUser_ReturnsMilestones()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();

        var milestone1 = new StreakMilestone
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Days = 7,
            XPReward = 100,
            AchievedAt = DateTime.UtcNow.AddDays(-10),
            CreatedAt = DateTime.UtcNow.AddDays(-10)
        };

        var milestone2 = new StreakMilestone
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Days = 14,
            XPReward = 250,
            AchievedAt = DateTime.UtcNow.AddDays(-3),
            CreatedAt = DateTime.UtcNow.AddDays(-3)
        };

        context.StreakMilestones.Add(milestone1);
        context.StreakMilestones.Add(milestone2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetMilestonesAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.Equal(14, result[0].Days); // Most recent first
        Assert.Equal(7, result[1].Days);
    }

    [Fact]
    public async Task GetMilestones_NoMilestones_ReturnsEmptyList()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();

        // Act
        var result = await service.GetMilestonesAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetMilestones_MultipleUsers_ReturnsOnlyUserMilestones()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        var milestone1 = new StreakMilestone
        {
            Id = Guid.NewGuid(),
            UserId = userId1,
            Days = 7,
            XPReward = 100,
            AchievedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        var milestone2 = new StreakMilestone
        {
            Id = Guid.NewGuid(),
            UserId = userId2,
            Days = 14,
            XPReward = 250,
            AchievedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        context.StreakMilestones.Add(milestone1);
        context.StreakMilestones.Add(milestone2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetMilestonesAsync(userId1);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(userId1, result[0].UserId);
        Assert.Equal(7, result[0].Days);
    }

    [Fact]
    public async Task GetOrCreateStreak_NewUser_CreatesStreak()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();

        // Act
        var result = await service.GetOrCreateStreakAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(0, result.CurrentStreak);
        Assert.Equal(0, result.LongestStreak);
    }

    [Fact]
    public async Task GetOrCreateStreak_ExistingUser_ReturnsExistingStreak()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = CreateStreakService(context);
        var userId = Guid.NewGuid();

        var existingStreak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 5,
            LongestStreak = 10,
            LastWorkoutDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.StreakTrackings.Add(existingStreak);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetOrCreateStreakAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(5, result.CurrentStreak);
        Assert.Equal(10, result.LongestStreak);
    }
}
