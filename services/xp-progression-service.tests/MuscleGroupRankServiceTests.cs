using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

public class MuscleGroupRankServiceTests
{
    private readonly XPDbContext _context;
    private readonly Mock<ILogger<MuscleGroupRankService>> _mockLogger;
    private readonly MuscleGroupRankService _service;

    public MuscleGroupRankServiceTests()
    {
        var options = new DbContextOptionsBuilder<XPDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new XPDbContext(options);
        _mockLogger = new Mock<ILogger<MuscleGroupRankService>>();
        _service = new MuscleGroupRankService(_context, _mockLogger.Object);
    }

    [Fact]
    public async Task GetMuscleGroupRankAsync_WithNewMuscleGroup_InitializesAtRank1()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Chest;

        // Act
        var rank = await _service.GetMuscleGroupRankAsync(userId, muscleGroup);

        // Assert
        Assert.NotNull(rank);
        Assert.Equal(userId, rank.UserId);
        Assert.Equal(muscleGroup, rank.MuscleGroup);
        Assert.Equal(1, rank.Rank);
        Assert.Equal(0, rank.TotalVolume);
    }

    [Fact]
    public async Task GetMuscleGroupRankAsync_WithExistingRank_ReturnsExistingData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Back;
        var existingRank = new MuscleGroupRank
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MuscleGroup = muscleGroup,
            Rank = 3,
            TotalVolume = 20000,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.MuscleGroupRanks.Add(existingRank);
        await _context.SaveChangesAsync();

        // Act
        var rank = await _service.GetMuscleGroupRankAsync(userId, muscleGroup);

        // Assert
        Assert.Equal(3, rank.Rank);
        Assert.Equal(20000, rank.TotalVolume);
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_WithValidVolume_IncreasesTotalVolume()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Chest;
        int volumeToAdd = 5000;

        // Act
        var rank = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, volumeToAdd);

        // Assert
        Assert.Equal(5000, rank.TotalVolume);
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_WithMultipleUpdates_AccumulatesVolume()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Legs;

        // Act
        await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 5000);
        var rank = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 7000);

        // Assert
        Assert.Equal(12000, rank.TotalVolume);
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_WithEnoughVolume_RanksUp()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Shoulders;

        // Act
        var rank = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 5000);

        // Assert
        Assert.Equal(2, rank.Rank); // Should rank up to 2 at 5000 volume
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_WithMultipleRankUps_RanksUpMultipleTimes()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Arms;

        // Act
        var rank = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 30000);

        // Assert
        Assert.Equal(4, rank.Rank); // Should rank up to 4 at 30000 volume
    }

    [Fact]
    public async Task CheckRankUpAsync_WithEnoughVolume_ReturnsTrue()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Core;
        var rank = new MuscleGroupRank
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MuscleGroup = muscleGroup,
            Rank = 1,
            TotalVolume = 5000,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.MuscleGroupRanks.Add(rank);
        await _context.SaveChangesAsync();

        // Act
        bool willRankUp = await _service.CheckRankUpAsync(userId, muscleGroup);

        // Assert
        Assert.True(willRankUp);
    }

    [Fact]
    public async Task CheckRankUpAsync_WithoutEnoughVolume_ReturnsFalse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Chest;
        var rank = new MuscleGroupRank
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MuscleGroup = muscleGroup,
            Rank = 1,
            TotalVolume = 2000,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.MuscleGroupRanks.Add(rank);
        await _context.SaveChangesAsync();

        // Act
        bool willRankUp = await _service.CheckRankUpAsync(userId, muscleGroup);

        // Assert
        Assert.False(willRankUp);
    }

    [Fact]
    public async Task GetAllMuscleGroupRanksAsync_ReturnsAllMuscleGroups()
    {
        // Arrange
        var userId = Guid.NewGuid();

        // Act
        var ranks = await _service.GetAllMuscleGroupRanksAsync(userId);

        // Assert
        Assert.Equal(6, ranks.Count); // 6 muscle groups
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Chest);
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Back);
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Shoulders);
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Arms);
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Legs);
        Assert.Contains(ranks, r => r.MuscleGroup == MuscleGroup.Core);
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_CapsAtRank10()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Back;
        var rank = new MuscleGroupRank
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MuscleGroup = muscleGroup,
            Rank = 10,
            TotalVolume = 225000,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.MuscleGroupRanks.Add(rank);
        await _context.SaveChangesAsync();

        // Act
        var updatedRank = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 50000);

        // Assert
        Assert.Equal(10, updatedRank.Rank); // Should stay at rank 10
    }

    [Fact]
    public async Task UpdateMuscleGroupVolumeAsync_VerifiesRankThresholds()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Legs;

        // Act & Assert - Test each rank threshold
        var rank1 = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 0);
        Assert.Equal(1, rank1.Rank);

        var rank2 = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 5000);
        Assert.Equal(2, rank2.Rank);

        var rank3 = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 10000);
        Assert.Equal(3, rank3.Rank);

        var rank4 = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 15000);
        Assert.Equal(4, rank4.Rank);

        var rank5 = await _service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, 20000);
        Assert.Equal(5, rank5.Rank);
    }
}
