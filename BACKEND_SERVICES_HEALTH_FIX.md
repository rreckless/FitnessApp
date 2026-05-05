# Backend Services Health Check Fix

## Issue
Auth and Sync services were marked as "unhealthy" in Docker, even though they were running and responding to requests.

## Root Cause
The Docker health checks in both Dockerfiles were using `curl` to test the `/health` endpoints, but `curl` was not installed in the .NET 9 runtime image (`mcr.microsoft.com/dotnet/aspnet:9.0`).

When Docker tried to run the health check command:
```bash
CMD curl -f http://localhost:5002/health || exit 1
```

It failed because `curl` was not found, causing the health check to fail repeatedly.

## Solution
Updated both Dockerfiles to install `curl` in the runtime stage before the health check is configured.

### Changes Made

#### 1. services/sync-service/Dockerfile
Added `curl` installation in the runtime stage:
```dockerfile
# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published application
COPY --from=publish /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

# ... rest of Dockerfile
```

#### 2. services/AuthenticationService/Dockerfile
Added `curl` installation in the runtime stage:
```dockerfile
# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published application
COPY --from=publish /app/publish .

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# ... rest of Dockerfile
```

## Verification

### Before Fix
```
STATUS: Up 10 hours (unhealthy)
```

### After Fix
```
STATUS: Up 12 seconds (healthy)
```

### Health Check Results
```bash
$ curl http://localhost:5001/health
{"status":"healthy"}

$ curl http://localhost:5002/health
{"status":"healthy"}
```

## Services Status

All services are now healthy:
- ✅ **Auth Service** (port 5001) - Healthy
- ✅ **Sync Service** (port 5002) - Healthy
- ✅ **PostgreSQL** (port 5432) - Healthy
- ✅ **Redis** (port 6379) - Healthy
- ✅ **RabbitMQ** (port 5672) - Healthy

## Next Steps

1. The app will now be able to sync with the backend
2. Queued changes will be pushed to the backend
3. New changes will sync in real-time (every 30 seconds)
4. The "Backend unavailable - working offline" message should no longer appear

## Files Modified
- `services/sync-service/Dockerfile`
- `services/AuthenticationService/Dockerfile`

## Testing

To verify the fix is working:
1. Restart the app
2. Complete onboarding
3. Check console logs for sync success messages
4. Verify preferences are synced to backend

The app should now work seamlessly with the backend services!
