using Microsoft.EntityFrameworkCore;
using AchievementService.Data;
using AchievementService.Models;

namespace AchievementService.Services;

public class AchievementServiceImpl : IAchievementService
{
    private readonly AchievementDbContext _dbContext;
    private readonly ILogger<AchievementServiceImpl> _logger;

    public AchievementServiceImpl(AchievementDbContext dbContext, ILogger<AchievementServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<Achievement>> GetAllAchievementsAsync()
    {
        return await _dbContext.Achievements.ToListAsync();
    }

    public async Task<List<UserAchievement>> GetUserAchievementsAsync(Guid userId)
    {
        return await _dbContext.UserAchievements
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
    }

    public async Task<List<UserAchievement>> GetUnlockedAchievementsAsync(Guid userId)
    {
        return await _dbContext.UserAchievements
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
    }

    public async Task<UserAchievement?> UnlockAchievementAsync(Guid userId, Guid achievementId)
    {
        var existing = await _dbContext.UserAchievements
            .FirstOrDefaultAsync(ua => ua.UserId == userId && ua.AchievementId == achievementId);

        if (existing != null)
            return existing;

        var achievement = await _dbContext.Achievements.FindAsync(achievementId);
        if (achievement == null)
            throw new KeyNotFoundException("Achievement not found");

        var userAchievement = new UserAchievement
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AchievementId = achievementId,
            UnlockedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.UserAchievements.Add(userAchievement);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Achievement unlocked: {UserId} - {AchievementId}", userId, achievementId);
        return userAchievement;
    }

    public async Task<bool> IsAchievementUnlockedAsync(Guid userId, Guid achievementId)
    {
        return await _dbContext.UserAchievements
            .AnyAsync(ua => ua.UserId == userId && ua.AchievementId == achievementId);
    }
}
