using StreakService.Models;

namespace StreakService.Services;

public interface IRabbitMQPublisher
{
    Task PublishStreakMilestoneAsync(StreakMilestoneEvent @event);
}
