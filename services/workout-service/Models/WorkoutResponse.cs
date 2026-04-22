namespace WorkoutService.Models;

public class WorkoutResponse
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int Duration { get; set; }
    public int TotalVolume { get; set; }
    public int TotalXP { get; set; }
    public string? Notes { get; set; }
    public bool IsOfflineCreated { get; set; }
    public DateTime? SyncedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<WorkoutExerciseResponse> Exercises { get; set; } = new List<WorkoutExerciseResponse>();
}

public class WorkoutExerciseResponse
{
    public Guid Id { get; set; }
    public Guid ExerciseId { get; set; }
    public int Order { get; set; }
    public List<ExerciseSet> Sets { get; set; } = new List<ExerciseSet>();
    public int TotalVolume { get; set; }
}
