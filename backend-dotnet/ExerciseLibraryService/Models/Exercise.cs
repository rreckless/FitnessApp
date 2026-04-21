namespace ExerciseLibraryService.Models;

public class Exercise
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PrimaryMuscleGroup { get; set; } = string.Empty; // CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE, CARDIO
    public string SecondaryMuscleGroups { get; set; } = "[]"; // JSON array
    public string Difficulty { get; set; } = "BEGINNER"; // BEGINNER, INTERMEDIATE, ADVANCED
    public string Equipment { get; set; } = "[]"; // JSON array
    public string FormTips { get; set; } = "[]"; // JSON array
    public string? VideoUrl { get; set; }
    public bool IsCustom { get; set; } = false;
    public Guid? CreatedByUserId { get; set; } // null for built-in exercises
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
