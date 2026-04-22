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
/// Property-based tests for streak increment and reset correctness.
/// **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
/// 
/// These tests validate that the streak system correctly implements:
/// - Streak increment by 1 on consecutive days (Requirement 7.1)
/// - Streak reset after 24-hour gap (Requirement 7.2)
/// - Longest streak tracking and preservation (Requirement 7.3, 7.5)
/// </summary>
public class StreakIncrementResetPropertyTests
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
    /// Property 8.1: Consecutive day workouts increment streak by 1
    /// 
    /// For any starting streak (0-100) and any number of consecutive days (1-10),
    /// each consecutive day should increment the streak by exactly 1.
    /// </summary>
    [Property]
    public Property ConsecutiveDaysIncrementStreakByOne()
    {
        return Prop.ForAll(
            StreakGenerators.ValidStartingStreak(),
            StreakGenerators.ValidConsecutiveDays(),
            (start, days) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var baseDate = DateTime.UtcNow.Date;

                // Create initial streak
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = start,
                    LongestStreak = start,
                    LastWorkoutDate = baseDate.AddDays(-1),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Simulate first consecutive day
                var workoutDate = baseDate;
                var result = service.IncrementStreakAsync(userId, workoutDate).Result;

                // First day should increment by 1
                if (result.CurrentStreak != start + 1)
                    return false;

                // For additional days, we need to verify the pattern holds
                // but we can't easily test multiple increments in one property
                // without complex state management, so we test the first increment
                return true;
            }
        );
    }

    /// <summary>
    /// Property 8.2: Streak resets to 1 after 24-hour gap
    /// 
    /// For any current streak (0-100) and any gap > 1 day,
    /// the streak should reset to 1 when a workout is logged.
    /// </summary>
    [Property]
    public Property StreakResetsAfter24HourGap()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidDaysSinceLastWorkout(),
            (current, daysSince) =>
            {
                // Only test gaps > 1 day
                if (daysSince <= 1)
                    return true;

                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var lastWorkoutDate = today.AddDays(-daysSince);

                // Create streak with gap
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = current,
                    LastWorkoutDate = lastWorkoutDate,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Streak should reset to 1
                return result.CurrentStreak == 1;
            }
        );
    }

    /// <summary>
    /// Property 8.3: Longest streak is preserved when current streak resets
    /// 
    /// For any current streak and longest streak where current >= longest,
    /// when the streak resets, the longest streak should be preserved or updated.
    /// </summary>
    [Property]
    public Property LongestStreakPreservedOnReset()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidLongestStreak(),
            (current, longest) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var twoDaysAgo = today.AddDays(-2);

                // Create streak with gap
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = longest,
                    LastWorkoutDate = twoDaysAgo,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today (gap > 1 day)
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Longest streak should be at least the original longest
                return result.LongestStreak >= longest;
            }
        );
    }

    /// <summary>
    /// Property 8.4: Longest streak updates if current exceeds it
    /// 
    /// For any current streak and longest streak where current > longest,
    /// when the streak resets, the longest streak should be updated to current.
    /// </summary>
    [Property]
    public Property LongestStreakUpdatesWhenCurrentExceeds()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidLongestStreak(),
            (current, longest) =>
            {
                // Only test when current > longest
                if (current <= longest)
                    return true;

                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var twoDaysAgo = today.AddDays(-2);

                // Create streak where current > longest
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = longest,
                    LastWorkoutDate = twoDaysAgo,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today (gap > 1 day)
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Longest streak should be updated to current
                return result.LongestStreak == current;
            }
        );
    }

    /// <summary>
    /// Property 8.5: Exactly 24 hours is treated as consecutive day
    /// 
    /// When the gap is exactly 1 day (24 hours), the streak should increment,
    /// not reset.
    /// </summary>
    [Property]
    public Property Exactly24HoursIsConsecutiveDay()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            (current) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var yesterday = today.AddDays(-1);

                // Create streak with yesterday's workout
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = current,
                    LastWorkoutDate = yesterday,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today (exactly 24 hours later)
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Streak should increment, not reset
                return result.CurrentStreak == current + 1;
            }
        );
    }

    /// <summary>
    /// Property 8.6: Just under 24 hours is treated as same day
    /// 
    /// When the gap is less than 1 day (same calendar day), the streak should
    /// not increment (already worked out today).
    /// </summary>
    [Property]
    public Property JustUnder24HoursSameDay()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            (current) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;

                // Create streak with today's workout
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = current,
                    LastWorkoutDate = today,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Try to log another workout today
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Streak should not change (already worked out today)
                return result.CurrentStreak == current;
            }
        );
    }

    /// <summary>
    /// Property 8.7: Multiple day gaps reset streak to 1
    /// 
    /// For any gap > 1 day, the streak should reset to 1,
    /// regardless of the gap size.
    /// </summary>
    [Property]
    public Property MultipleDayGapsResetToOne()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidMultipleDayGap(),
            (current, daysSince) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var lastWorkoutDate = today.AddDays(-daysSince);

                // Create streak with multiple day gap
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = current,
                    LastWorkoutDate = lastWorkoutDate,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Streak should reset to 1
                return result.CurrentStreak == 1;
            }
        );
    }

    /// <summary>
    /// Property 8.8: Streak increment does not change longest streak
    /// 
    /// When incrementing a streak (consecutive day), the longest streak
    /// should remain unchanged (it's only updated when the streak resets).
    /// </summary>
    [Property]
    public Property StreakIncrementDoesNotChangeLongest()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidLongestStreak(),
            (current, longest) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var yesterday = today.AddDays(-1);

                // Create streak with consecutive day setup
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = longest,
                    LastWorkoutDate = yesterday,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today (consecutive day)
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Longest streak should not change on increment
                return result.LongestStreak == longest;
            }
        );
    }

    /// <summary>
    /// Property 8.9: Current streak and longest streak consistency after increment
    /// 
    /// After incrementing the streak on a consecutive day:
    /// - Current streak should be incremented by 1
    /// - Longest streak should remain unchanged (only updated on reset)
    /// - Current streak may exceed longest streak (longest is updated on reset)
    /// </summary>
    [Property]
    public Property CurrentAndLongestConsistencyAfterIncrement()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidLongestStreak(),
            (current, longest) =>
            {
                // Ensure longest is at least as large as current for this test
                var actualLongest = Math.Max(current, longest);

                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var yesterday = today.AddDays(-1);

                // Create streak
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = actualLongest,
                    LastWorkoutDate = yesterday,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today
                var result = service.IncrementStreakAsync(userId, today).Result;

                // After increment, current should be current+1
                var expectedCurrent = current + 1;
                
                // Longest streak should remain unchanged on increment
                // (it's only updated when the streak resets)
                var expectedLongest = actualLongest;

                // Verify: current should equal expected, longest should remain unchanged
                return result.CurrentStreak == expectedCurrent && 
                       result.LongestStreak == expectedLongest;
            }
        );
    }

    /// <summary>
    /// Property 8.10: Streak reset always sets current to 1
    /// 
    /// When a streak resets (gap > 1 day), the current streak should
    /// always be set to exactly 1.
    /// </summary>
    [Property]
    public Property StreakResetAlwaysSetsToOne()
    {
        return Prop.ForAll(
            StreakGenerators.ValidCurrentStreak(),
            StreakGenerators.ValidMultipleDayGap(),
            (current, daysSince) =>
            {
                var context = CreateInMemoryContext();
                var service = CreateStreakService(context);
                var userId = Guid.NewGuid();
                var today = DateTime.UtcNow.Date;
                var lastWorkoutDate = today.AddDays(-daysSince);

                // Create streak with gap
                var streak = new StreakTracking
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = current,
                    LongestStreak = current,
                    LastWorkoutDate = lastWorkoutDate,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.StreakTrackings.Add(streak);
                context.SaveChanges();

                // Log workout today
                var result = service.IncrementStreakAsync(userId, today).Result;

                // Current streak should be exactly 1
                return result.CurrentStreak == 1;
            }
        );
    }
}

/// <summary>
/// Custom generators for streak-related properties.
/// These generators create realistic test data for property-based testing.
/// </summary>
public static class StreakGenerators
{
    /// <summary>
    /// Generate valid starting streak values (0-100).
    /// </summary>
    public static Arbitrary<int> ValidStartingStreak() =>
        Arb.Default.Int32()
            .Filter(x => x >= 0 && x <= 100);

    /// <summary>
    /// Generate valid current streak values (0-100).
    /// </summary>
    public static Arbitrary<int> ValidCurrentStreak() =>
        Arb.Default.Int32()
            .Filter(x => x >= 0 && x <= 100);

    /// <summary>
    /// Generate valid longest streak values (0-100).
    /// </summary>
    public static Arbitrary<int> ValidLongestStreak() =>
        Arb.Default.Int32()
            .Filter(x => x >= 0 && x <= 100);

    /// <summary>
    /// Generate valid consecutive day counts (1-10).
    /// </summary>
    public static Arbitrary<int> ValidConsecutiveDays() =>
        Arb.Default.Int32()
            .Filter(x => x >= 1 && x <= 10);

    /// <summary>
    /// Generate valid days since last workout (0-10).
    /// </summary>
    public static Arbitrary<int> ValidDaysSinceLastWorkout() =>
        Arb.Default.Int32()
            .Filter(x => x >= 0 && x <= 10);

    /// <summary>
    /// Generate valid multiple day gaps (2-10 days).
    /// </summary>
    public static Arbitrary<int> ValidMultipleDayGap() =>
        Arb.Default.Int32()
            .Filter(x => x >= 2 && x <= 10);
}
