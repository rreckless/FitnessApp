namespace FitQuest.EventBus.Events;

public class WorkoutCompletedEvent : DomainEvent
{
    public Guid UserId { get; set; }
    public Guid WorkoutId { get; set; }
    public int TotalVolume { get; set; }
    public int Duration { get; set; }
    public DateTime CompletedAt { get; set; }
}
