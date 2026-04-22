using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using XPProgressionService.Data;

namespace XPProgressionService.Services;

public interface IRabbitMQConsumer
{
    Task StartListeningAsync();
}

public class RabbitMQConsumer : IRabbitMQConsumer
{
    private readonly IConnection _connection;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RabbitMQConsumer> _logger;

    public RabbitMQConsumer(IConnection connection, IServiceProvider serviceProvider, ILogger<RabbitMQConsumer> logger)
    {
        _connection = connection;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartListeningAsync()
    {
        try
        {
            using (var channel = _connection.CreateModel())
            {
                const string exchangeName = "fitquest.events";
                const string queueName = "xp-progression-service.workout-completed";
                const string routingKey = "workout.completed";

                // Declare exchange
                channel.ExchangeDeclare(
                    exchange: exchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false);

                // Declare queue
                channel.QueueDeclare(
                    queue: queueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false);

                // Bind queue to exchange
                channel.QueueBind(
                    queue: queueName,
                    exchange: exchangeName,
                    routingKey: routingKey);

                // Set up consumer
                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (model, ea) =>
                {
                    try
                    {
                        var body = ea.Body.ToArray();
                        var message = Encoding.UTF8.GetString(body);
                        var workoutEvent = JsonSerializer.Deserialize<WorkoutCompletedEvent>(message);

                        if (workoutEvent != null)
                        {
                            await ProcessWorkoutCompletedAsync(workoutEvent);
                            channel.BasicAck(ea.DeliveryTag, false);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Error processing message: {ex.Message}");
                        channel.BasicNack(ea.DeliveryTag, false, true);
                    }
                };

                channel.BasicConsume(
                    queue: queueName,
                    autoAck: false,
                    consumerTag: "xp-progression-consumer",
                    consumer: consumer);

                _logger.LogInformation("RabbitMQ consumer started, listening for WorkoutCompleted events");

                // Keep the consumer running
                await Task.Delay(Timeout.Infinite);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error in RabbitMQ consumer: {ex.Message}");
            throw;
        }
    }

    private async Task ProcessWorkoutCompletedAsync(WorkoutCompletedEvent workoutEvent)
    {
        using (var scope = _serviceProvider.CreateScope())
        {
            var xpProgressionService = scope.ServiceProvider.GetRequiredService<IXPProgressionService>();
            var muscleGroupRankService = scope.ServiceProvider.GetRequiredService<IMuscleGroupRankService>();
            var rabbitMQPublisher = scope.ServiceProvider.GetRequiredService<IRabbitMQPublisher>();

            _logger.LogInformation($"Processing WorkoutCompleted event for user {workoutEvent.UserId}, workout {workoutEvent.WorkoutId}");

            // Add XP to user
            var userXP = await xpProgressionService.AddXPAsync(
                workoutEvent.UserId,
                workoutEvent.TotalXP,
                "WorkoutCompleted",
                workoutEvent.WorkoutId);

            // Check if user leveled up
            var (leveledUp, newLevel) = await xpProgressionService.ProcessLevelUpAsync(workoutEvent.UserId);
            if (leveledUp)
            {
                await rabbitMQPublisher.PublishLevelUpAsync(workoutEvent.UserId, newLevel, userXP.TotalXP);
            }

            _logger.LogInformation($"Processed WorkoutCompleted event. User {workoutEvent.UserId} now has {userXP.TotalXP} XP at level {userXP.CurrentLevel}");
        }
    }
}

public class WorkoutCompletedEvent
{
    public string? EventType { get; set; }
    public Guid WorkoutId { get; set; }
    public Guid UserId { get; set; }
    public int TotalVolume { get; set; }
    public int TotalXP { get; set; }
    public DateTime Timestamp { get; set; }
}
