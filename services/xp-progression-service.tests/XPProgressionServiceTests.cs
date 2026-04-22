using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

public class XPProgressionServiceTests
{
    private readonly XPDbContext _context;
    private readonly Mock<ILogger<XPProgressionServiceImpl>> _mockLogger;
    private readonly XPProgressionServiceImpl _service;

    public XPProgressionServiceTests()
    {
        var options = new DbContextOptionsBuilder<XPDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new XPDbContext(options);
        _mockLogger = new Mock<ILogger<XPProgressionServiceImpl>>();
        _service = new XPProgressionServiceImpl(_context, _mockLogger.Object);
    }

    [Fact]
    public async Task GetUserXPAsync_WithNewUser_InitializesAtLevel1()
    {
        // Arrange
        var userId = Guid.NewGuid();

        // Act
        var userXP = await _service.GetUserXPAsync(userId);

        // Assert
        Assert.NotNull(userXP);
        Assert.Equal(userId, userXP.UserId);
        Assert.Equal(0, userXP.TotalXP);
        Assert.Equal(1, userXP.CurrentLevel);
        Assert.Equal(500, userXP.XPToNextLevel);
    }

    [Fact]
    public async Task GetUserXPAsync_WithExistingUser_ReturnsExistingData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 1000,
            CurrentLevel = 2,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(existingXP);
        await _context.SaveChangesAsync();

        // Act
        var userXP = await _service.GetUserXPAsync(userId);

        // Assert
        Assert.Equal(1000, userXP.TotalXP);
        Assert.Equal(2, userXP.CurrentLevel);
    }

    [Fact]
    public async Task AddXPAsync_WithValidXP_IncreasesTotalXP()
    {
        // Arrange
        var userId = Guid.NewGuid();
        int xpToAdd = 100;

        // Act
        var userXP = await _service.AddXPAsync(userId, xpToAdd, "WorkoutCompleted");

        // Assert
        Assert.Equal(100, userXP.TotalXP);
    }

    [Fact]
    public async Task AddXPAsync_WithMultipleAdditions_AccumulatesXP()
    {
        // Arrange
        var userId = Guid.NewGuid();

        // Act
        await _service.AddXPAsync(userId, 100, "WorkoutCompleted");
        var userXP = await _service.AddXPAsync(userId, 150, "WorkoutCompleted");

        // Assert
        Assert.Equal(250, userXP.TotalXP);
    }

    [Fact]
    public async Task ProcessLevelUpAsync_WithEnoughXP_LevelsUp()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 500,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        var (leveledUp, newLevel) = await _service.ProcessLevelUpAsync(userId);

        // Assert
        Assert.True(leveledUp);
        Assert.Equal(2, newLevel);
    }

    [Fact]
    public async Task ProcessLevelUpAsync_WithoutEnoughXP_DoesNotLevelUp()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 250,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        var (leveledUp, newLevel) = await _service.ProcessLevelUpAsync(userId);

        // Assert
        Assert.False(leveledUp);
        Assert.Equal(1, newLevel);
    }

    [Fact]
    public async Task ProcessLevelUpAsync_WithMultipleLevelUps_LevelsUpMultipleTimes()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 3000, // Enough for level 4
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        var (leveledUp, newLevel) = await _service.ProcessLevelUpAsync(userId);

        // Assert
        Assert.True(leveledUp);
        Assert.Equal(4, newLevel);
    }

    [Fact]
    public async Task CheckLevelUpAsync_WithEnoughXP_ReturnsTrue()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 500,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        bool willLevelUp = await _service.CheckLevelUpAsync(userId);

        // Assert
        Assert.True(willLevelUp);
    }

    [Fact]
    public async Task CheckLevelUpAsync_WithoutEnoughXP_ReturnsFalse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 250,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        bool willLevelUp = await _service.CheckLevelUpAsync(userId);

        // Assert
        Assert.False(willLevelUp);
    }

    [Fact]
    public async Task AddXPAsync_RecordsProgressionHistory()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        // Act
        await _service.AddXPAsync(userId, 100, "WorkoutCompleted", workoutId);

        // Assert
        var history = _context.ProgressionHistories.FirstOrDefault(h => h.UserId == userId);
        Assert.NotNull(history);
        Assert.Equal(100, history.XPEarned);
        Assert.Equal("WorkoutCompleted", history.EventType);
        Assert.Equal(workoutId, history.RelatedEntityId);
    }

    [Fact]
    public async Task ProcessLevelUpAsync_UpdatesXPToNextLevel()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 750, // Between level 2 (500) and level 3 (1500)
            CurrentLevel = 2,
            XPToNextLevel = 750,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        await _service.ProcessLevelUpAsync(userId);
        var updatedXP = await _service.GetUserXPAsync(userId);

        // Assert
        // XP to next level should be 1500 - 750 = 750
        Assert.Equal(750, updatedXP.XPToNextLevel);
    }

    [Fact]
    public async Task ProcessLevelUpAsync_CapsAtLevel10()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = 50000, // Way more than level 10
            CurrentLevel = 10,
            XPToNextLevel = 0,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.UserXPs.Add(userXP);
        await _context.SaveChangesAsync();

        // Act
        var (leveledUp, newLevel) = await _service.ProcessLevelUpAsync(userId);

        // Assert
        Assert.False(leveledUp);
        Assert.Equal(10, newLevel);
    }
}
