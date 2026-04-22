using Xunit;
using FsCheck;
using FsCheck.Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

/// <summary>
/// Property-Based Tests for XP Calculation
/// **Validates: Requirements 5.5, 6.1**
/// </summary>
public class XPCalculationPropertyTests
{
    private readonly Mock<ILogger<XPCalculationService>> _mockLogger;
    private readonly XPCalculationService _service;

    public XPCalculationPropertyTests()
    {
        _mockLogger = new Mock<ILogger<XPCalculationService>>();
        _service = new XPCalculationService(_mockLogger.Object);
    }

    [Property]
    public bool XPCalculation_MinimumXPIsAlwaysAtLeast10(int volume)
    {
        // Arrange
        var volume_positive = Math.Abs(volume);
        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp = _service.CalculateXP(volume_positive, difficulty);

        // Assert
        return xp >= 10;
    }

    [Property]
    public bool XPCalculation_IncreasingVolumeIncreasesXP(int volume1, int volume2)
    {
        // Arrange
        var v1 = Math.Abs(volume1) % 100000;
        var v2 = Math.Abs(volume2) % 100000;
        if (v1 >= v2) return true; // Skip if not in order

        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp1 = _service.CalculateXP(v1, difficulty);
        int xp2 = _service.CalculateXP(v2, difficulty);

        // Assert
        return xp2 >= xp1;
    }

    [Property]
    public bool XPCalculation_CompoundDifficultyGreaterThanIsolation(int volume)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;

        // Act
        int xp_compound = _service.CalculateXP(vol, ExerciseDifficulty.Compound);
        int xp_isolation = _service.CalculateXP(vol, ExerciseDifficulty.Isolation);

        // Assert
        return xp_compound >= xp_isolation;
    }

    [Property]
    public bool XPCalculation_IsolationGreaterThanCardio(int volume)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;

        // Act
        int xp_isolation = _service.CalculateXP(vol, ExerciseDifficulty.Isolation);
        int xp_cardio = _service.CalculateXP(vol, ExerciseDifficulty.Cardio);

        // Assert
        return xp_isolation >= xp_cardio;
    }

    [Property]
    public bool XPCalculation_StreakBonusIncreasesXP(int volume, int streak)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;
        var streak_days = Math.Abs(streak) % 100;
        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp_no_streak = _service.CalculateXP(vol, difficulty, 0);
        int xp_with_streak = _service.CalculateXP(vol, difficulty, streak_days);

        // Assert
        return xp_with_streak >= xp_no_streak;
    }

    [Property]
    public bool XPCalculation_StreakBonusCappedAt50Percent(int volume)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;
        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp_max_streak = _service.CalculateXP(vol, difficulty, 100); // Way more than 50% cap
        int xp_50_percent = _service.CalculateXP(vol, difficulty, 10); // 50% bonus

        // Assert
        return xp_max_streak == xp_50_percent;
    }

    [Property]
    public bool XPCalculation_ResultIsAlwaysPositive(int volume, int streak)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;
        var streak_days = Math.Abs(streak) % 100;
        var difficulty = ExerciseDifficulty.Compound;

        // Act
        int xp = _service.CalculateXP(vol, difficulty, streak_days);

        // Assert
        return xp > 0;
    }

    [Property]
    public bool XPCalculation_FormulaConsistency(int volume)
    {
        // Arrange
        var vol = Math.Abs(volume) % 100000;

        // Act - Calculate multiple times
        int xp1 = _service.CalculateXP(vol, ExerciseDifficulty.Isolation);
        int xp2 = _service.CalculateXP(vol, ExerciseDifficulty.Isolation);

        // Assert - Should be deterministic
        return xp1 == xp2;
    }

    [Property]
    public bool ValidateWorkoutData_ValidDataAlwaysPasses(int reps_set, int reps_exercise, int weight)
    {
        // Arrange
        var valid_reps_set = (Math.Abs(reps_set) % 50) + 1; // 1-50
        var valid_reps_exercise = (Math.Abs(reps_exercise) % 100) + 1; // 1-100
        var valid_weight = (Math.Abs(weight) % 1000) + 1; // 1-1000

        // Act
        bool isValid = _service.ValidateWorkoutData(valid_reps_set, valid_reps_exercise, valid_weight);

        // Assert
        return isValid;
    }

    [Property]
    public bool ValidateWorkoutData_InvalidRepsPerSetFails(int reps_set)
    {
        // Arrange
        var invalid_reps_set = (Math.Abs(reps_set) % 1000) + 51; // 51+
        var valid_reps_exercise = 50;
        var valid_weight = 300;

        // Act
        bool isValid = _service.ValidateWorkoutData(invalid_reps_set, valid_reps_exercise, valid_weight);

        // Assert
        return !isValid;
    }

    [Property]
    public bool ValidateWorkoutData_InvalidRepsPerExerciseFails(int reps_exercise)
    {
        // Arrange
        var valid_reps_set = 30;
        var invalid_reps_exercise = (Math.Abs(reps_exercise) % 1000) + 101; // 101+
        var valid_weight = 300;

        // Act
        bool isValid = _service.ValidateWorkoutData(valid_reps_set, invalid_reps_exercise, valid_weight);

        // Assert
        return !isValid;
    }

    [Property]
    public bool ValidateWorkoutData_InvalidWeightFails(int weight)
    {
        // Arrange
        var valid_reps_set = 30;
        var valid_reps_exercise = 80;
        var invalid_weight = (Math.Abs(weight) % 10000) + 1001; // 1001+

        // Act
        bool isValid = _service.ValidateWorkoutData(valid_reps_set, valid_reps_exercise, invalid_weight);

        // Assert
        return !isValid;
    }
}
