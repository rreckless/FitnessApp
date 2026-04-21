using Microsoft.EntityFrameworkCore;
using StreakTrackingService.Data;
using StreakTrackingService.Models;
using FitQuest.EventBus.Abstractions;
using FitQuest.EventBus.Events;

namespace StreakTrackingService.Services;

public class StreakServiceImpl : IStreakService
{
    private readonly StreakDbContext _dbContext;
    private readonly IEventBus _eventBus;
    private readonly ILogger<StreakServiceImpl> _logger;

    private static readonly int[] MilestoneThresholds = { 7, 14, 30, 60, 100 };
    private static readonly int[] MilestoneRewards = { 50, 100, 250, 500, 1000 }; // XP rewards

    public StreakServiceImpl(
        StreakDbContext dbContext,
        IEventBus eventBus,
        ILogger<StreakServiceImpl> logger)
    {
        _dbContext = dbContext;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<StreakInfo> GetStreakAsync(Guid userId)
    {
        try
        {
            var streak = await _dbContext.UserStreaks.FirstOrDefaultAsync(s => s.UserId == userId);

            if (streak == null)
            {
                // Create new streak record
                streak = new UserStreak
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = 0,
                    LongestStreak = 0,
                    LastWorkoutDate = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.UserStreaks.Add(streak);
                await _dbContext.SaveChangesAsync();
            }

            return new StreakInfo(
                streak.CurrentStreak,
                streak.LongestStreak,
                streak.LastWorkoutDate,
                GetNextMilestone(streak.CurrentStreak)
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting streak for user {UserId}", userId);
            throw;
        }
    }

    public async Task<StreakUpdateResult> UpdateStreakAsync(Guid userId, Guid workoutId)
    {
        try
        {
            var streak = await _dbContext.UserStreaks.FirstOrDefaultAsync(s => s.UserId == userId);

            if (streak == null)
            {
                streak = new UserStreak
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CurrentStreak = 0,
                    LongestStreak = 0,
                    LastWorkoutDate = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.UserStreaks.Add(streak);
            }

            var today = DateTime.UtcNow.Date;
            var lastWorkoutDate = streak.LastWorkoutDate?.Date;

            // Check if workout is today (already counted)
            if (lastWorkoutDate == today)
            {
                _logger.LogInformation("Workout already counted for today for user {UserId}", userId);
                return new StreakUpdateResult(streak.CurrentStreak, false, null);
            }

            // Check if streak should continue or reset
            if (lastWorkoutDate == today.AddDays(-1))
            {
                // Consecutive day - increment streak
                streak.CurrentStreak++;
            }
            else if (lastWorkoutDate == null || lastWorkoutDate < today.AddDays(-1))
            {
                // Streak broken or first workout - reset to 1
                streak.CurrentStreak = 1;
            }

            // Update longest streak
            if (streak.CurrentStreak > streak.LongestStreak)
            {
                streak.LongestStreak = streak.CurrentStreak;
            }

            streak.LastWorkoutDate = DateTime.UtcNow;
            streak.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            // Check for milestone
            var milestone = CheckMilestone(streak.CurrentStreak);
            if (milestone.HasValue)
            {
                _logger.LogInformation("Streak milestone reached: {Milestone} days for user {UserId}",
                    milestone.Value, userId);

                // Publish event
                var milestoneIndex = Array.IndexOf(MilestoneThresholds, milestone.Value);
                var xpReward = MilestoneRewards[milestoneIndex];

                var streakEvent = new StreakMilestoneEvent
                {
                    UserId = userId,
                    MilestoneDays = milestone.Value,
                    XpReward = xpReward,
                    Timestamp = DateTime.UtcNow
                };

                await _eventBus.PublishAsync(streakEvent);
            }

            _logger.LogInformation("Updated streak for user {UserId}: current={Current}, longest={Longest}",
                userId, streak.CurrentStreak, streak.LongestStreak);

            return new StreakUpdateResult(streak.CurrentStreak, true, milestone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating streak for user {UserId}", userId);
            throw;
        }
    }

    public async Task<List<StreakMilestoneRecord>> GetMilestonesAsync(Guid userId)
    {
        try
        {
            var milestones = await _dbContext.StreakMilestones
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.AchievedAt)
                .ToListAsync();

            return milestones.Select(m => new StreakMilestoneRecord(
                m.Days,
                m.XpReward,
                m.AchievedAt
            )).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting milestones for user {UserId}", userId);
            throw;
        }
    }

    public async Task<bool> ResetStreakAsync(Guid userId)
    {
        try
        {
            var streak = await _dbContext.UserStreaks.FirstOrDefaultAsync(s => s.UserId == userId);

            if (streak == null)
                return false;

            streak.CurrentStreak = 0;
            streak.LastWorkoutDate = null;
            streak.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Reset streak for user {UserId}", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting streak for user {UserId}", userId);
            throw;
        }
    }

    private int? CheckMilestone(int currentStreak)
    {
        return MilestoneThresholds.FirstOrDefault(t => t == currentStreak);
    }

    private int? GetNextMilestone(int currentStreak)
    {
        return MilestoneThresholds.FirstOrDefault(t => t > currentStreak);
    }
}
