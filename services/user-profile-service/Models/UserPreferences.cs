namespace UserProfileService.Models;

public class UserPreferences
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FitnessGoals { get; set; } = "[]"; // JSON array: STRENGTH, ENDURANCE, WEIGHT_LOSS, MUSCLE_GAIN
    public string ExperienceLevel { get; set; } = "BEGINNER"; // BEGINNER, INTERMEDIATE, ADVANCED
    public int WorkoutFrequency { get; set; } = 3; // days per week
    public string AvailableEquipment { get; set; } = "[]"; // JSON array: DUMBBELLS, BARBELL, MACHINES, BODYWEIGHT, CABLES, KETTLEBELLS
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
