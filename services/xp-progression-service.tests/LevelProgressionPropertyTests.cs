using FsCheck;
using FsCheck.Xunit;
using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

/// <summary>
/// Property-based tests for level progression correctness.
/// Validates: Requirements 6.2
/// 
/// Property 6: Level Progression
/// For any user, when total XP reaches or exceeds the threshold for a new level,
/// the user's level should increase by 1, and the user should not skip levels.
/// </summary>
public class LevelProgressionPropertyTests
{
    private readonly Mock<ILogger<XPProgressionServiceImpl>> _mockLogger;

    // Level thresholds (cumulative XP) - must match service implementation
    private static readonly Dictionary<int, int> LevelThresholds = new()
    {
        { 1, 0 },
        { 2, 500 },
        { 3, 1500 },
        { 4, 3000 },
        { 5, 5000 },
        { 6, 7500 },
        { 7, 10000 },
        { 8, 13000 },
        { 9, 16500 },
        { 10, 20500 }
    };

    public LevelProgressionPropertyTests()
    {
        _mockLogger = new Mock<ILogger<XPProgressionServiceImpl>>();
    }

    private XPProgressionServiceImpl CreateService(XPDbContext context)
    {
        return new XPProgressionServiceImpl(context, _mockLogger.Object);
    }

    private XPDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<XPDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new XPDbContext(options);
    }

    private int GetExpectedLevel(int totalXP)
    {
        int expectedLevel = 1;
        foreach (var threshold in LevelThresholds.OrderByDescending(x => x.Value))
        {
            if (totalXP >= threshold.Value)
            {
                expectedLevel = threshold.Key;
                break;
            }
        }
        return expectedLevel;
    }

    /// <summary>
    /// Property: Level increases when XP threshold is met
    /// For any total XP value, when that XP is assigned to a user,
    /// the user's level should correspond to the correct cumulative threshold.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelIncreases_WhenXPThresholdMet(PositiveInt totalXPGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        // Clamp XP to reasonable range (0-100,000)
        var totalXP = Math.Min(100000, totalXPGen.Item);

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = totalXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (_, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        int expectedLevel = GetExpectedLevel(totalXP);
        Assert.Equal(expectedLevel, finalLevel);
    }

    /// <summary>
    /// Property: Level does not increase before threshold
    /// For any XP value below a level threshold, the user should not reach that level.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelDoesNotIncrease_BeforeThreshold(int xpBelowThreshold)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        // Clamp to 0-499 (below level 2 threshold)
        var clampedXP = Math.Max(0, Math.Min(499, xpBelowThreshold));

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = clampedXP,
            CurrentLevel = 1,
            XPToNextLevel = 500 - clampedXP,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (leveledUp, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        Assert.False(leveledUp);
        Assert.Equal(1, finalLevel);
    }

    /// <summary>
    /// Property: Level progression is monotonic (never decreases)
    /// For any user, their level should never decrease, only stay the same or increase.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelProgression_IsMonotonic(PositiveInt initialXPGen, PositiveInt xpToAddGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        var clampedInitialXP = Math.Min(100000, initialXPGen.Item);
        var clampedXPToAdd = Math.Min(50000, xpToAddGen.Item);

        // Create user with initial XP
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = clampedInitialXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        // Get initial level
        service.ProcessLevelUpAsync(userId).Wait();
        var initialLevel = context.UserXPs.First(u => u.UserId == userId).CurrentLevel;

        // Act - Add more XP
        var resultXP = service.AddXPAsync(userId, clampedXPToAdd, "TestEvent").Result;

        // Assert
        Assert.True(resultXP.CurrentLevel >= initialLevel, 
            $"Level decreased from {initialLevel} to {resultXP.CurrentLevel}");
    }

    /// <summary>
    /// Property: XP to next level is calculated correctly
    /// For any user at a given level with given total XP,
    /// XPToNextLevel should equal (NextLevelThreshold - CurrentTotalXP).
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void XPToNextLevel_CalculatedCorrectly(PositiveInt totalXPGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        var totalXP = Math.Min(100000, totalXPGen.Item);

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = totalXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        service.ProcessLevelUpAsync(userId).Wait();
        var result = context.UserXPs.First(u => u.UserId == userId);

        // Assert
        int expectedLevel = GetExpectedLevel(totalXP);
        int nextLevelThreshold = expectedLevel < 10 
            ? LevelThresholds[expectedLevel + 1] 
            : int.MaxValue;

        int expectedXPToNextLevel = expectedLevel < 10
            ? Math.Max(0, nextLevelThreshold - totalXP)
            : 0;

        Assert.Equal(expectedXPToNextLevel, result.XPToNextLevel);
    }

    /// <summary>
    /// Property: Exactly at threshold - level increases
    /// For any level threshold, when XP equals exactly that threshold,
    /// the user should reach that level.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelIncreases_WhenExactlyAtThreshold(int levelIndex)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        // Select a random level threshold (2-10)
        var validLevels = LevelThresholds.Where(x => x.Key >= 2 && x.Key <= 10).ToList();
        if (validLevels.Count == 0) return;

        var selectedLevel = validLevels[Math.Abs(levelIndex) % validLevels.Count];
        var thresholdXP = selectedLevel.Value;

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = thresholdXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (leveledUp, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        Assert.True(leveledUp);
        Assert.Equal(selectedLevel.Key, finalLevel);
    }

    /// <summary>
    /// Property: Just below threshold - level does not increase
    /// For any level threshold, when XP is 1 point below that threshold,
    /// the user should not reach that level.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelDoesNotIncrease_WhenJustBelowThreshold(int levelIndex)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        // Select a random level threshold (2-10)
        var validLevels = LevelThresholds.Where(x => x.Key >= 2 && x.Key <= 10).ToList();
        if (validLevels.Count == 0) return;

        var selectedLevel = validLevels[Math.Abs(levelIndex) % validLevels.Count];
        var thresholdXP = selectedLevel.Value - 1;

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = thresholdXP,
            CurrentLevel = selectedLevel.Key - 1,
            XPToNextLevel = 1,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (leveledUp, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        Assert.False(leveledUp);
        Assert.Equal(selectedLevel.Key - 1, finalLevel);
    }

    /// <summary>
    /// Property: Far above threshold - level increases to correct level
    /// For any XP value far above a threshold, the user should reach the correct level
    /// without skipping levels.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelIncreases_WhenFarAboveThreshold(PositiveInt excessXPGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        // Use a large XP value (far above level 2 threshold)
        var clampedExcessXP = Math.Max(1000, Math.Min(100000, excessXPGen.Item));

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = clampedExcessXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (leveledUp, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        Assert.True(leveledUp);
        Assert.True(finalLevel > 1);

        // Verify no levels were skipped
        int expectedLevel = GetExpectedLevel(clampedExcessXP);
        Assert.Equal(expectedLevel, finalLevel);
    }

    /// <summary>
    /// Property: No level skipping
    /// For any XP value, the user should reach the correct level without skipping any levels.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void NoLevelSkipping_ForAnyXPValue(PositiveInt totalXPGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        var totalXP = Math.Min(100000, totalXPGen.Item);

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = totalXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (_, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        int expectedLevel = GetExpectedLevel(totalXP);
        Assert.Equal(expectedLevel, finalLevel);

        // Verify all intermediate levels would have been reached
        for (int level = 1; level < finalLevel; level++)
        {
            var levelThreshold = LevelThresholds[level];
            Assert.True(totalXP >= levelThreshold, 
                $"XP {totalXP} should have reached level {level} (threshold: {levelThreshold})");
        }

        // Verify the next level was not reached
        if (finalLevel < 10)
        {
            var nextLevelThreshold = LevelThresholds[finalLevel + 1];
            Assert.True(totalXP < nextLevelThreshold,
                $"XP {totalXP} should not have reached level {finalLevel + 1} (threshold: {nextLevelThreshold})");
        }
    }

    /// <summary>
    /// Property: Level caps at 10
    /// For any XP value, the user's level should never exceed 10.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void LevelCaps_AtLevel10(PositiveInt totalXPGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        var totalXP = Math.Min(1000000, totalXPGen.Item); // Very large XP

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = totalXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var (_, finalLevel) = service.ProcessLevelUpAsync(userId).Result;

        // Assert
        Assert.True(finalLevel <= 10, $"Level {finalLevel} exceeds maximum of 10");
    }

    /// <summary>
    /// Property: Cumulative thresholds are correct
    /// For each level, verify that the threshold matches the expected cumulative value.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Fact]
    public void CumulativeThresholds_AreCorrect()
    {
        // Verify the level thresholds match the specification
        // Level 1: 0 XP
        // Level 2: 500 XP
        // Level 3: 1500 XP
        // Level 4: 3000 XP
        // Level 5: 5000 XP
        // Level 6: 7500 XP
        // Level 7: 10000 XP
        // Level 8: 13000 XP
        // Level 9: 16500 XP
        // Level 10: 20500 XP

        Assert.Equal(0, LevelThresholds[1]);
        Assert.Equal(500, LevelThresholds[2]);
        Assert.Equal(1500, LevelThresholds[3]);
        Assert.Equal(3000, LevelThresholds[4]);
        Assert.Equal(5000, LevelThresholds[5]);
        Assert.Equal(7500, LevelThresholds[6]);
        Assert.Equal(10000, LevelThresholds[7]);
        Assert.Equal(13000, LevelThresholds[8]);
        Assert.Equal(16500, LevelThresholds[9]);
        Assert.Equal(20500, LevelThresholds[10]);
    }

    /// <summary>
    /// Property: Multiple level ups in sequence
    /// For any starting XP and added XP, the final level should be correct
    /// and no levels should be skipped.
    /// 
    /// **Validates: Requirements 6.2**
    /// </summary>
    [Property]
    public void MultipleLevelUps_InSequence(PositiveInt startingXPGen, PositiveInt xpToAddGen)
    {
        // Arrange
        var context = CreateDbContext();
        var service = CreateService(context);
        var userId = Guid.NewGuid();

        var clampedStartingXP = Math.Min(50000, startingXPGen.Item);
        var clampedXPToAdd = Math.Min(50000, xpToAddGen.Item);
        var totalXP = clampedStartingXP + clampedXPToAdd;

        // Act
        var userXP = new UserXP
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TotalXP = clampedStartingXP,
            CurrentLevel = 1,
            XPToNextLevel = 500,
            LastXPUpdate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.UserXPs.Add(userXP);
        context.SaveChanges();

        var result = service.AddXPAsync(userId, clampedXPToAdd, "TestEvent").Result;

        // Assert
        Assert.Equal(totalXP, result.TotalXP);

        // Verify the level is correct
        int expectedLevel = GetExpectedLevel(totalXP);
        Assert.Equal(expectedLevel, result.CurrentLevel);
    }
}
