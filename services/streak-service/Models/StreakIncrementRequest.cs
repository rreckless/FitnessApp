namespace StreakService.Models;

public class StreakIncrementRequest
{
    public Guid UserId { get; set; }
    public DateTime WorkoutDate { get; set; }
}
