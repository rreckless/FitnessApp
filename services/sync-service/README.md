# Sync Service

The Sync Service is a .NET 10 microservice responsible for managing data synchronization between local devices and the cloud. It implements bidirectional sync with conflict detection and resolution, sync queue management, and retry logic with exponential backoff.

## Features

- **Bidirectional Sync**: Push local changes to cloud and pull cloud changes to local
- **Conflict Detection and Resolution**: Last-write-wins strategy using timestamps
- **Sync Queue Management**: Track pending, syncing, synced, and failed sync operations
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s) with maximum 4 retries
- **Sync Status Tracking**: Monitor sync status (synced, syncing, pending)
- **Entity Types**: Support for Workout, Weight, Measurement, and Photo entities

## Architecture

### Technology Stack

- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL
- **Cache**: Redis
- **Containerization**: Docker
- **Orchestration**: Kubernetes

### Project Structure

```
sync-service/
├── Controllers/
│   └── SyncController.cs          # API endpoints
├── Services/
│   ├── ISyncService.cs            # Sync service interface
│   ├── SyncService.cs             # Sync service implementation
│   ├── IConflictResolutionService.cs  # Conflict resolution interface
│   ├── ConflictResolutionService.cs   # Conflict resolution implementation
│   ├── IRetryService.cs           # Retry service interface
│   └── RetryService.cs            # Retry service implementation
├── Data/
│   └── SyncDbContext.cs           # Entity Framework context
├── Models/
│   ├── SyncQueue.cs               # Sync queue entity
│   ├── SyncRequest.cs             # Request models
│   └── SyncResponse.cs            # Response models
├── Program.cs                     # Application entry point
├── appsettings.json               # Configuration
├── Dockerfile                     # Docker image definition
├── kubernetes-deployment.yaml     # Kubernetes deployment
└── kubernetes-service.yaml        # Kubernetes service
```

## API Endpoints

### POST /api/sync/push

Pushes local changes to the cloud.

**Request:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "operation": "CREATE",
      "entityType": "WORKOUT",
      "entityId": "550e8400-e29b-41d4-a716-446655440001",
      "payload": "{...}",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync push completed",
  "syncedItems": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "entityType": "WORKOUT",
      "entityId": "550e8400-e29b-41d4-a716-446655440001",
      "operation": "CREATE",
      "syncedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "failedItems": [],
  "syncedAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/sync/pull

Pulls changes from the cloud.

**Request:**
```json
{
  "lastSyncAt": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "changes": [
    {
      "operation": "UPDATE",
      "entityType": "WORKOUT",
      "entityId": "550e8400-e29b-41d4-a716-446655440001",
      "payload": "{...}",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "syncedAt": "2024-01-15T10:30:00Z"
}
```

### GET /api/sync/status

Gets the sync status for a user.

**Query Parameters:**
- `userId` (required): The user ID

**Response:**
```json
{
  "status": "synced",
  "pendingCount": 0,
  "syncingCount": 0,
  "failedCount": 0,
  "lastSyncAt": "2024-01-15T10:30:00Z",
  "lastSyncAttemptAt": "2024-01-15T10:30:00Z"
}
```

## Data Models

### SyncQueue

Represents a sync queue entry for tracking pending, syncing, synced, and failed sync operations.

```csharp
public class SyncQueue
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public SyncOperation Operation { get; set; }  // CREATE, UPDATE, DELETE
    public EntityType EntityType { get; set; }    // WORKOUT, WEIGHT, MEASUREMENT, PHOTO
    public Guid EntityId { get; set; }
    public string Payload { get; set; }
    public SyncStatus Status { get; set; }        // PENDING, SYNCING, SYNCED, FAILED
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

## Conflict Resolution

The Sync Service uses a **last-write-wins** strategy with timestamp-based ordering for conflict resolution:

1. When a conflict is detected (both local and cloud have been modified)
2. The entity with the most recent timestamp is used
3. If timestamps are equal, local data wins as a tiebreaker
4. Both versions are preserved in the sync queue for audit purposes

## Retry Logic

Failed sync operations are retried with exponential backoff:

- **Retry 1**: 1 second delay
- **Retry 2**: 2 seconds delay
- **Retry 3**: 4 seconds delay
- **Retry 4**: 8 seconds delay
- **Max Retries**: 4

After maximum retries are exceeded, the sync item is marked as failed and requires manual intervention.

## Setup and Deployment

### Prerequisites

- .NET 10 SDK
- PostgreSQL 14+
- Redis 7+
- Docker (for containerization)
- Kubernetes (for orchestration)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/sync-service
   ```

2. **Install dependencies**
   ```bash
   dotnet restore
   ```

3. **Configure database**
   - Update `appsettings.Development.json` with your PostgreSQL connection string
   - Run migrations: `dotnet ef database update`

4. **Run the service**
   ```bash
   dotnet run
   ```

5. **Access Swagger UI**
   - Navigate to `https://localhost:5001/swagger`

### Docker Deployment

1. **Build Docker image**
   ```bash
   docker build -t fitquest/sync-service:latest .
   ```

2. **Run Docker container**
   ```bash
   docker run -p 8080:8080 \
     -e ConnectionStrings__DefaultConnection="Host=postgres;Database=fitquest_sync;Username=postgres;Password=postgres" \
     -e ConnectionStrings__Redis="redis:6379" \
     fitquest/sync-service:latest
   ```

### Kubernetes Deployment

1. **Create namespace**
   ```bash
   kubectl create namespace fitquest
   ```

2. **Create secrets**
   ```bash
   kubectl create secret generic sync-service-secrets \
     --from-literal=database-connection-string="Host=postgres;Database=fitquest_sync;Username=postgres;Password=postgres" \
     --from-literal=redis-connection-string="redis:6379" \
     -n fitquest
   ```

3. **Deploy service**
   ```bash
   kubectl apply -f kubernetes-deployment.yaml
   kubectl apply -f kubernetes-service.yaml
   ```

4. **Verify deployment**
   ```bash
   kubectl get pods -n fitquest
   kubectl logs -f deployment/sync-service -n fitquest
   ```

## Testing

### Unit Tests

Run unit tests:
```bash
dotnet test
```

### Integration Tests

Integration tests use an in-memory database and Redis mock:
```bash
dotnet test --filter "Category=Integration"
```

### Property-Based Tests

Property-based tests verify universal properties across all inputs:
```bash
dotnet test --filter "Category=PropertyBased"
```

## Monitoring and Observability

### Health Check

The service exposes a health check endpoint at `GET /health`:

```bash
curl http://localhost:8080/health
```

### Logging

Logs are written to console and can be aggregated using ELK Stack or Loki.

### Metrics

Prometheus metrics are exposed at `GET /metrics` (if Prometheus middleware is configured).

## Requirements Validation

This service validates the following requirements:

- **Requirement 24.1**: WHEN a user completes a workout, THE Cloud_System SHALL sync data to cloud servers within 30 seconds (or immediately if online)
- **Requirement 24.2**: WHEN a user logs in on a new device, THE Cloud_System SHALL restore all user data from cloud
- **Requirement 24.3**: THE Cloud_System SHALL maintain data backups with at least 30-day retention
- **Requirement 24.4**: IF a sync conflict occurs, THE Offline_System SHALL resolve by using the most recent timestamp
- **Requirement 24.5**: THE Offline_System SHALL display sync status indicator (synced, syncing, pending)
- **Requirement 24.6**: THE Offline_System SHALL maintain at least 30 days of workout history locally

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## License

This project is licensed under the MIT License.
