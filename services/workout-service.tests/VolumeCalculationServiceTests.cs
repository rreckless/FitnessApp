using Xunit;
using WorkoutService.Models;
using WorkoutService.Services;

namespace WorkoutService.Tests;

public class VolumeCalculationServiceTests
{
    private readonly VolumeCalculationService _service = new();

    [Fact]
    public void CalculateSetVolume_WithValidInputs_ReturnsCorrectVolume()
    {
        // Arrange
        int weight = 225;
        int reps = 10;
        int expected = 2250; // 225 * 10

        // Act
        int result = _service.CalculateSetVolume(weight, reps);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateSetVolume_WithZeroWeight_ReturnsZero()
    {
        // Arrange
        int weight = 0;
        int reps = 10;

        // Act
        int result = _service.CalculateSetVolume(weight, reps);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void CalculateSetVolume_WithZeroReps_ReturnsZero()
    {
        // Arrange
        int weight = 225;
        int reps = 0;

        // Act
        int result = _service.CalculateSetVolume(weight, reps);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void CalculateExerciseVolume_WithMultipleSets_ReturnsSumOfAllSets()
    {
        // Arrange
        var exercise = new WorkoutExercise
        {
            Id = Guid.NewGuid(),
            WorkoutId = Guid.NewGuid(),
            ExerciseId = Guid.NewGuid(),
            Order = 1,
            Sets = new List<ExerciseSet>
            {
                new ExerciseSet { Weight = 225, Reps = 10 },
                new ExerciseSet { Weight = 225, Reps = 8 },
                new ExerciseSet { Weight = 225, Reps = 6 }
            }
        };
        int expected = (225 * 10) + (225 * 8) + (225 * 6); // 2250 + 1800 + 1350 = 5400

        // Act
        int result = _service.CalculateExerciseVolume(exercise);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateExerciseVolume_WithNoSets_ReturnsZero()
    {
        // Arrange
        var exercise = new WorkoutExercise
        {
            Id = Guid.NewGuid(),
            WorkoutId = Guid.NewGuid(),
            ExerciseId = Guid.NewGuid(),
            Order = 1,
            Sets = new List<ExerciseSet>()
        };

        // Act
        int result = _service.CalculateExerciseVolume(exercise);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void CalculateExerciseVolume_WithNullSets_ReturnsZero()
    {
        // Arrange
        var exercise = new WorkoutExercise
        {
            Id = Guid.NewGuid(),
            WorkoutId = Guid.NewGuid(),
            ExerciseId = Guid.NewGuid(),
            Order = 1,
            Sets = null!
        };

        // Act
        int result = _service.CalculateExerciseVolume(exercise);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void CalculateWorkoutVolume_WithMultipleExercises_ReturnsSumOfAllExercises()
    {
        // Arrange
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>
            {
                new WorkoutExercise
                {
                    Id = Guid.NewGuid(),
                    WorkoutId = Guid.NewGuid(),
                    ExerciseId = Guid.NewGuid(),
                    Order = 1,
                    Sets = new List<ExerciseSet>
                    {
                        new ExerciseSet { Weight = 225, Reps = 10 },
                        new ExerciseSet { Weight = 225, Reps = 8 }
                    }
                },
                new WorkoutExercise
                {
                    Id = Guid.NewGuid(),
                    WorkoutId = Guid.NewGuid(),
                    ExerciseId = Guid.NewGuid(),
                    Order = 2,
                    Sets = new List<ExerciseSet>
                    {
                        new ExerciseSet { Weight = 185, Reps = 12 },
                        new ExerciseSet { Weight = 185, Reps = 10 }
                    }
                }
            }
        };
        // Exercise 1: (225*10) + (225*8) = 4050
        // Exercise 2: (185*12) + (185*10) = 4070
        // Total: 8120
        int expected = 8120;

        // Act
        int result = _service.CalculateWorkoutVolume(workout);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateWorkoutVolume_WithNoExercises_ReturnsZero()
    {
        // Arrange
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };

        // Act
        int result = _service.CalculateWorkoutVolume(workout);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void CalculateWorkoutVolume_WithNullExercises_ReturnsZero()
    {
        // Arrange
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = null!
        };

        // Act
        int result = _service.CalculateWorkoutVolume(workout);

        // Assert
        Assert.Equal(0, result);
    }
}
