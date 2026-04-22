using WorkoutService.Models;

namespace WorkoutService.Services;

public interface IVolumeCalculationService
{
    int CalculateSetVolume(int weight, int reps);
    int CalculateExerciseVolume(WorkoutExercise exercise);
    int CalculateWorkoutVolume(Workout workout);
}

public class VolumeCalculationService : IVolumeCalculationService
{
    /// <summary>
    /// Calculate volume for a single set: weight × reps
    /// </summary>
    public int CalculateSetVolume(int weight, int reps)
    {
        return weight * reps;
    }

    /// <summary>
    /// Calculate total volume for an exercise: sum of all sets (weight × reps)
    /// </summary>
    public int CalculateExerciseVolume(WorkoutExercise exercise)
    {
        if (exercise.Sets == null || exercise.Sets.Count == 0)
            return 0;

        return exercise.Sets.Sum(set => CalculateSetVolume(set.Weight, set.Reps));
    }

    /// <summary>
    /// Calculate total volume for a workout: sum of all exercises
    /// </summary>
    public int CalculateWorkoutVolume(Workout workout)
    {
        if (workout.Exercises == null || workout.Exercises.Count == 0)
            return 0;

        return workout.Exercises.Sum(exercise => CalculateExerciseVolume(exercise));
    }
}
