namespace FitQuest.Shared.Models;

public class Achievement
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RarityTier Rarity { get; set; }
    public AchievementCategory Category { get; set; }
    public int XPReward { get; set; }
    public string UnlockedCondition { get; set; } = string.Empty;
    public string IconUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public enum RarityTier
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
