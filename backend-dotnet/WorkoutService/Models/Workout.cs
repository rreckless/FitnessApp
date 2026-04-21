namespace WorkoutService.Models;

public class Workout
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
    public DateTime? DeletedAt { get; set; }
    public List<WorkoutExercise> Exercises { get; set; } = new();
}

public class WorkoutExercise
{
    public Guid Id { get; set; }
    public Guid WorkoutId { get; set; }
    public Guid ExerciseId { get; set; }
    public int Order { get; set; }
    public List<WorkoutSet> Sets { get; set; } = new();
    public int TotalVolume { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Workout Workout { get; set; } = null!;
}

public class WorkoutSet
{
    public Guid Id { get; set; }
    public Guid WorkoutExerciseId { get; set; }
    public int Reps { get; set; }
    public int Weight { get; set; }
    public int? RPE { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public WorkoutExercise WorkoutExercise { get; set; } = null!;
}
