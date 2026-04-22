namespace UserProfileService.Models;

public class UpdatePreferencesRequest
{
    public string[]? FitnessGoals { get; set; }
    public string? ExperienceLevel { get; set; }
    public int? WorkoutFrequency { get; set; }
    public string[]? AvailableEquipment { get; set; }
}
