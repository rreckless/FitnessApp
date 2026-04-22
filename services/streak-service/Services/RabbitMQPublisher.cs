using System.Text;
using System.Text.Json;
using RabbitMQ.Client;
using StreakService.Models;

namespace StreakService.Services;

public class RabbitMQPublisher : IRabbitMQPublisher
{
    private readonly IConnection _connection;
    private readonly ILogger<RabbitMQPublisher> _logger;
    private const string ExchangeName = "fitquest.events";
    private const string StreakMilestoneRoutingKey = "streak.milestone";

    public RabbitMQPublisher(IConnection connection, ILogger<RabbitMQPublisher> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task PublishStreakMilestoneAsync(StreakMilestoneEvent @event)
    {
        try
        {
            using (var channel = _connection.CreateModel())
            {
                // Declare exchange
                channel.ExchangeDeclare(
                    exchange: ExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false);

                // Serialize event
                var json = JsonSerializer.Serialize(@event);
                var body = Encoding.UTF8.GetBytes(json);

                // Publish message
                channel.BasicPublish(
                    exchange: ExchangeName,
                    routingKey: StreakMilestoneRoutingKey,
                    basicProperties: null,
                    body: body);

                _logger.LogInformation($"Published StreakMilestone event for user {@event.UserId}");
            }

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing StreakMilestone event");
            throw;
        }
    }
}
