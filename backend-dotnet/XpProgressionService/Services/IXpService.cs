using XpProgressionService.Models;

namespace XpProgressionService.Services;

public interface IXpService
{
    Task<int> CalculateWorkoutXPAsync(int totalVolume, List<string> exerciseTypes, int currentStreak);
    Task<UserXP> UpdateUserXPAsync(Guid userId, int xpEarned);
    Task<UserXP?> GetUserXPAsync(Guid userId);
    Task<MuscleGroupRank?> UpdateMuscleGroupRankAsync(Guid userId, string muscleGroup, int volumeAdded);
    Task<List<MuscleGroupRank>> GetMuscleGroupRanksAsync(Guid userId);
}

public class XpCalculationResult
{
    public int XPEarned { get; set; }
    public int NewLevel { get; set; }
    public bool LeveledUp { get; set; }
    public int XPToNextLevel { get; set; }
}
