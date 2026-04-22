namespace WorkoutService.Models;

public class CompleteWorkoutRequest
{
    public DateTime EndTime { get; set; }
    public string? Notes { get; set; }
}
