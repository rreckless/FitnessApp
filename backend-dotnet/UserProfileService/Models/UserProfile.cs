namespace UserProfileService.Models;

public class UserProfile
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public int Level { get; set; } = 1;
    public int TotalXP { get; set; } = 0;
    public int CurrentStreak { get; set; } = 0;
    public int LongestStreak { get; set; } = 0;
    public bool IsPublic { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastSyncAt { get; set; }

    public UserPreferences? Preferences { get; set; }
}

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

    public UserProfile? UserProfile { get; set; }
}
