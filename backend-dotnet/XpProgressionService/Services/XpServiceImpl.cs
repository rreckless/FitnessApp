using Microsoft.EntityFrameworkCore;
using XpProgressionService.Data;
using XpProgressionService.Models;

namespace XpProgressionService.Services;

public class XpServiceImpl : IXpService
{
    private readonly XpDbContext _dbContext;

    public XpServiceImpl(XpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<int> CalculateWorkoutXPAsync(int totalVolume, List<string> exerciseTypes, int currentStreak)
    {
        // Base XP: volume / 100, minimum 10
        var baseXP = Math.Max(totalVolume / 100, 10);

        // Difficulty multiplier
        var difficultyMultiplier = CalculateDifficultyMultiplier(exerciseTypes);

        // Streak bonus: 5% per day, max 50%
        var streakBonus = Math.Min(currentStreak * 0.05, 0.50);

        // Final XP calculation
        var finalXP = (int)(baseXP * difficultyMultiplier * (1 + streakBonus));

        return finalXP;
    }

    public async Task<UserXP> UpdateUserXPAsync(Guid userId, int xpEarned)
    {
        var userXP = await _dbContext.UserXPs.FirstOrDefaultAsync(u => u.UserId == userId);

        if (userXP == null)
        {
            userXP = new UserXP
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TotalXP = xpEarned,
                CurrentLevel = 1,
                LastXPUpdate = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.UserXPs.Add(userXP);
        }
        else
        {
            userXP.TotalXP += xpEarned;
            userXP.CurrentLevel = CalculateLevel(userXP.TotalXP);
            userXP.LastXPUpdate = DateTime.UtcNow;
            userXP.UpdatedAt = DateTime.UtcNow;
            _dbContext.UserXPs.Update(userXP);
        }

        userXP.XPToNextLevel = CalculateXPToNextLevel(userXP.TotalXP, userXP.CurrentLevel);
        await _dbContext.SaveChangesAsync();

        return userXP;
    }

    public async Task<UserXP?> GetUserXPAsync(Guid userId)
    {
        return await _dbContext.UserXPs.FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<MuscleGroupRank?> UpdateMuscleGroupRankAsync(Guid userId, string muscleGroup, int volumeAdded)
    {
        var rank = await _dbContext.MuscleGroupRanks
            .FirstOrDefaultAsync(r => r.UserId == userId && r.MuscleGroup == muscleGroup);

        if (rank == null)
        {
            rank = new MuscleGroupRank
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MuscleGroup = muscleGroup,
                TotalVolume = volumeAdded,
                Rank = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.MuscleGroupRanks.Add(rank);
        }
        else
        {
            rank.TotalVolume += volumeAdded;
            rank.Rank = CalculateMuscleGroupRank(rank.TotalVolume);
            rank.UpdatedAt = DateTime.UtcNow;
            _dbContext.MuscleGroupRanks.Update(rank);
        }

        await _dbContext.SaveChangesAsync();
        return rank;
    }

    public async Task<List<MuscleGroupRank>> GetMuscleGroupRanksAsync(Guid userId)
    {
        return await _dbContext.MuscleGroupRanks
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.Rank)
            .ToListAsync();
    }

    private double CalculateDifficultyMultiplier(List<string> exerciseTypes)
    {
        // Compound exercises: 1.2x, Isolation: 1.0x, Cardio: 0.8x
        if (exerciseTypes.Any(t => t.Contains("compound", StringComparison.OrdinalIgnoreCase)))
            return 1.2;
        if (exerciseTypes.Any(t => t.Contains("cardio", StringComparison.OrdinalIgnoreCase)))
            return 0.8;
        return 1.0;
    }

    private int CalculateLevel(int totalXP)
    {
        var thresholds = XpThresholds.LevelThresholds.OrderByDescending(x => x.Value);
        foreach (var threshold in thresholds)
        {
            if (totalXP >= threshold.Value)
                return threshold.Key;
        }
        return 1;
    }

    private int CalculateXPToNextLevel(int totalXP, int currentLevel)
    {
        if (currentLevel >= 10)
            return 0;

        var nextLevelThreshold = XpThresholds.LevelThresholds[currentLevel + 1];
        return Math.Max(0, nextLevelThreshold - totalXP);
    }

    private int CalculateMuscleGroupRank(int totalVolume)
    {
        var thresholds = XpThresholds.MuscleGroupRankThresholds.OrderByDescending(x => x.Value);
        foreach (var threshold in thresholds)
        {
            if (totalVolume >= threshold.Value)
                return threshold.Key;
        }
        return 1;
    }
}
