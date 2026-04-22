namespace StreakService.Models;

public class StreakMilestone
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int Days { get; set; } // 7, 14, 30, 60, 100
    public int XPReward { get; set; }
    public DateTime AchievedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
