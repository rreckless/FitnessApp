using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace XPProgressionService.Services;

public interface IRabbitMQPublisher
{
    Task PublishLevelUpAsync(Guid userId, int newLevel, int totalXP);
    Task PublishRankUpAsync(Guid userId, string muscleGroup, int newRank);
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

    public Task PublishLevelUpAsync(Guid userId, int newLevel, int totalXP)
    {
        return Task.Run(() =>
        {
            try
            {
                using (var channel = _connection.CreateModel())
                {
                    const string exchangeName = "fitquest.events";
                    const string routingKey = "xp.levelup";

                    channel.ExchangeDeclare(
                        exchange: exchangeName,
                        type: ExchangeType.Topic,
                        durable: true,
                        autoDelete: false);

                    var eventPayload = new
                    {
                        eventType = "LevelUp",
                        userId = userId,
                        newLevel = newLevel,
                        totalXP = totalXP,
                        timestamp = DateTime.UtcNow
                    };

                    var message = JsonSerializer.Serialize(eventPayload);
                    var body = Encoding.UTF8.GetBytes(message);

                    var properties = channel.CreateBasicProperties();
                    properties.Persistent = true;
                    properties.ContentType = "application/json";

                    channel.BasicPublish(
                        exchange: exchangeName,
                        routingKey: routingKey,
                        basicProperties: properties,
                        body: body);

                    _logger.LogInformation($"Published LevelUp event for user {userId} to level {newLevel}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error publishing LevelUp event: {ex.Message}");
                throw;
            }
        });
    }

    public Task PublishRankUpAsync(Guid userId, string muscleGroup, int newRank)
    {
        return Task.Run(() =>
        {
            try
            {
                using (var channel = _connection.CreateModel())
                {
                    const string exchangeName = "fitquest.events";
                    const string routingKey = "xp.rankup";

                    channel.ExchangeDeclare(
                        exchange: exchangeName,
                        type: ExchangeType.Topic,
                        durable: true,
                        autoDelete: false);

                    var eventPayload = new
                    {
                        eventType = "RankUp",
                        userId = userId,
                        muscleGroup = muscleGroup,
                        newRank = newRank,
                        timestamp = DateTime.UtcNow
                    };

                    var message = JsonSerializer.Serialize(eventPayload);
                    var body = Encoding.UTF8.GetBytes(message);

                    var properties = channel.CreateBasicProperties();
                    properties.Persistent = true;
                    properties.ContentType = "application/json";

                    channel.BasicPublish(
                        exchange: exchangeName,
                        routingKey: routingKey,
                        basicProperties: properties,
                        body: body);

                    _logger.LogInformation($"Published RankUp event for user {userId} to rank {newRank} for {muscleGroup}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error publishing RankUp event: {ex.Message}");
                throw;
            }
        });
    }
}
