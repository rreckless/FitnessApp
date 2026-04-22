namespace XPProgressionService.Models;

public class ProgressionHistory
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int XPEarned { get; set; }
    public int TotalXPAfter { get; set; }
    public int LevelBefore { get; set; }
    public int LevelAfter { get; set; }
    public string EventType { get; set; } = string.Empty; // "WorkoutCompleted", "LevelUp", etc.
    public Guid? RelatedEntityId { get; set; } // workoutId, etc.
    public DateTime CreatedAt { get; set; }
}
