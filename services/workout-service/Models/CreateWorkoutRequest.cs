namespace WorkoutService.Models;

public class CreateWorkoutRequest
{
    public DateTime StartTime { get; set; }
    public string? Notes { get; set; }
    public bool IsOfflineCreated { get; set; }
}
