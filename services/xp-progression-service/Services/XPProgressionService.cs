using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;

namespace XPProgressionService.Services;

public interface IXPProgressionService
{
    Task<UserXP> GetUserXPAsync(Guid userId);
    Task<UserXP> AddXPAsync(Guid userId, int xpAmount, string eventType, Guid? relatedEntityId = null);
    Task<bool> CheckLevelUpAsync(Guid userId);
    Task<(bool leveledUp, int newLevel)> ProcessLevelUpAsync(Guid userId);
}

public class XPProgressionServiceImpl : IXPProgressionService
{
    private readonly XPDbContext _context;
    private readonly ILogger<XPProgressionServiceImpl> _logger;

    // Level thresholds (cumulative XP)
    private static readonly Dictionary<int, int> LevelThresholds = new()
    {
        { 1, 0 },
        { 2, 500 },
        { 3, 1500 },
        { 4, 3000 },
        { 5, 5000 },
        { 6, 7500 },
        { 7, 10000 },
        { 8, 13000 },
        { 9, 16500 },
        { 10, 20500 }
    };

    public XPProgressionServiceImpl(XPDbContext context, ILogger<XPProgressionServiceImpl> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<UserXP> GetUserXPAsync(Guid userId)
    {
        var userXP = await _context.UserXPs.FirstOrDefaultAsync(u => u.UserId == userId);
        
        if (userXP == null)
        {
            // Initialize new user at Level 1 with 0 XP
            userXP = new UserXP
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TotalXP = 0,
                CurrentLevel = 1,
                XPToNextLevel = 500,
                LastXPUpdate = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.UserXPs.Add(userXP);
            await _context.SaveChangesAsync();
            _logger.LogInformation($"Initialized XP for user {userId}");
        }

        return userXP;
    }

    public async Task<UserXP> AddXPAsync(Guid userId, int xpAmount, string eventType, Guid? relatedEntityId = null)
    {
        var userXP = await GetUserXPAsync(userId);
        int levelBefore = userXP.CurrentLevel;

        // Add XP
        userXP.TotalXP += xpAmount;
        userXP.LastXPUpdate = DateTime.UtcNow;
        userXP.UpdatedAt = DateTime.UtcNow;

        // Record progression history
        var history = new ProgressionHistory
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            XPEarned = xpAmount,
            TotalXPAfter = userXP.TotalXP,
            LevelBefore = levelBefore,
            LevelAfter = userXP.CurrentLevel,
            EventType = eventType,
            RelatedEntityId = relatedEntityId,
            CreatedAt = DateTime.UtcNow
        };

        _context.ProgressionHistories.Add(history);

        // Check for level up
        await ProcessLevelUpAsync(userId);

        // Refresh userXP to get updated level
        userXP = await _context.UserXPs.FirstAsync(u => u.UserId == userId);
        history.LevelAfter = userXP.CurrentLevel;

        await _context.SaveChangesAsync();
        _logger.LogInformation($"Added {xpAmount} XP to user {userId}. Total XP: {userXP.TotalXP}, Level: {userXP.CurrentLevel}");

        return userXP;
    }

    public async Task<bool> CheckLevelUpAsync(Guid userId)
    {
        var userXP = await GetUserXPAsync(userId);
        var nextLevelThreshold = GetNextLevelThreshold(userXP.CurrentLevel);
        return userXP.TotalXP >= nextLevelThreshold;
    }

    public async Task<(bool leveledUp, int newLevel)> ProcessLevelUpAsync(Guid userId)
    {
        var userXP = await GetUserXPAsync(userId);
        int levelBefore = userXP.CurrentLevel;
        bool leveledUp = false;

        // Check for level ups (can level up multiple times)
        while (true)
        {
            var nextLevelThreshold = GetNextLevelThreshold(userXP.CurrentLevel);
            if (userXP.TotalXP >= nextLevelThreshold && userXP.CurrentLevel < 10)
            {
                userXP.CurrentLevel++;
                leveledUp = true;
                _logger.LogInformation($"User {userId} leveled up to level {userXP.CurrentLevel}");
            }
            else
            {
                break;
            }
        }

        // Update XP to next level
        var currentLevelThreshold = GetLevelThreshold(userXP.CurrentLevel);
        var nextThreshold = GetNextLevelThreshold(userXP.CurrentLevel);
        userXP.XPToNextLevel = Math.Max(0, nextThreshold - userXP.TotalXP);
        userXP.UpdatedAt = DateTime.UtcNow;

        if (leveledUp)
        {
            await _context.SaveChangesAsync();
        }

        return (leveledUp, userXP.CurrentLevel);
    }

    private int GetLevelThreshold(int level)
    {
        return LevelThresholds.TryGetValue(level, out var threshold) ? threshold : 0;
    }

    private int GetNextLevelThreshold(int currentLevel)
    {
        int nextLevel = currentLevel + 1;
        return LevelThresholds.TryGetValue(nextLevel, out var threshold) ? threshold : int.MaxValue;
    }
}
