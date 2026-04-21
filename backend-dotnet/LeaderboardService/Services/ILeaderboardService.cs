namespace LeaderboardService.Services;

public interface ILeaderboardService
{
    Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int limit = 100);
    Task<List<LeaderboardEntry>> GetFriendsLeaderboardAsync(Guid userId, int limit = 100);
    Task<List<LeaderboardEntry>> GetWeeklyLeaderboardAsync(int limit = 100);
    Task<LeaderboardPosition?> GetUserPositionAsync(Guid userId, string leaderboardType);
    Task UpdateLeaderboardAsync(Guid userId, int xp, int level, string name);
}

public class LeaderboardEntry
{
    public int Rank { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int XP { get; set; }
    public int Level { get; set; }
}

public class LeaderboardPosition
{
    public int Rank { get; set; }
    public int TotalUsers { get; set; }
    public List<LeaderboardEntry> NearbyCompetitors { get; set; } = new();
}
