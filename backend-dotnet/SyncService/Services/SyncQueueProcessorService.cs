namespace SyncService.Services;

public class SyncQueueProcessorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SyncQueueProcessorService> _logger;
    private readonly int _processingIntervalSeconds;

    public SyncQueueProcessorService(
        IServiceProvider serviceProvider,
        ILogger<SyncQueueProcessorService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _processingIntervalSeconds = configuration.GetValue<int>("Sync:ProcessingIntervalSeconds", 5);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Sync Queue Processor Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
                    await syncService.ProcessSyncQueueAsync();
                }

                await Task.Delay(TimeSpan.FromSeconds(_processingIntervalSeconds), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Sync Queue Processor Service");
                await Task.Delay(TimeSpan.FromSeconds(_processingIntervalSeconds), stoppingToken);
            }
        }

        _logger.LogInformation("Sync Queue Processor Service stopped");
    }
}
