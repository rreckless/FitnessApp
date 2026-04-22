namespace WorkoutService.Models;

public class WorkoutExercise
{
    public Guid Id { get; set; }
    public Guid WorkoutId { get; set; }
    public Guid ExerciseId { get; set; }
    public int Order { get; set; }
    public List<ExerciseSet> Sets { get; set; } = new List<ExerciseSet>();
    public int TotalVolume { get; set; } // calculated: weight × reps × sets
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Workout? Workout { get; set; }
}

public class ExerciseSet
{
    public int Reps { get; set; }
    public int Weight { get; set; } // in lbs
    public int? RPE { get; set; } // Rate of Perceived Exertion (1-10)
    public string? Notes { get; set; }
}
