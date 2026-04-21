namespace FitQuest.EventBus.Events;

public abstract class DomainEvent
{
    public Guid EventId { get; set; } = Guid.NewGuid();
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public Guid AggregateId { get; set; }
}
