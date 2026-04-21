using Microsoft.EntityFrameworkCore;
using ActivityFeedService.Data;
using ActivityFeedService.Models;
using StackExchange.Redis;

namespace ActivityFeedService.Services;

public class ActivityFeedServiceImpl : IActivityFeedService
{
    private readonly ActivityFeedDbContext _dbContext;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ActivityFeedServiceImpl> _logger;

    public ActivityFeedServiceImpl(ActivityFeedDbContext dbContext, IConnectionMultiplexer redis, ILogger<ActivityFeedServiceImpl> logger)
    {
        _dbContext = dbContext;
        _redis = redis;
        _logger = logger;
    }

    public async Task<List<ActivityFeedEntry>> GetActivityFeedAsync(Guid userId, int page = 1, int pageSize = 50)
    {
        var skip = (page - 1) * pageSize;
        return await _dbContext.ActivityFeedEntries
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task AddActivityAsync(Guid userId, ActivityType type, Guid? relatedEntityId, string metadata)
    {
        var entry = new ActivityFeedEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ActivityType = type,
            RelatedEntityId = relatedEntityId,
            Metadata = metadata,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.ActivityFeedEntries.Add(entry);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Activity added: {UserId} - {ActivityType}", userId, type);
    }

    public async Task FanOutActivityAsync(Guid userId, ActivityFeedEntry entry, List<Guid> friendIds)
    {
        if (friendIds.Count > 1000)
        {
            _logger.LogWarning("Friend count exceeds 1000 limit for user {UserId}", userId);
            friendIds = friendIds.Take(1000).ToList();
        }

        var db = _redis.GetDatabase();
        var tasks = new List<Task>();

        foreach (var friendId in friendIds)
        {
            var key = $"activity_feed:{friendId}";
            var json = System.Text.Json.JsonSerializer.Serialize(entry);
            tasks.Add(db.ListLeftPushAsync(key, json));
        }

        await Task.WhenAll(tasks);
        _logger.LogInformation("Activity fanned out to {FriendCount} friends", friendIds.Count);
    }
}
