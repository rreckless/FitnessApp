namespace WorkoutService.Models;

public class UpdateWorkoutRequest
{
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string? Notes { get; set; }
    public List<UpdateWorkoutExerciseRequest>? Exercises { get; set; }
}

public class UpdateWorkoutExerciseRequest
{
    public Guid ExerciseId { get; set; }
    public int Order { get; set; }
    public List<ExerciseSet> Sets { get; set; } = new List<ExerciseSet>();
}
