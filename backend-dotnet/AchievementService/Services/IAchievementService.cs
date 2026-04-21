using AchievementService.Models;

namespace AchievementService.Services;

public interface IAchievementService
{
    Task<List<Achievement>> GetAllAchievementsAsync();
    Task<List<UserAchievement>> GetUserAchievementsAsync(Guid userId);
    Task<List<UserAchievement>> GetUnlockedAchievementsAsync(Guid userId);
    Task<UserAchievement?> UnlockAchievementAsync(Guid userId, Guid achievementId);
    Task<bool> IsAchievementUnlockedAsync(Guid userId, Guid achievementId);
}
