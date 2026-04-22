using Xunit;
using FsCheck;
using FsCheck.Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

/// <summary>
/// Property-Based Tests for Muscle Group Rank Tracking
/// **Validates: Requirements 6.4, 6.5**
/// 
/// These tests validate that the muscle group rank system correctly implements
/// the volume-based threshold logic for all muscle groups.
/// </summary>
public class MuscleGroupRankPropertyTests
{
    private readonly Mock<ILogger<MuscleGroupRankService>> _mockLogger;

    public MuscleGroupRankPropertyTests()
    {
        _mockLogger = new Mock<ILogger<MuscleGroupRankService>>();
    }

    private XPDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<XPDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new XPDbContext(options);
    }

    /// <summary>
    /// Property 1: Rank increases when volume threshold is met
    /// Tests that when a user's total volume reaches or exceeds a rank threshold,
    /// their rank increases to the corresponding rank level.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_RankIncreasesWhenThresholdMet(int volumeAdded)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Chest;
        
        // Constrain volume to valid range (0-500000 lbs)
        var validVolume = Math.Abs(volumeAdded) % 500000;
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Verify rank is correct for the volume
        int expectedRank = GetExpectedRank(validVolume);
        return rank.Rank == expectedRank;
    }

    /// <summary>
    /// Property 2: Rank does not increase before threshold
    /// Tests that rank remains at current level when volume is below the next threshold.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_RankDoesNotIncreaseBeforeThreshold(int volumeBeforeThreshold)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Back;
        
        // Constrain volume to be just below rank 2 threshold (5000)
        var validVolume = (Math.Abs(volumeBeforeThreshold) % 4999) + 1; // 1-4999
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Should remain at rank 1
        return rank.Rank == 1 && rank.TotalVolume == validVolume;
    }

    /// <summary>
    /// Property 3: Rank progression is monotonic (never decreases)
    /// Tests that rank never decreases when volume is added.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_RankProgressionIsMonotonic(int volume1, int volume2)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Shoulders;
        
        var v1 = Math.Abs(volume1) % 250000;
        var v2 = Math.Abs(volume2) % 250000;
        
        // Act
        var task1 = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, v1);
        var rank1 = task1.Result;
        
        var task2 = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, v2);
        var rank2 = task2.Result;
        
        // Assert - Rank should never decrease
        return rank2.Rank >= rank1.Rank;
    }

    /// <summary>
    /// Property 4: Volume to next rank is calculated correctly
    /// Tests that the volume needed to reach the next rank is accurate.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_VolumeToNextRankIsCorrect(int currentVolume)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Arms;
        
        var validVolume = Math.Abs(currentVolume) % 225000;
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Calculate expected volume to next rank
        int nextRankThreshold = GetNextRankThreshold(rank.Rank);
        int volumeToNextRank = nextRankThreshold - rank.TotalVolume;
        
        // Volume to next rank should be non-negative
        return volumeToNextRank >= 0;
    }

    /// <summary>
    /// Property 5: Edge case - exactly at threshold
    /// Tests that rank increases when volume is exactly at the threshold.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_ExactlyAtThreshold_RanksUp(int rankLevel)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Legs;
        
        // Constrain rank level to 1-9 (can rank up to 2-10)
        var validRank = (Math.Abs(rankLevel) % 9) + 1;
        int thresholdVolume = GetRankThreshold(validRank);
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, thresholdVolume);
        var rank = task.Result;
        
        // Assert - Should be at the expected rank
        return rank.Rank == validRank && rank.TotalVolume == thresholdVolume;
    }

    /// <summary>
    /// Property 6: Edge case - just below threshold
    /// Tests that rank does not increase when volume is just below the threshold.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_JustBelowThreshold_DoesNotRankUp(int rankLevel)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Core;
        
        // Constrain rank level to 1-9
        var validRank = (Math.Abs(rankLevel) % 9) + 1;
        int thresholdVolume = GetRankThreshold(validRank);
        int volumeJustBelow = Math.Max(0, thresholdVolume - 1);
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, volumeJustBelow);
        var rank = task.Result;
        
        // Assert - Should be at rank below the threshold
        int expectedRank = GetExpectedRank(volumeJustBelow);
        return rank.Rank == expectedRank && rank.TotalVolume == volumeJustBelow;
    }

    /// <summary>
    /// Property 7: Edge case - far above threshold
    /// Tests that rank progression works correctly when volume is far above threshold.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_FarAboveThreshold_RanksUpCorrectly(int rankLevel)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Chest;
        
        // Constrain rank level to 1-9
        var validRank = (Math.Abs(rankLevel) % 9) + 1;
        int thresholdVolume = GetRankThreshold(validRank);
        int volumeFarAbove = thresholdVolume + 50000; // 50k above threshold
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, volumeFarAbove);
        var rank = task.Result;
        
        // Assert - Should be at the correct rank for the volume
        int expectedRank = GetExpectedRank(volumeFarAbove);
        return rank.Rank == expectedRank && rank.TotalVolume == volumeFarAbove;
    }

    /// <summary>
    /// Property 8: All muscle groups are supported
    /// Tests that rank tracking works for all muscle groups.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_AllMuscleGroupsSupported(int volumeAdded)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var validVolume = Math.Abs(volumeAdded) % 100000;
        
        // Act & Assert - Test all muscle groups
        foreach (MuscleGroup muscleGroup in Enum.GetValues(typeof(MuscleGroup)))
        {
            var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
            var rank = task.Result;
            
            if (rank.MuscleGroup != muscleGroup || rank.UserId != userId)
                return false;
        }
        
        return true;
    }

    /// <summary>
    /// Property 9: Multiple rank ups in single update
    /// Tests that multiple rank ups can occur in a single volume update.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_MultipleRankUpsInSingleUpdate(int largeVolume)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Back;
        
        // Use a large volume that could trigger multiple rank ups
        var validVolume = (Math.Abs(largeVolume) % 200000) + 30000; // 30k-230k
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Rank should be correct for the volume
        int expectedRank = GetExpectedRank(validVolume);
        return rank.Rank == expectedRank && rank.TotalVolume == validVolume;
    }

    /// <summary>
    /// Property 10: Rank capped at 10
    /// Tests that rank never exceeds 10 regardless of volume.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_RankCappedAt10(int hugeVolume)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Shoulders;
        
        // Use a very large volume
        var validVolume = (Math.Abs(hugeVolume) % 1000000) + 225000; // 225k+
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Rank should never exceed 10
        return rank.Rank <= 10;
    }

    /// <summary>
    /// Property 11: Cumulative volume tracking
    /// Tests that total volume accumulates correctly across multiple updates.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_CumulativeVolumeTracking(int volume1, int volume2, int volume3)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Arms;
        
        var v1 = Math.Abs(volume1) % 100000;
        var v2 = Math.Abs(volume2) % 100000;
        var v3 = Math.Abs(volume3) % 100000;
        
        // Act
        var task1 = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, v1);
        var rank1 = task1.Result;
        
        var task2 = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, v2);
        var rank2 = task2.Result;
        
        var task3 = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, v3);
        var rank3 = task3.Result;
        
        // Assert - Total volume should be sum of all additions
        int expectedTotal = v1 + v2 + v3;
        return rank3.TotalVolume == expectedTotal;
    }

    /// <summary>
    /// Property 12: Rank progression follows threshold formula
    /// Tests that rank progression strictly follows the defined thresholds.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_FollowsThresholdFormula(int volume)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Legs;
        
        var validVolume = Math.Abs(volume) % 500000;
        
        // Act
        var task = service.UpdateMuscleGroupVolumeAsync(userId, muscleGroup, validVolume);
        var rank = task.Result;
        
        // Assert - Verify rank matches threshold formula
        int expectedRank = GetExpectedRank(validVolume);
        int nextThreshold = GetNextRankThreshold(rank.Rank);
        
        // Current rank should have volume >= its threshold
        // and volume < next rank's threshold
        int currentThreshold = GetRankThreshold(rank.Rank);
        return rank.Rank == expectedRank && 
               validVolume >= currentThreshold && 
               validVolume < nextThreshold;
    }

    /// <summary>
    /// Property 13: Independent muscle group tracking
    /// Tests that muscle group ranks are tracked independently per user.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_IndependentPerMuscleGroup(int chestVolume, int backVolume)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId = Guid.NewGuid();
        
        var v1 = Math.Abs(chestVolume) % 100000;
        var v2 = Math.Abs(backVolume) % 100000;
        
        // Act
        var task1 = service.UpdateMuscleGroupVolumeAsync(userId, MuscleGroup.Chest, v1);
        var chestRank = task1.Result;
        
        var task2 = service.UpdateMuscleGroupVolumeAsync(userId, MuscleGroup.Back, v2);
        var backRank = task2.Result;
        
        // Assert - Each muscle group should have independent volume and rank
        return chestRank.TotalVolume == v1 && 
               backRank.TotalVolume == v2 &&
               chestRank.MuscleGroup == MuscleGroup.Chest &&
               backRank.MuscleGroup == MuscleGroup.Back;
    }

    /// <summary>
    /// Property 14: User isolation
    /// Tests that muscle group ranks are tracked independently per user.
    /// </summary>
    [Property]
    public bool MuscleGroupRank_IsolatedPerUser(int volume1, int volume2)
    {
        // Arrange
        var context = CreateInMemoryContext();
        var service = new MuscleGroupRankService(context, _mockLogger.Object);
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var muscleGroup = MuscleGroup.Core;
        
        var v1 = Math.Abs(volume1) % 100000;
        var v2 = Math.Abs(volume2) % 100000;
        
        // Act
        var task1 = service.UpdateMuscleGroupVolumeAsync(userId1, muscleGroup, v1);
        var rank1 = task1.Result;
        
        var task2 = service.UpdateMuscleGroupVolumeAsync(userId2, muscleGroup, v2);
        var rank2 = task2.Result;
        
        // Assert - Each user should have independent ranks
        return rank1.UserId == userId1 && 
               rank2.UserId == userId2 &&
               rank1.TotalVolume == v1 &&
               rank2.TotalVolume == v2;
    }

    // Helper methods for threshold calculations
    private static readonly Dictionary<int, int> RankThresholds = new()
    {
        { 1, 0 },
        { 2, 5000 },
        { 3, 15000 },
        { 4, 30000 },
        { 5, 50000 },
        { 6, 75000 },
        { 7, 105000 },
        { 8, 140000 },
        { 9, 180000 },
        { 10, 225000 }
    };

    private static int GetRankThreshold(int rank)
    {
        return RankThresholds.TryGetValue(rank, out var threshold) ? threshold : 0;
    }

    private static int GetNextRankThreshold(int currentRank)
    {
        int nextRank = currentRank + 1;
        return RankThresholds.TryGetValue(nextRank, out var threshold) ? threshold : int.MaxValue;
    }

    private static int GetExpectedRank(int volume)
    {
        for (int rank = 10; rank >= 1; rank--)
        {
            if (volume >= GetRankThreshold(rank))
            {
                return rank;
            }
        }
        return 1;
    }
}
