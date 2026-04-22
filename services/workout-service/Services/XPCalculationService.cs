namespace WorkoutService.Services;

public interface IXPCalculationService
{
    int CalculateXP(int totalVolume);
}

public class XPCalculationService : IXPCalculationService
{
    /// <summary>
    /// Calculate XP based on volume: max(volume / 100, 10)
    /// This ensures minimum 10 XP per workout
    /// </summary>
    public int CalculateXP(int totalVolume)
    {
        if (totalVolume <= 0)
            return 10; // minimum XP

        int xp = totalVolume / 100;
        return Math.Max(xp, 10);
    }
}
