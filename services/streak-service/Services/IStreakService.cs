using StreakService.Models;

namespace StreakService.Services;

public interface IStreakService
{
    Task<StreakResponse> IncrementStreakAsync(Guid userId, DateTime workoutDate);
    Task<StreakResponse> GetStreakAsync(Guid userId);
    Task<List<StreakMilestone>> GetMilestonesAsync(Guid userId);
    Task<StreakTracking> GetOrCreateStreakAsync(Guid userId);
}
