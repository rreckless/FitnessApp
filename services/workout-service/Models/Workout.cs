namespace WorkoutService.Models;

public class Workout
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int Duration { get; set; } // in seconds
    public int TotalVolume { get; set; } // in lbs
    public int TotalXP { get; set; }
    public string? Notes { get; set; }
    public bool IsOfflineCreated { get; set; }
    public DateTime? SyncedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; } // soft delete

    public ICollection<WorkoutExercise> Exercises { get; set; } = new List<WorkoutExercise>();
}
