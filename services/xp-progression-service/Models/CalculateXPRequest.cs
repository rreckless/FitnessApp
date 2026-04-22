namespace XPProgressionService.Models;

public class CalculateXPRequest
{
    public int TotalVolume { get; set; }
    public string Difficulty { get; set; } = "Isolation"; // Compound, Isolation, Cardio
    public int StreakDays { get; set; } = 0;
}
