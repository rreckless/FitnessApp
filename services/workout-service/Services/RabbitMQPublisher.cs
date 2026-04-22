using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace WorkoutService.Services;

public interface IRabbitMQPublisher
{
    Task PublishWorkoutCompletedAsync(Guid workoutId, Guid userId, int totalVolume, int totalXP);
}

public class RabbitMQPublisher : IRabbitMQPublisher
{
    private readonly IConnection _connection;
    private readonly ILogger<RabbitMQPublisher> _logger;

    public RabbitMQPublisher(IConnection connection, ILogger<RabbitMQPublisher> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public Task PublishWorkoutCompletedAsync(Guid workoutId, Guid userId, int totalVolume, int totalXP)
    {
        return Task.Run(() =>
        {
            try
            {
                using (var channel = _connection.CreateModel())
                {
                    const string exchangeName = "fitquest.events";
                    const string routingKey = "workout.completed";

                    // Declare exchange
                    channel.ExchangeDeclare(
                        exchange: exchangeName,
                        type: ExchangeType.Topic,
                        durable: true,
                        autoDelete: false);

                    // Create event payload
                    var eventPayload = new
                    {
                        eventType = "WorkoutCompleted",
                        workoutId = workoutId,
                        userId = userId,
                        totalVolume = totalVolume,
                        totalXP = totalXP,
                        timestamp = DateTime.UtcNow
                    };

                    var message = JsonSerializer.Serialize(eventPayload);
                    var body = Encoding.UTF8.GetBytes(message);

                    // Publish message
                    var properties = channel.CreateBasicProperties();
                    properties.Persistent = true;
                    properties.ContentType = "application/json";

                    channel.BasicPublish(
                        exchange: exchangeName,
                        routingKey: routingKey,
                        basicProperties: properties,
                        body: body);

                    _logger.LogInformation($"Published WorkoutCompleted event for workout {workoutId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error publishing WorkoutCompleted event: {ex.Message}");
                throw;
            }
        });
    }
}
