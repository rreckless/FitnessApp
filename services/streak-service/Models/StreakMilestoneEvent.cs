namespace StreakService.Models;

public class StreakMilestoneEvent
{
    public Guid UserId { get; set; }
    public int Days { get; set; }
    public int XPReward { get; set; }
    public DateTime AchievedAt { get; set; }
}
