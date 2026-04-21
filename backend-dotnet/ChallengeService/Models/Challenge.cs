namespace ChallengeService.Models;

public class Challenge
{
    public Guid Id { get; set; }
    public Guid CreatorId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ChallengeType Type { get; set; }
    public ChallengeGoalType GoalType { get; set; }
    public int TargetValue { get; set; }
    public int Duration { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ChallengeProgress
{
    public Guid Id { get; set; }
    public Guid ChallengeId { get; set; }
    public Guid UserId { get; set; }
    public int CurrentValue { get; set; }
    public int Rank { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum ChallengeType
{
    Friend,
    Community
}

public enum ChallengeGoalType
{
    XP,
    Volume,
    Streak
}
