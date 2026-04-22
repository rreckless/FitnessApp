using Microsoft.EntityFrameworkCore;
using StreakService.Data;
using StreakService.Models;

namespace StreakService.Services;

public class StreakServiceImpl : IStreakService
{
    private readonly StreakDbContext _context;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<StreakServiceImpl> _logger;

    // Milestone configuration: days -> XP reward
    private static readonly Dictionary<int, int> MilestoneRewards = new()
    {
        { 7, 100 },
        { 14, 250 },
        { 30, 500 },
        { 60, 1000 },
        { 100, 2000 }
    };

    public StreakServiceImpl(StreakDbContext context, IRabbitMQPublisher publisher, ILogger<StreakServiceImpl> logger)
    {
        _context = context;
        _publisher = publisher;
        _logger = logger;
    }

    public async Task<StreakResponse> IncrementStreakAsync(Guid userId, DateTime workoutDate)
    {
        try
        {
            var streak = await GetOrCreateStreakAsync(userId);
            var today = DateTime.UtcNow.Date;
            var workoutDateOnly = workoutDate.Date;

            // Check if workout is from today
            if (workoutDateOnly != today)
            {
                _logger.LogWarning($"Workout date {workoutDateOnly} is not today {today}");
                return MapToResponse(streak, null, null);
            }

            // Check if already worked out today
            if (streak.LastWorkoutDate.Date == today)
            {
                _logger.LogInformation($"User {userId} already worked out today");
                return MapToResponse(streak, null, null);
            }

            var daysSinceLastWorkout = (today - streak.LastWorkoutDate.Date).Days;

            if (daysSinceLastWorkout == 1)
            {
                // Consecutive day - increment streak
                streak.CurrentStreak += 1;
                _logger.LogInformation($"User {userId} streak incremented to {streak.CurrentStreak}");
            }
            else if (daysSinceLastWorkout > 1)
            {
                // Streak broken - preserve longest and reset
                streak.LongestStreak = Math.Max(streak.LongestStreak, streak.CurrentStreak);
                streak.CurrentStreak = 1;
                _logger.LogInformation($"User {userId} streak reset. Longest streak: {streak.LongestStreak}");
            }

            streak.LastWorkoutDate = today;
            streak.UpdatedAt = DateTime.UtcNow;

            // Check for milestone
            int? milestoneReached = null;
            int? xpReward = null;

            if (MilestoneRewards.ContainsKey(streak.CurrentStreak))
            {
                milestoneReached = streak.CurrentStreak;
                xpReward = MilestoneRewards[streak.CurrentStreak];

                // Check if milestone already achieved
                var existingMilestone = await _context.StreakMilestones
                    .FirstOrDefaultAsync(m => m.UserId == userId && m.Days == milestoneReached);

                if (existingMilestone == null)
                {
                    // Create milestone record
                    var milestone = new StreakMilestone
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Days = milestoneReached.Value,
                        XPReward = xpReward.Value,
                        AchievedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.StreakMilestones.Add(milestone);

                    // Publish event
                    var @event = new StreakMilestoneEvent
                    {
                        UserId = userId,
                        Days = milestoneReached.Value,
                        XPReward = xpReward.Value,
                        AchievedAt = DateTime.UtcNow
                    };

                    await _publisher.PublishStreakMilestoneAsync(@event);
                    _logger.LogInformation($"User {userId} reached milestone: {milestoneReached} days");
                }
            }

            await _context.SaveChangesAsync();

            return MapToResponse(streak, milestoneReached, xpReward);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error incrementing streak for user {userId}");
            throw;
        }
    }

    public async Task<StreakResponse> GetStreakAsync(Guid userId)
    {
        try
        {
            var streak = await _context.StreakTrackings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (streak == null)
            {
                throw new KeyNotFoundException($"Streak not found for user {userId}");
            }

            return MapToResponse(streak, null, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting streak for user {userId}");
            throw;
        }
    }

    public async Task<List<StreakMilestone>> GetMilestonesAsync(Guid userId)
    {
        try
        {
            return await _context.StreakMilestones
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.AchievedAt)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting milestones for user {userId}");
            throw;
        }
    }

    public async Task<StreakTracking> GetOrCreateStreakAsync(Guid userId)
    {
        var streak = await _context.StreakTrackings
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (streak != null)
        {
            return streak;
        }

        // Create new streak record
        streak = new StreakTracking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CurrentStreak = 0,
            LongestStreak = 0,
            LastWorkoutDate = DateTime.UtcNow.Date.AddDays(-1), // Set to yesterday so first workout increments to 1
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.StreakTrackings.Add(streak);
        await _context.SaveChangesAsync();

        return streak;
    }

    private StreakResponse MapToResponse(StreakTracking streak, int? milestoneReached, int? xpReward)
    {
        return new StreakResponse
        {
            UserId = streak.UserId,
            CurrentStreak = streak.CurrentStreak,
            LongestStreak = streak.LongestStreak,
            LastWorkoutDate = streak.LastWorkoutDate,
            MilestoneReached = milestoneReached,
            XPReward = xpReward
        };
    }
}
