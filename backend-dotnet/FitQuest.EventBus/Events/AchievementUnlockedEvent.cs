namespace FitQuest.EventBus.Events;

public class AchievementUnlockedEvent : DomainEvent
{
    public Guid UserId { get; set; }
    public Guid AchievementId { get; set; }
    public string AchievementName { get; set; } = string.Empty;
    public int XPReward { get; set; }
    public DateTime UnlockedAt { get; set; }
}
