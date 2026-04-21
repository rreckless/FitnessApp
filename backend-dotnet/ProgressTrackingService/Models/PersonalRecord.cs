namespace ProgressTrackingService.Models;

public class PersonalRecord
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ExerciseId { get; set; }
    public int Weight { get; set; }
    public int Reps { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VolumeData
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime Date { get; set; }
    public int DailyVolume { get; set; }
    public int WeeklyVolume { get; set; }
    public int MonthlyVolume { get; set; }
    public DateTime CreatedAt { get; set; }
}
