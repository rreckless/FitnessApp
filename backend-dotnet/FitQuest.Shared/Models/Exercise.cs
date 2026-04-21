namespace FitQuest.Shared.Models;

public class Exercise
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public MuscleGroup PrimaryMuscleGroup { get; set; }
    public List<MuscleGroup> SecondaryMuscleGroups { get; set; } = new();
    public DifficultyLevel Difficulty { get; set; }
    public List<Equipment> EquipmentRequired { get; set; } = new();
    public List<string> FormTips { get; set; } = new();
    public string? VideoUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum MuscleGroup
{
    Chest,
    Back,
    Shoulders,
    Arms,
    Legs,
    Core,
    Cardio
}

public enum DifficultyLevel
{
    Beginner,
    Intermediate,
    Advanced
}

public enum Equipment
{
    Dumbbells,
    Barbell,
    Machines,
    Bodyweight,
    Cables,
    Kettlebells
}
