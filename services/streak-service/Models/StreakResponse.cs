namespace StreakService.Models;

public class StreakResponse
{
    public Guid UserId { get; set; }
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateTime LastWorkoutDate { get; set; }
    public int? MilestoneReached { get; set; }
    public int? XPReward { get; set; }
}
