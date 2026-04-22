using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using XPProgressionService.Services;

namespace XPProgressionService.Tests;

public class XPCalculationServiceTests
{
    private readonly Mock<ILogger<XPCalculationService>> _mockLogger;
    private readonly XPCalculationService _service;

    public XPCalculationServiceTests()
    {
        _mockLogger = new Mock<ILogger<XPCalculationService>>();
        _service = new XPCalculationService(_mockLogger.Object);
    }

    [Fact]
    public void CalculateXP_WithMinimumVolume_ReturnsMinimumXP()
    {
        // Arrange
        int volume = 0;
        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp = _service.CalculateXP(volume, difficulty);

        // Assert
        Assert.Equal(10, xp); // Minimum XP is 10
    }

    [Fact]
    public void CalculateXP_WithStandardVolume_CalculatesCorrectly()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Isolation;

        // Act
        int xp = _service.CalculateXP(volume, difficulty);

        // Assert
        // Base XP: max(5000/100, 10) = 50
        // Difficulty: 1.0x
        // Streak: 0% bonus
        // Expected: 50 * 1.0 * 1.0 = 50
        Assert.Equal(50, xp);
    }

    [Fact]
    public void CalculateXP_WithCompoundDifficulty_AppliesMultiplier()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Compound;

        // Act
        int xp = _service.CalculateXP(volume, difficulty);

        // Assert
        // Base XP: 50
        // Difficulty: 1.2x
        // Expected: 50 * 1.2 = 60
        Assert.Equal(60, xp);
    }

    [Fact]
    public void CalculateXP_WithCardioDifficulty_AppliesMultiplier()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Cardio;

        // Act
        int xp = _service.CalculateXP(volume, difficulty);

        // Assert
        // Base XP: 50
        // Difficulty: 0.8x
        // Expected: 50 * 0.8 = 40
        Assert.Equal(40, xp);
    }

    [Fact]
    public void CalculateXP_WithStreakBonus_AppliesBonus()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Isolation;
        int streakDays = 5;

        // Act
        int xp = _service.CalculateXP(volume, difficulty, streakDays);

        // Assert
        // Base XP: 50
        // Difficulty: 1.0x
        // Streak: 5 * 0.05 = 0.25 (25% bonus)
        // Expected: 50 * 1.0 * 1.25 = 62.5 ≈ 62 or 63 (rounded)
        Assert.True(xp >= 62 && xp <= 63, $"Expected XP between 62-63, got {xp}");
    }

    [Fact]
    public void CalculateXP_WithMaxStreakBonus_CapsAt50Percent()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Isolation;
        int streakDays = 20; // 20 * 0.05 = 100%, but capped at 50%

        // Act
        int xp = _service.CalculateXP(volume, difficulty, streakDays);

        // Assert
        // Base XP: 50
        // Difficulty: 1.0x
        // Streak: min(20 * 0.05, 0.5) = 0.5 (50% bonus)
        // Expected: 50 * 1.0 * 1.5 = 75
        Assert.Equal(75, xp);
    }

    [Fact]
    public void CalculateXP_WithCompoundAndStreak_CombinesMultipliers()
    {
        // Arrange
        int volume = 5000;
        var difficulty = ExerciseDifficulty.Compound;
        int streakDays = 10;

        // Act
        int xp = _service.CalculateXP(volume, difficulty, streakDays);

        // Assert
        // Base XP: 50
        // Difficulty: 1.2x
        // Streak: 10 * 0.05 = 0.5 (50% bonus)
        // Expected: 50 * 1.2 * 1.5 = 90
        Assert.Equal(90, xp);
    }

    [Fact]
    public void ValidateWorkoutData_WithValidData_ReturnsTrue()
    {
        // Arrange
        int maxRepsPerSet = 30;
        int maxRepsPerExercise = 80;
        int maxWeight = 300;

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.True(isValid);
    }

    [Fact]
    public void ValidateWorkoutData_WithExcessiveRepsPerSet_ReturnsFalse()
    {
        // Arrange
        int maxRepsPerSet = 60; // Exceeds 50
        int maxRepsPerExercise = 80;
        int maxWeight = 300;

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.False(isValid);
    }

    [Fact]
    public void ValidateWorkoutData_WithExcessiveRepsPerExercise_ReturnsFalse()
    {
        // Arrange
        int maxRepsPerSet = 30;
        int maxRepsPerExercise = 120; // Exceeds 100
        int maxWeight = 300;

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.False(isValid);
    }

    [Fact]
    public void ValidateWorkoutData_WithInvalidWeight_ReturnsFalse()
    {
        // Arrange
        int maxRepsPerSet = 30;
        int maxRepsPerExercise = 80;
        int maxWeight = 1500; // Exceeds 1000

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.False(isValid);
    }

    [Fact]
    public void ValidateWorkoutData_WithZeroWeight_ReturnsFalse()
    {
        // Arrange
        int maxRepsPerSet = 30;
        int maxRepsPerExercise = 80;
        int maxWeight = 0; // Below 1

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.False(isValid);
    }

    [Fact]
    public void ValidateWorkoutData_WithBoundaryValues_ReturnsTrue()
    {
        // Arrange
        int maxRepsPerSet = 50; // Boundary
        int maxRepsPerExercise = 100; // Boundary
        int maxWeight = 1000; // Boundary

        // Act
        bool isValid = _service.ValidateWorkoutData(maxRepsPerSet, maxRepsPerExercise, maxWeight);

        // Assert
        Assert.True(isValid);
    }
}
