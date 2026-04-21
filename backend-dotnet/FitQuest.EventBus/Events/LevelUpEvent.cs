namespace FitQuest.EventBus.Events;

public class LevelUpEvent : DomainEvent
{
    public Guid UserId { get; set; }
    public int NewLevel { get; set; }
    public int TotalXP { get; set; }
    public DateTime LeveledUpAt { get; set; }
}
