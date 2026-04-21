using ChallengeService.Models;

namespace ChallengeService.Services;

public interface IChallengeService
{
    Task<Challenge> CreateChallengeAsync(Guid creatorId, CreateChallengeRequest request);
    Task<List<Challenge>> GetChallengesAsync(int page = 1, int pageSize = 20);
    Task<Challenge?> GetChallengeAsync(Guid id);
    Task<ChallengeProgress> JoinChallengeAsync(Guid challengeId, Guid userId);
    Task<List<ChallengeProgress>> GetChallengeProgressAsync(Guid challengeId);
    Task UpdateProgressAsync(Guid challengeId, Guid userId, int value);
}

public record CreateChallengeRequest(
    string Name,
    string Description,
    ChallengeType Type,
    ChallengeGoalType GoalType,
    int TargetValue,
    int Duration
);
