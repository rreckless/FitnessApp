using Xunit;
using SyncService.Services;
using SyncService.Data;
using SyncService.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace SyncService.Tests;

/// <summary>
/// Unit tests for SyncService.
/// </summary>
public class SyncServiceTests
{
    private readonly SyncDbContext _dbContext;
    private readonly Mock<IConflictResolutionService> _mockConflictService;
    private readonly Mock<IRetryService> _mockRetryService;
    private readonly Mock<ILogger<SyncService.Services.SyncService>> _mockLogger;
    private readonly SyncService.Services.SyncService _service;

    public SyncServiceTests()
    {
        var options = new DbContextOptionsBuilder<SyncDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _dbContext = new SyncDbContext(options);
        _mockConflictService = new Mock<IConflictResolutionService>();
        _mockRetryService = new Mock<IRetryService>();
        _mockLogger = new Mock<ILogger<SyncService.Services.SyncService>>();

        _service = new SyncService.Services.SyncService(
            _dbContext,
            _mockConflictService.Object,
            _mockRetryService.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task PushAsync_WithValidRequest_CreatesQueueEntries()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var request = new SyncPushRequest
        {
            Items = new List<SyncQueueItem>
            {
                new SyncQueueItem
                {
                    Id = Guid.NewGuid(),
                    Operation = "CREATE",
                    EntityType = "WORKOUT",
                    EntityId = Guid.NewGuid(),
                    Payload = "{\"name\": \"Test Workout\"}",
                    UpdatedAt = DateTime.UtcNow
                }
            }
        };

        _mockConflictService.Setup(x => x.DetectConflict(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .Returns(false);

        // Act
        var response = await _service.PushAsync(userId, request);

        // Assert
        Assert.True(response.Success);
        Assert.Single(response.SyncedItems);
        Assert.Empty(response.FailedItems);

        var queueEntry = await _dbContext.SyncQueues.FirstOrDefaultAsync(sq => sq.UserId == userId);
        Assert.NotNull(queueEntry);
        Assert.Equal(SyncStatus.Pending, queueEntry.Status);
    }

    [Fact]
    public async Task PushAsync_WithConflict_ResolvesConflict()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var entityId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var oldTime = DateTime.UtcNow;
        var newTime = oldTime.AddSeconds(10);

        // Create existing entry
        var existingEntry = new SyncQueue
        {
            Id = itemId,
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = entityId,
            Payload = "{\"old\": \"data\"}",
            Status = SyncStatus.Synced,
            RetryCount = 0,
            CreatedAt = oldTime,
            UpdatedAt = oldTime
        };

        _dbContext.SyncQueues.Add(existingEntry);
        await _dbContext.SaveChangesAsync();

        var request = new SyncPushRequest
        {
            Items = new List<SyncQueueItem>
            {
                new SyncQueueItem
                {
                    Id = itemId,
                    Operation = "Update",
                    EntityType = "Workout",
                    EntityId = entityId,
                    Payload = "{\"new\": \"data\"}",
                    UpdatedAt = newTime
                }
            }
        };

        _mockConflictService.Setup(x => x.DetectConflict(newTime, oldTime))
            .Returns(true);
        _mockConflictService.Setup(x => x.ResolveConflict(newTime, oldTime))
            .Returns((true, newTime));

        // Act
        var response = await _service.PushAsync(userId, request);

        // Assert
        Assert.True(response.Success);
        Assert.Single(response.SyncedItems);

        var updatedEntry = await _dbContext.SyncQueues.FirstAsync(sq => sq.Id == itemId);
        Assert.Equal(newTime, updatedEntry.UpdatedAt);
        Assert.Equal(SyncStatus.Pending, updatedEntry.Status);
    }

    [Fact]
    public async Task PullAsync_WithoutLastSyncAt_ReturnsAllSyncedItems()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var syncedItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{\"name\": \"Test\"}",
            Status = SyncStatus.Synced,
            RetryCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.SyncQueues.Add(syncedItem);
        await _dbContext.SaveChangesAsync();

        var request = new SyncPullRequest { LastSyncAt = null };

        // Act
        var response = await _service.PullAsync(userId, request);

        // Assert
        Assert.Single(response.Changes);
        Assert.Equal("Create", response.Changes[0].Operation);
    }

    [Fact]
    public async Task PullAsync_WithLastSyncAt_ReturnsOnlyNewerItems()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var oldTime = DateTime.UtcNow.AddHours(-1);
        var newTime = DateTime.UtcNow;

        var oldItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{\"old\": true}",
            Status = SyncStatus.Synced,
            RetryCount = 0,
            CreatedAt = oldTime,
            UpdatedAt = oldTime
        };

        var newItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Update,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{\"new\": true}",
            Status = SyncStatus.Synced,
            RetryCount = 0,
            CreatedAt = newTime,
            UpdatedAt = newTime
        };

        _dbContext.SyncQueues.AddRange(oldItem, newItem);
        await _dbContext.SaveChangesAsync();

        var request = new SyncPullRequest { LastSyncAt = oldTime.AddSeconds(30) };

        // Act
        var response = await _service.PullAsync(userId, request);

        // Assert
        Assert.Single(response.Changes);
        Assert.Equal("Update", response.Changes[0].Operation);
    }

    [Fact]
    public async Task GetStatusAsync_ReturnsCorrectCounts()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var pendingItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{}",
            Status = SyncStatus.Pending,
            RetryCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        var syncingItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{}",
            Status = SyncStatus.Syncing,
            RetryCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        var failedItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{}",
            Status = SyncStatus.Failed,
            RetryCount = 1,
            LastError = "Test error",
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.SyncQueues.AddRange(pendingItem, syncingItem, failedItem);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _service.GetStatusAsync(userId);

        // Assert
        Assert.Equal("syncing", response.Status);
        Assert.Equal(1, response.PendingCount);
        Assert.Equal(1, response.SyncingCount);
        Assert.Equal(1, response.FailedCount);
    }

    [Fact]
    public async Task ProcessPendingItemsAsync_ProcessesPendingItems()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var pendingItem = new SyncQueue
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Operation = SyncOperation.Create,
            EntityType = EntityType.Workout,
            EntityId = Guid.NewGuid(),
            Payload = "{}",
            Status = SyncStatus.Pending,
            RetryCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.SyncQueues.Add(pendingItem);
        await _dbContext.SaveChangesAsync();

        _mockRetryService.Setup(x => x.ShouldRetry(It.IsAny<int>())).Returns(true);

        // Act
        int processedCount = await _service.ProcessPendingItemsAsync(userId);

        // Assert
        Assert.Equal(1, processedCount);

        var updatedItem = await _dbContext.SyncQueues.FirstAsync(sq => sq.Id == pendingItem.Id);
        Assert.Equal(SyncStatus.Synced, updatedItem.Status);
    }
}
