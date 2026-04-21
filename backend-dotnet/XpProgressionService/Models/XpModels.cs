namespace XpProgressionService.Models;

public class UserXP
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int TotalXP { get; set; }
    public int CurrentLevel { get; set; }
    public int XPToNextLevel { get; set; }
    public DateTime LastXPUpdate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class MuscleGroupRank
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string MuscleGroup { get; set; } = string.Empty;
    public int Rank { get; set; }
    public int TotalVolume { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public static class XpThresholds
{
    public static readonly Dictionary<int, int> LevelThresholds = new()
    {
        { 1, 0 },
        { 2, 500 },
        { 3, 1500 },
        { 4, 3000 },
        { 5, 5000 },
        { 6, 7500 },
        { 7, 10000 },
        { 8, 13000 },
        { 9, 16000 },
        { 10, 20000 }
    };

    public static readonly Dictionary<int, int> MuscleGroupRankThresholds = new()
    {
        { 1, 0 },
        { 2, 5000 },
        { 3, 15000 },
        { 4, 30000 },
        { 5, 50000 },
        { 6, 75000 },
        { 7, 100000 },
        { 8, 150000 },
        { 9, 200000 },
        { 10, 300000 }
    };
}
