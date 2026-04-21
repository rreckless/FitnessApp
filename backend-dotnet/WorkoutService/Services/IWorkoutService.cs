using WorkoutService.Models;

namespace WorkoutService.Services;

public interface IWorkoutService
{
    Task<Workout> CreateWorkoutAsync(Guid userId, dynamic request);
    Task<List<Workout>> GetUserWorkoutsAsync(Guid userId);
    Task<Workout?> GetWorkoutAsync(Guid id);
    Task<Workout?> UpdateWorkoutAsync(Guid id, dynamic request);
    Task DeleteWorkoutAsync(Guid id);
    Task<bool> CompleteWorkoutAsync(Guid id);
}

public interface IExerciseService
{
    Task<List<dynamic>> GetExercisesAsync();
    Task<dynamic?> GetExerciseAsync(Guid id);
}
