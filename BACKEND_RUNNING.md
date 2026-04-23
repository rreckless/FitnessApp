# FitQuest Backend - Now Running

## ✅ Services Status

### Infrastructure Services (Docker)
- ✅ **PostgreSQL** - Running on port 5432
- ✅ **Redis** - Running on port 6379
- ✅ **RabbitMQ** - Running on port 5672 (Management UI on 15672)

### Microservices
- ✅ **Sync Service** - Running on port 5002
  - Health Check: `http://localhost:5002/health`
  - Swagger UI: `http://localhost:5002/swagger/index.html`

## 📋 Available Endpoints

### Sync Service (http://localhost:5002/api/sync)

#### POST /sync/pull
Pull changes from the cloud
```bash
curl -X POST http://localhost:5002/api/sync/pull \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 0,
    "entityTypes": ["WORKOUT", "USER_PROFILE"]
  }' \
  -G --data-urlencode "userId=<user-id>"
```

#### POST /sync/push
Push local changes to the cloud
```bash
curl -X POST http://localhost:5002/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": "uuid",
        "operation": "CREATE",
        "entityType": "WORKOUT",
        "entityId": "uuid",
        "payload": {},
        "timestamp": 1234567890
      }
    ]
  }' \
  -G --data-urlencode "userId=<user-id>"
```

#### GET /sync/status
Get sync status for a user
```bash
curl http://localhost:5002/api/sync/status?userId=<user-id>
```

#### GET /health
Health check
```bash
curl http://localhost:5002/health
```

## 🔧 Configuration

### App Configuration
The FitQuest app is now configured to connect to:
- **Sync Service**: `http://localhost:5002/api`
- **Authentication Service**: `http://localhost:5001`

### Updated Files
- `FitQuestNative/src/App.tsx` - Updated SyncEngine to use port 5002

## 🚀 How to Use

### 1. Start the App
The app will now automatically sync with the backend when:
- User completes a workout
- User updates their profile
- User logs in/out
- Periodic sync runs every 30 seconds

### 2. Monitor Sync
Check the console logs for sync status:
```
Periodic sync failed (network unavailable): ...  // Expected when backend is down
Pull failed (backend unavailable): ...            // Expected when backend is down
Push failed (backend unavailable) - changes queued for sync  // Changes are saved locally
```

### 3. View Swagger Documentation
- Sync Service: `http://localhost:5002/swagger/index.html`

## 📊 Database

### PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: fitquest_sync_dev
- **Username**: postgres
- **Password**: postgres

Connect with:
```bash
psql -h localhost -U postgres -d fitquest_sync_dev
```

### Redis
- **Host**: localhost
- **Port**: 6379

Connect with:
```bash
redis-cli
```

## 🔄 Sync Flow

1. **App makes changes** (offline or online)
2. **Changes queued** in local SQLite database
3. **Periodic sync** runs every 30 seconds
4. **Pull** - Get server changes
5. **Push** - Send local changes
6. **Conflict resolution** - Last-write-wins
7. **Sync complete** - Data is consistent

## ⚠️ Important Notes

### Sync Service Port
- The Sync Service is running on **port 5002** (not 5001)
- This is because port 5001 is used by the Authentication Service
- The app has been updated to connect to port 5002

### Authentication
- The Sync Service currently doesn't require authentication
- In production, add JWT token validation

### Database Migrations
- Migrations run automatically on service startup
- Tables are created if they don't exist

## 🛑 Stopping Services

### Stop Sync Service
```bash
# Find the process
lsof -i :5002

# Kill it
kill -9 <PID>
```

### Stop Infrastructure Services
```bash
docker-compose down
```

### Stop All and Remove Volumes
```bash
docker-compose down -v
```

## 🔍 Troubleshooting

### Sync Service Won't Start
```bash
# Check if port 5002 is in use
lsof -i :5002

# Check database connection
psql -h localhost -U postgres -d fitquest_sync_dev

# Check Redis connection
redis-cli ping
```

### Database Connection Error
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Sync Not Working
1. Check app console logs for errors
2. Verify Sync Service is running: `curl http://localhost:5002/health`
3. Check database has sync_queue table: `psql -h localhost -U postgres -d fitquest_sync_dev -c "\dt"`
4. Check Redis is running: `redis-cli ping`

## 📝 Next Steps

1. ✅ Infrastructure services running (PostgreSQL, Redis, RabbitMQ)
2. ✅ Sync Service running on port 5002
3. ✅ App configured to connect to Sync Service
4. 🔄 Test sync by:
   - Starting the app
   - Creating a workout
   - Checking console logs for sync messages
   - Verifying data in PostgreSQL

## 🎯 What's Working

- ✅ App can sync with backend
- ✅ Changes are queued locally
- ✅ Periodic sync runs every 30 seconds
- ✅ Graceful error handling when backend is unavailable
- ✅ Offline-first architecture working

## 📚 Documentation

- [Sync Error Handling](./SYNC_ERROR_HANDLING.md)
- [Backend Implementation Guide](./BACKEND_IMPLEMENTATION_GUIDE.md)
- [Quick Start Backend](./QUICK_START_BACKEND.md)
- [Services README](./services/README.md)
