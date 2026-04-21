namespace StreakTrackingService.Services;

public interface IStreakService
{
    Task<StreakInfo> GetStreakAsync(Guid userId);
    Task<StreakUpdateResult> UpdateStreakAsync(Guid userId, Guid workoutId);
    Task<List<StreakMilestoneRecord>> GetMilestonesAsync(Guid userId);
    Task<bool> ResetStreakAsync(Guid userId);
}

public record StreakInfo(
    int CurrentStreak,
    int LongestStreak,
    DateTime? LastWorkoutDate,
    int? NextMilestone
);

public record StreakUpdateResult(
    int CurrentStreak,
    bool Updated,
    int? MilestoneReached
);

public record StreakMilestoneRecord(
    int Days,
    int XpReward,
    DateTime AchievedAt
);

public record UpdateStreakRequest(
    Guid WorkoutId
);
