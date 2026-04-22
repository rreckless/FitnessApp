using Xunit;
using WorkoutService.Services;

namespace WorkoutService.Tests;

public class XPCalculationServiceTests
{
    private readonly XPCalculationService _service = new();

    [Fact]
    public void CalculateXP_WithZeroVolume_ReturnsMinimumXP()
    {
        // Arrange
        int volume = 0;
        int expected = 10; // minimum XP

        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateXP_WithNegativeVolume_ReturnsMinimumXP()
    {
        // Arrange
        int volume = -100;
        int expected = 10; // minimum XP

        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateXP_WithSmallVolume_ReturnsMinimumXP()
    {
        // Arrange
        int volume = 500; // 500 / 100 = 5, but minimum is 10
        int expected = 10;

        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateXP_WithLargeVolume_ReturnsCalculatedXP()
    {
        // Arrange
        int volume = 2000; // 2000 / 100 = 20
        int expected = 20;

        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateXP_WithVeryLargeVolume_ReturnsCalculatedXP()
    {
        // Arrange
        int volume = 10000; // 10000 / 100 = 100
        int expected = 100;

        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(1000, 10)]  // 1000 / 100 = 10
    [InlineData(1500, 15)]  // 1500 / 100 = 15
    [InlineData(2500, 25)]  // 2500 / 100 = 25
    [InlineData(5000, 50)]  // 5000 / 100 = 50
    public void CalculateXP_WithVariousVolumes_ReturnsCorrectXP(int volume, int expected)
    {
        // Act
        int result = _service.CalculateXP(volume);

        // Assert
        Assert.Equal(expected, result);
    }
}
