# Sync Service

Sync Service manages bidirectional synchronization between mobile clients and cloud backend with conflict detection and resolution.

## Features

- Bidirectional sync with conflict detection
- Last-write-wins conflict resolution using timestamps
- Sync queue management with retry logic
- Exponential backoff (1s, 2s, 4s, 8s)
- Background sync queue processor
- Conflict tracking and resolution history

## API Endpoints

### Pull Changes
```
POST /sync/pull
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "lastSyncTimestamp": 1704067200
}
```
Returns all changes since the last sync timestamp.

### Push Changes
```
POST /sync/push
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "changes": [
    {
      "operation": "CREATE",
      "entityType": "WORKOUT",
      "entityId": "550e8400-e29b-41d4-a716-446655440001",
      "payload": "{...}",
      "timestamp": 1704067200
    }
  ]
}
```
Pushes local changes to cloud. Returns conflicts if any.

### Get Sync Status
```
GET /sync/status
Authorization: Bearer <token>
```
Returns current sync status including pending, syncing, and failed counts.

## Database Schema

### sync_queue_entries table
- id (UUID, PK)
- user_id (UUID, FK)
- operation (VARCHAR) - CREATE, UPDATE, DELETE
- entity_type (VARCHAR) - WORKOUT, WEIGHT, MEASUREMENT, PHOTO
- entity_id (UUID)
- payload (JSONB)
- status (VARCHAR) - PENDING, SYNCING, SYNCED, FAILED
- retry_count (INTEGER)
- last_error (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- synced_at (TIMESTAMP, nullable)
- timestamp (BIGINT) - Unix timestamp for conflict resolution

### sync_conflicts table
- id (UUID, PK)
- user_id (UUID, FK)
- entity_type (VARCHAR)
- entity_id (UUID)
- local_version (JSONB)
- cloud_version (JSONB)
- local_timestamp (BIGINT)
- cloud_timestamp (BIGINT)
- resolution_strategy (VARCHAR) - LAST_WRITE_WINS, MANUAL
- resolved_version (JSONB, nullable)
- created_at (TIMESTAMP)
- resolved_at (TIMESTAMP, nullable)

## Conflict Resolution

The service uses **last-write-wins** strategy:
1. Compare timestamps of local and cloud versions
2. If cloud version is newer, cloud version wins
3. If local version is newer, local version wins
4. Conflict is recorded for audit trail

## Retry Logic

Exponential backoff with maximum 4 retries:
- Retry 1: 1 second delay
- Retry 2: 2 second delay
- Retry 3: 4 second delay
- Retry 4: 8 second delay

After 4 failed retries, entry is marked as FAILED.

## Background Processing

The `SyncQueueProcessorService` runs every 5 seconds and:
1. Fetches pending entries with retry count < max retries
2. Attempts to sync each entry
3. Updates status based on result
4. Calculates next retry time using exponential backoff

## Configuration

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_sync;Username=postgres;Password=postgres"
  },
  "Sync": {
    "MaxRetries": 4,
    "ProcessingIntervalSeconds": 5
  }
}
```

## Running Locally

```bash
# Build
dotnet build

# Run migrations
dotnet ef database update

# Run
dotnet run
```

## Docker

```bash
# Build image
docker build -f SyncService/Dockerfile -t fitquest-sync-service .

# Run container
docker run -p 5006:8080 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_sync;Username=postgres;Password=postgres" \
  fitquest-sync-service
```

## Testing

```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test /p:CollectCoverage=true
```

## Performance Targets

- Pull changes: < 100ms
- Push changes: < 200ms
- Sync status: < 50ms
- Conflict detection: < 10ms per entry

## Security

- JWT authentication required for all endpoints
- User can only sync their own data
- Timestamps validated to prevent tampering
- Conflict resolution logged for audit trail

## Dependencies

- Entity Framework Core 8.0
- Npgsql 8.0
- System.IdentityModel.Tokens.Jwt 7.0

## Future Enhancements

- Manual conflict resolution UI
- Selective sync (sync only specific entity types)
- Bandwidth optimization (delta sync)
- Compression for large payloads
- Sync analytics and monitoring
