namespace AchievementService.Models;

public class Achievement
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AchievementRarity Rarity { get; set; }
    public AchievementCategory Category { get; set; }
    public int XPReward { get; set; }
    public string UnlockCondition { get; set; } = string.Empty;
    public string IconUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class UserAchievement
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid AchievementId { get; set; }
    public DateTime UnlockedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public enum AchievementRarity
{
    Common,
    Rare,
    Epic,
    Legendary
}

public enum AchievementCategory
{
    Strength,
    Consistency,
    Social,
    Exploration
}
