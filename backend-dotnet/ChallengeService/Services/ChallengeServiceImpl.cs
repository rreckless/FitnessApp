using Microsoft.EntityFrameworkCore;
using ChallengeService.Data;
using ChallengeService.Models;

namespace ChallengeService.Services;

public class ChallengeServiceImpl : IChallengeService
{
    private readonly ChallengeDbContext _dbContext;
    private readonly ILogger<ChallengeServiceImpl> _logger;

    public ChallengeServiceImpl(ChallengeDbContext dbContext, ILogger<ChallengeServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<Challenge> CreateChallengeAsync(Guid creatorId, CreateChallengeRequest request)
    {
        var now = DateTime.UtcNow;
        var challenge = new Challenge
        {
            Id = Guid.NewGuid(),
            CreatorId = creatorId,
            Name = request.Name,
            Description = request.Description,
            Type = request.Type,
            GoalType = request.GoalType,
            TargetValue = request.TargetValue,
            Duration = request.Duration,
            StartDate = now,
            EndDate = now.AddDays(request.Duration),
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Challenges.Add(challenge);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Challenge created: {ChallengeId}", challenge.Id);
        return challenge;
    }

    public async Task<List<Challenge>> GetChallengesAsync(int page = 1, int pageSize = 20)
    {
        var skip = (page - 1) * pageSize;
        return await _dbContext.Challenges
            .Where(c => c.EndDate > DateTime.UtcNow)
            .OrderByDescending(c => c.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<Challenge?> GetChallengeAsync(Guid id)
    {
        return await _dbContext.Challenges.FindAsync(id);
    }

    public async Task<ChallengeProgress> JoinChallengeAsync(Guid challengeId, Guid userId)
    {
        var existing = await _dbContext.ChallengeProgress
            .FirstOrDefaultAsync(cp => cp.ChallengeId == challengeId && cp.UserId == userId);

        if (existing != null)
            return existing;

        var progress = new ChallengeProgress
        {
            Id = Guid.NewGuid(),
            ChallengeId = challengeId,
            UserId = userId,
            CurrentValue = 0,
            Rank = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.ChallengeProgress.Add(progress);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User joined challenge: {UserId} - {ChallengeId}", userId, challengeId);
        return progress;
    }

    public async Task<List<ChallengeProgress>> GetChallengeProgressAsync(Guid challengeId)
    {
        return await _dbContext.ChallengeProgress
            .Where(cp => cp.ChallengeId == challengeId)
            .OrderByDescending(cp => cp.CurrentValue)
            .ToListAsync();
    }

    public async Task UpdateProgressAsync(Guid challengeId, Guid userId, int value)
    {
        var progress = await _dbContext.ChallengeProgress
            .FirstOrDefaultAsync(cp => cp.ChallengeId == challengeId && cp.UserId == userId);

        if (progress == null)
            throw new KeyNotFoundException("Challenge progress not found");

        progress.CurrentValue = value;
        progress.UpdatedAt = DateTime.UtcNow;

        // Recalculate ranks
        var allProgress = await _dbContext.ChallengeProgress
            .Where(cp => cp.ChallengeId == challengeId)
            .OrderByDescending(cp => cp.CurrentValue)
            .ToListAsync();

        for (int i = 0; i < allProgress.Count; i++)
        {
            allProgress[i].Rank = i + 1;
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Challenge progress updated: {UserId} - {ChallengeId}", userId, challengeId);
    }
}
