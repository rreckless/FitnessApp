namespace FitQuest.EventBus.Events;

public class StreakMilestoneEvent : DomainEvent
{
    public Guid UserId { get; set; }
    public int MilestoneDays { get; set; }
    public int XpReward { get; set; }
    public DateTime Timestamp { get; set; }
}
