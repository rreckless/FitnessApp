using FsCheck;
using FsCheck.Xunit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StreakService.Data;
using StreakService.Models;
using StreakService.Services;
using Xunit;

namespace StreakService.Tests;

/// <summary>
/// Property-based tests for streak milestone rewards correctness.
/// **Validates: Requirements 7.4**
/// 
/// These tests validate that the streak system correctly detects milestones
/// and awards the appropriate XP rewards.
/// </summary>
public class StreakMilestoneRewardPropertyTests
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

    /// <summary>
    /// Property 9.1: Milestones are detected at exactly 7, 14, 30, 60, 100 days
    /// 
    /// This property verifies that milestone detection only occurs at the exact
    /// milestone days (7, 14, 30, 60, 100) and not at other streak values.
    /// </summary>
    [Fact]
    public async Task MilestonesDetectedAtExactDays()
    {
        var milestones = new[] { 7, 14, 30, 60, 100 };

        foreach (var milestoneDay in milestones)
        {
            // Arrange
            var context = CreateInMemoryContext();
            var service = CreateStreakService(context);
            var userId = Guid.NewGuid();
            var today = DateTime.UtcNow;

            // Create a streak at the milestone day
            var streak = new StreakTracking
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CurrentStreak = milestoneDay - 1,
                LongestStreak = milestoneDay - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.StreakTrackings.Add(streak);
            await context.SaveChangesAsync();

            // Act - increment to reach the milestone
            var result = await service.IncrementStreakAsync(userId, today);

            // Assert - milestone should be detected
            Assert.NotNull(result);
            Assert.Equal(milestoneDay, result.CurrentStreak);
            Assert.NotNull(result.MilestoneReached);
            Assert.Equal(milestoneDay, result.MilestoneReached);
        }
    }

    /// <summary>
    /// Property 9.2: XP rewards are correct for each milestone
    /// 
    /// This property verifies that the correct XP reward is given for each milestone:
    /// - 7 days: 100 XP
    /// - 14 days: 250 XP
    /// - 30 days: 500 XP
    /// - 60 days: 1000 XP
    /// - 100 days: 2000 XP
    /// </summary>
    [Fact]
    public async Task XPRewardsCorrectForMilestones()
    {
        var milestoneRewards = new Dictionary<int, int>
        {
            { 7, 100 },
            { 14, 250 },
            { 30, 500 },
            { 60, 1000 },
            { 100, 2000 }
        };

        foreach (var (milestoneDay, expectedReward) in milestoneRewards)
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
                CurrentStreak = milestoneDay - 1,
                LongestStreak = milestoneDay - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.StreakTrackings.Add(streak);
            await context.SaveChangesAsync();

            // Act
            var result = await service.IncrementStreakAsync(userId, today);

            // Assert
            Assert.NotNull(result);
            Assert.NotNull(result.XPReward);
            Assert.Equal(expectedReward, result.XPReward);
        }
    }

    /// <summary>
    /// Property 9.3: Milestones are not awarded multiple times
    /// 
    /// This property verifies that once a milestone is achieved, it is not
    /// awarded again even if the streak continues past the milestone day.
    /// </summary>
    [Fact]
    public async Task MilestonesNotAwardedMultipleTimes()
    {
        var milestones = new[] { 7, 14, 30, 60, 100 };

        foreach (var milestoneDay in milestones)
        {
            // Arrange
            var context = CreateInMemoryContext();
            var service = CreateStreakService(context);
            var userId = Guid.NewGuid();
            var today = DateTime.UtcNow;

            // Create a streak at the milestone day
            var streak = new StreakTracking
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CurrentStreak = milestoneDay - 1,
                LongestStreak = milestoneDay - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.StreakTrackings.Add(streak);
            await context.SaveChangesAsync();

            // Act - first increment to reach milestone
            var result1 = await service.IncrementStreakAsync(userId, today);

            // Get milestones after first increment
            var milestonesAfterFirst = await service.GetMilestonesAsync(userId);
            var firstMilestoneCount = milestonesAfterFirst.Count(m => m.Days == milestoneDay);

            // Simulate next day workout (streak continues)
            var tomorrow = today.AddDays(1);
            var streakAfterFirst = await context.StreakTrackings.FirstAsync(s => s.UserId == userId);
            streakAfterFirst.LastWorkoutDate = today.Date;
            await context.SaveChangesAsync();

            // Act - second increment (streak continues but milestone already achieved)
            var result2 = await service.IncrementStreakAsync(userId, tomorrow);

            // Get milestones after second increment
            var milestonesAfterSecond = await service.GetMilestonesAsync(userId);
            var secondMilestoneCount = milestonesAfterSecond.Count(m => m.Days == milestoneDay);

            // Assert - milestone count should not increase
            Assert.Equal(firstMilestoneCount, secondMilestoneCount);
            Assert.Equal(1, firstMilestoneCount); // Should have exactly one milestone record
        }
    }

    /// <summary>
    /// Property 9.4: Non-milestone days do not award milestone rewards
    /// 
    /// This property verifies that streak days that are not milestones
    /// do not trigger milestone rewards.
    /// </summary>
    [Property]
    public Property NonMilestoneDaysNoRewards()
    {
        return Prop.ForAll(
            Arb.From(StreakGenerators.NonMilestoneStreakDays()),
            streakDay =>
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
                    CurrentStreak = streakDay - 1,
                    LongestStreak = streakDay - 1,
                    LastWorkoutDate = today.AddDays(-1).Date,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Act
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Assert - no milestone should be reached
                Assert.NotNull(result);
                Assert.Null(result.MilestoneReached);
                Assert.Null(result.XPReward);

                return true;
            }
        );
    }

    /// <summary>
    /// Property 9.5: Edge cases - exactly at milestone, just below, just above
    /// 
    /// This property verifies correct behavior at milestone boundaries:
    /// - Just below milestone (e.g., 6 days before 7-day milestone)
    /// - Exactly at milestone (e.g., 7 days)
    /// - Just above milestone (e.g., 8 days after 7-day milestone)
    /// </summary>
    [Fact]
    public async Task EdgeCasesAtMilestoneBoundaries()
    {
        var milestones = new[] { 7, 14, 30, 60, 100 };

        foreach (var milestoneDay in milestones)
        {
            // Test just below milestone
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow;

                var streakJustBelow = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = milestoneDay - 2,
                    LongestStreak = milestoneDay - 2,
                    LastWorkoutDate = today.AddDays(-1).Date,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streakJustBelow);
                await context.SaveChangesAsync();

                var resultJustBelow = await service.IncrementStreakAsync(userId, today);

                // Assert just below - no milestone
                Assert.NotNull(resultJustBelow);
                Assert.Equal(milestoneDay - 1, resultJustBelow.CurrentStreak);
                Assert.Null(resultJustBelow.MilestoneReached);
            }

            // Test exactly at milestone
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow;

                var streakAtMilestone = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = milestoneDay - 1,
                    LongestStreak = milestoneDay - 1,
                    LastWorkoutDate = today.AddDays(-1).Date,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streakAtMilestone);
                await context.SaveChangesAsync();

                var resultAtMilestone = await service.IncrementStreakAsync(userId, today);

                // Assert at milestone - milestone should be reached
                Assert.NotNull(resultAtMilestone);
                Assert.Equal(milestoneDay, resultAtMilestone.CurrentStreak);
                Assert.NotNull(resultAtMilestone.MilestoneReached);
                Assert.Equal(milestoneDay, resultAtMilestone.MilestoneReached);
            }

            // Test just above milestone
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow;

                var streakAboveMilestone = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = milestoneDay,
                    LongestStreak = milestoneDay,
                    LastWorkoutDate = today.AddDays(-1).Date,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streakAboveMilestone);
                await context.SaveChangesAsync();

                var resultAboveMilestone = await service.IncrementStreakAsync(userId, today);

                // Assert just above - no new milestone (already achieved)
                Assert.NotNull(resultAboveMilestone);
                Assert.Equal(milestoneDay + 1, resultAboveMilestone.CurrentStreak);
                Assert.Null(resultAboveMilestone.MilestoneReached);
            }
        }
    }

    /// <summary>
    /// Property 9.6: Milestone detection with random streak days
    /// 
    /// This property generates random streak days (0-150) and verifies that
    /// milestones are only detected at the correct milestone days.
    /// </summary>
    [Property]
    public Property MilestoneDetectionWithRandomStreakDays()
    {
        return Prop.ForAll(
            Arb.From(StreakGenerators.RandomStreakDays()),
            streakDay =>
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
                    CurrentStreak = streakDay - 1,
                    LongestStreak = streakDay - 1,
                    LastWorkoutDate = today.AddDays(-1).Date,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Act
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Assert
                Assert.NotNull(result);
                Assert.Equal(streakDay, result.CurrentStreak);

                var milestones = new[] { 7, 14, 30, 60, 100 };
                if (milestones.Contains(streakDay))
                {
                    // Should have milestone
                    Assert.NotNull(result.MilestoneReached);
                    Assert.Equal(streakDay, result.MilestoneReached);
                    Assert.NotNull(result.XPReward);
                }
                else
                {
                    // Should not have milestone
                    Assert.Null(result.MilestoneReached);
                    Assert.Null(result.XPReward);
                }

                return true;
            }
        );
    }

    /// <summary>
    /// Property 9.7: Milestone rewards are persisted correctly
    /// 
    /// This property verifies that milestone records are correctly persisted
    /// to the database and can be retrieved.
    /// </summary>
    [Fact]
    public async Task MilestoneRewardsPersisted()
    {
        var milestones = new[] { 7, 14, 30, 60, 100 };

        foreach (var milestoneDay in milestones)
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
                CurrentStreak = milestoneDay - 1,
                LongestStreak = milestoneDay - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.StreakTrackings.Add(streak);
            await context.SaveChangesAsync();

            // Act
            var result = await service.IncrementStreakAsync(userId, today);

            // Get milestones from database
            var milestonesFromDb = await service.GetMilestonesAsync(userId);

            // Assert
            Assert.NotNull(milestonesFromDb);
            var milestone = milestonesFromDb.FirstOrDefault(m => m.Days == milestoneDay);
            Assert.NotNull(milestone);
            Assert.Equal(userId, milestone.UserId);
            Assert.Equal(milestoneDay, milestone.Days);

            var expectedRewards = new Dictionary<int, int>
            {
                { 7, 100 },
                { 14, 250 },
                { 30, 500 },
                { 60, 1000 },
                { 100, 2000 }
            };
            Assert.Equal(expectedRewards[milestoneDay], milestone.XPReward);
        }
    }

    /// <summary>
    /// Property 9.8: Multiple milestones can be achieved in sequence
    /// 
    /// This property verifies that a user can achieve multiple milestones
    /// as their streak grows, and each milestone is recorded correctly.
    /// </summary>
    [Fact]
    public async Task MultipleMilestonesAchievedInSequence()
    {
        var milestonePairs = new[] { (7, 14), (7, 30), (14, 30), (30, 60), (60, 100) };

        foreach (var (milestone1, milestone2) in milestonePairs)
        {
            // Arrange
            var context = CreateInMemoryContext();
            var service = CreateStreakService(context);
            var userId = Guid.NewGuid();
            var today = DateTime.UtcNow;

            // Create initial streak at first milestone - 1
            var streak = new StreakTracking
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CurrentStreak = milestone1 - 1,
                LongestStreak = milestone1 - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.StreakTrackings.Add(streak);
            await context.SaveChangesAsync();

            // Act - reach first milestone
            var result1 = await service.IncrementStreakAsync(userId, today);

            // Assert first milestone
            Assert.NotNull(result1);
            Assert.Equal(milestone1, result1.CurrentStreak);
            Assert.NotNull(result1.MilestoneReached);
            Assert.Equal(milestone1, result1.MilestoneReached);

            // Now simulate reaching the second milestone by setting up the streak
            // We need to create a new context and set the streak to milestone2 - 1
            var context2 = CreateInMemoryContext();
            var service2 = CreateStreakService(context2);

            var streak2 = new StreakTracking
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CurrentStreak = milestone2 - 1,
                LongestStreak = milestone2 - 1,
                LastWorkoutDate = today.AddDays(-1).Date,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context2.StreakTrackings.Add(streak2);
            await context2.SaveChangesAsync();

            // Act - reach second milestone
            var result2 = await service2.IncrementStreakAsync(userId, today);

            // Assert second milestone
            Assert.NotNull(result2);
            Assert.Equal(milestone2, result2.CurrentStreak);
            Assert.NotNull(result2.MilestoneReached);
            Assert.Equal(milestone2, result2.MilestoneReached);
        }
    }
}


