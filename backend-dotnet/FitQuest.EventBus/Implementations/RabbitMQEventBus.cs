using System.Text;
using System.Text.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using FitQuest.EventBus.Abstractions;

namespace FitQuest.EventBus.Implementations;

public class RabbitMQEventBus : IEventBus
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;
    private readonly string _exchangeName;

    public RabbitMQEventBus(IConnection connection, string exchangeName = "fitquest.events")
    {
        _connection = connection;
        _exchangeName = exchangeName;
        _channel = _connection.CreateChannelAsync().Result;
        _channel.ExchangeDeclareAsync(_exchangeName, ExchangeType.Topic, durable: true).Wait();
    }

    public async Task PublishAsync<T>(T @event, CancellationToken cancellationToken = default) where T : class
    {
        var eventName = typeof(T).Name;
        var routingKey = $"events.{eventName}";
        var message = JsonSerializer.Serialize(@event);
        var body = Encoding.UTF8.GetBytes(message);

        var properties = new BasicProperties
        {
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent
        };

        await _channel.BasicPublishAsync(
            exchange: _exchangeName,
            routingKey: routingKey,
            mandatory: false,
            basicProperties: properties,
            body: new ReadOnlyMemory<byte>(body),
            cancellationToken: cancellationToken
        );
    }

    public async Task SubscribeAsync<T>(Func<T, CancellationToken, Task> handler, CancellationToken cancellationToken = default) where T : class
    {
        var eventName = typeof(T).Name;
        var queueName = $"fitquest.{eventName}.queue";
        var routingKey = $"events.{eventName}";

        await _channel.QueueDeclareAsync(queueName, durable: true, exclusive: false, autoDelete: false, arguments: null, cancellationToken: cancellationToken);
        await _channel.QueueBindAsync(queueName, _exchangeName, routingKey, arguments: null, cancellationToken: cancellationToken);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            var @event = JsonSerializer.Deserialize<T>(message);

            if (@event != null)
            {
                await handler(@event, cancellationToken);
            }

            await _channel.BasicAckAsync(ea.DeliveryTag, false, cancellationToken);
        };

        await _channel.BasicConsumeAsync(queueName, autoAck: false, consumerTag: eventName, consumer: consumer, cancellationToken: cancellationToken);
    }
}
