namespace StreakTrackingService.Models;

public class UserStreak
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int CurrentStreak { get; set; } = 0;
    public int LongestStreak { get; set; } = 0;
    public DateTime? LastWorkoutDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class StreakMilestone
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int Days { get; set; }
    public int XpReward { get; set; }
    public DateTime AchievedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
