using ExerciseLibraryService.Models;

namespace ExerciseLibraryService.Services;

public interface IExerciseLibraryService
{
    Task<List<Exercise>> SearchExercisesAsync(string? query, string? muscleGroup, int limit = 50);
    Task<Exercise?> GetExerciseAsync(Guid id);
    Task<List<Exercise>> GetExercisesByMuscleGroupAsync(string muscleGroup);
    Task<Exercise> CreateCustomExerciseAsync(Guid userId, CreateExerciseRequest request);
    Task<List<Exercise>> GetAllExercisesAsync();
}

public record CreateExerciseRequest(
    string Name,
    string Description,
    string PrimaryMuscleGroup,
    List<string>? SecondaryMuscleGroups,
    string? Difficulty,
    List<string>? Equipment,
    List<string>? FormTips,
    string? VideoUrl
);

public record ExerciseResponse(
    Guid Id,
    string Name,
    string Description,
    string PrimaryMuscleGroup,
    List<string> SecondaryMuscleGroups,
    string Difficulty,
    List<string> Equipment,
    List<string> FormTips,
    string? VideoUrl,
    bool IsCustom,
    DateTime CreatedAt
);
