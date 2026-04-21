using ActivityFeedService.Models;

namespace ActivityFeedService.Services;

public interface IActivityFeedService
{
    Task<List<ActivityFeedEntry>> GetActivityFeedAsync(Guid userId, int page = 1, int pageSize = 50);
    Task AddActivityAsync(Guid userId, ActivityType type, Guid? relatedEntityId, string metadata);
    Task FanOutActivityAsync(Guid userId, ActivityFeedEntry entry, List<Guid> friendIds);
}
