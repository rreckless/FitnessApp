using StackExchange.Redis;

namespace LeaderboardService.Services;

public class LeaderboardServiceImpl : ILeaderboardService
{
    private readonly IConnectionMultiplexer _redis;
    private const string GlobalLeaderboardKey = "leaderboard:global";
    private const string WeeklyLeaderboardKey = "leaderboard:weekly";

    public LeaderboardServiceImpl(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int limit = 100)
    {
        var db = _redis.GetDatabase();
        var entries = await db.SortedSetRangeByRankAsync(GlobalLeaderboardKey, 0, limit - 1, Order.Descending);

        var result = new List<LeaderboardEntry>();
        int rank = 1;

        foreach (var entry in entries)
        {
            var data = entry.ToString().Split(':');
            if (data.Length >= 3)
            {
                result.Add(new LeaderboardEntry
                {
                    Rank = rank++,
                    UserId = Guid.Parse(data[0]),
                    Name = data[1],
                    XP = int.Parse(data[2]),
                    Level = int.Parse(data[3])
                });
            }
        }

        return result;
    }

    public async Task<List<LeaderboardEntry>> GetFriendsLeaderboardAsync(Guid userId, int limit = 100)
    {
        var db = _redis.GetDatabase();
        var friendsKey = $"friends:{userId}";
        var friends = await db.SetMembersAsync(friendsKey);

        var result = new List<LeaderboardEntry>();

        foreach (var friend in friends)
        {
            var friendId = friend.ToString();
            var score = await db.SortedSetScoreAsync(GlobalLeaderboardKey, friendId);
            if (score.HasValue)
            {
                var data = friendId.Split(':');
                result.Add(new LeaderboardEntry
                {
                    UserId = Guid.Parse(data[0]),
                    Name = data[1],
                    XP = (int)score.Value,
                    Level = int.Parse(data[3])
                });
            }
        }

        return result.OrderByDescending(e => e.XP).Take(limit).ToList();
    }

    public async Task<List<LeaderboardEntry>> GetWeeklyLeaderboardAsync(int limit = 100)
    {
        var db = _redis.GetDatabase();
        var entries = await db.SortedSetRangeByRankAsync(WeeklyLeaderboardKey, 0, limit - 1, Order.Descending);

        var result = new List<LeaderboardEntry>();
        int rank = 1;

        foreach (var entry in entries)
        {
            var data = entry.ToString().Split(':');
            if (data.Length >= 3)
            {
                result.Add(new LeaderboardEntry
                {
                    Rank = rank++,
                    UserId = Guid.Parse(data[0]),
                    Name = data[1],
                    XP = int.Parse(data[2]),
                    Level = int.Parse(data[3])
                });
            }
        }

        return result;
    }

    public async Task<LeaderboardPosition?> GetUserPositionAsync(Guid userId, string leaderboardType)
    {
        var db = _redis.GetDatabase();
        var key = leaderboardType.ToLower() switch
        {
            "global" => GlobalLeaderboardKey,
            "weekly" => WeeklyLeaderboardKey,
            _ => GlobalLeaderboardKey
        };

        var rank = await db.SortedSetRankAsync(key, userId.ToString(), Order.Descending);
        if (!rank.HasValue)
            return null;

        var totalCount = await db.SortedSetLengthAsync(key);
        var nearbyStart = Math.Max(0, rank.Value - 2);
        var nearbyEnd = Math.Min(totalCount - 1, rank.Value + 2);

        var nearby = await db.SortedSetRangeByRankAsync(key, nearbyStart, nearbyEnd, Order.Descending);

        var nearbyCompetitors = new List<LeaderboardEntry>();
        int nearbyRank = (int)nearbyStart + 1;

        foreach (var entry in nearby)
        {
            var data = entry.ToString().Split(':');
            if (data.Length >= 3)
            {
                nearbyCompetitors.Add(new LeaderboardEntry
                {
                    Rank = nearbyRank++,
                    UserId = Guid.Parse(data[0]),
                    Name = data[1],
                    XP = int.Parse(data[2]),
                    Level = int.Parse(data[3])
                });
            }
        }

        return new LeaderboardPosition
        {
            Rank = (int)rank.Value + 1,
            TotalUsers = (int)totalCount,
            NearbyCompetitors = nearbyCompetitors
        };
    }

    public async Task UpdateLeaderboardAsync(Guid userId, int xp, int level, string name)
    {
        var db = _redis.GetDatabase();
        var entry = $"{userId}:{name}:{xp}:{level}";

        await db.SortedSetAddAsync(GlobalLeaderboardKey, entry, xp);

        // Reset weekly leaderboard every Monday
        var now = DateTime.UtcNow;
        if (now.DayOfWeek == DayOfWeek.Monday && now.Hour == 0)
        {
            await db.KeyDeleteAsync(WeeklyLeaderboardKey);
        }

        await db.SortedSetAddAsync(WeeklyLeaderboardKey, entry, xp);
    }
}
