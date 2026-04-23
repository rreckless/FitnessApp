# FitQuest Backend - Quick Start Guide

## Prerequisites

- .NET 9 SDK installed
- Docker and Docker Compose installed
- Git

## Quick Start (5 minutes)

### 1. Start Infrastructure Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- RabbitMQ (port 5672, UI on 15672)

### 2. Build and Run Authentication Service

```bash
cd services/AuthenticationService
dotnet build
dotnet run
```

The service will start on `http://localhost:5001`

### 3. Test the Service

```bash
# Health check
curl http://localhost:5001/health

# Register a new user
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

### 4. View API Documentation

Open your browser and go to:
- Swagger UI: `http://localhost:5001/swagger/index.html`
- OpenAPI JSON: `http://localhost:5001/openapi/v1.json`

## Common Commands

### View Docker Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

### Rebuild Docker Images

```bash
docker-compose build --no-cache
```

## Database Access

### Connect to PostgreSQL

```bash
psql -h localhost -U postgres -d fitquest_auth
```

Password: `postgres`

### Common PostgreSQL Commands

```sql
-- List databases
\l

-- Connect to database
\c fitquest_auth

-- List tables
\dt

-- Describe table
\d users

-- Query users
SELECT * FROM "Users";

-- Query password history
SELECT * FROM "PasswordHistories";
```

## Redis Access

### Connect to Redis

```bash
redis-cli
```

### Common Redis Commands

```bash
# Ping
PING

# Get all keys
KEYS *

# Get specific key
GET refresh_token:user-id

# Delete key
DEL refresh_token:user-id

# Flush all
FLUSHALL
```

## RabbitMQ Management UI

Access the RabbitMQ management interface at:
- URL: `http://localhost:15672`
- Username: `guest`
- Password: `guest`

## Troubleshooting

### Port Already in Use

If port 5001 is already in use:

```bash
# Find process using port
lsof -i :5001

# Kill process
kill -9 <PID>
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Error

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Build Errors

```bash
# Clean build
dotnet clean
dotnet build

# Restore packages
dotnet restore
```

## Next Steps

1. ✅ Authentication Service is running
2. 🔄 Build User Profile Service
3. 🔄 Build Workout Service
4. 🔄 Build XP & Progression Service
5. 🔄 Build Exercise Library Service
6. 🔄 Build Sync Service
7. ⏳ Set up API Gateway
8. ⏳ Configure RabbitMQ event routing
9. ⏳ Deploy to Kubernetes

## Documentation

- [Backend Implementation Guide](./BACKEND_IMPLEMENTATION_GUIDE.md)
- [Services README](./services/README.md)
- [FitQuest Design Document](./.kiro/specs/fitquest-gamified-fitness/design.md)
- [FitQuest Requirements](./.kiro/specs/fitquest-gamified-fitness/requirements.md)

## Support

For detailed information, see:
- `BACKEND_IMPLEMENTATION_GUIDE.md` - Comprehensive implementation guide
- `services/README.md` - Services documentation
- `.kiro/specs/fitquest-gamified-fitness/` - Specification documents

## API Endpoints

### Authentication Service (http://localhost:5001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login user |
| POST | /auth/refresh | Refresh JWT token |
| POST | /auth/logout | Logout user |
| POST | /auth/password-reset | Request password reset |
| POST | /auth/password-reset/confirm | Confirm password reset |
| POST | /auth/validate-password | Validate password strength |
| GET | /health | Health check |

## Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Environment Variables

```
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://+:5001
ConnectionStrings__DefaultConnection=Host=postgres;Database=fitquest_auth;Username=postgres;Password=postgres
ConnectionStrings__Redis=redis:6379
Jwt__SecretKey=your-secret-key-change-in-production-minimum-32-characters
Jwt__RefreshSecretKey=your-refresh-secret-key-change-in-production-minimum-32-characters
```

## Performance Targets

- App launch: < 1000ms
- API response time: < 200ms (p95)
- Health check: < 50ms
- Login: < 500ms
- Register: < 1000ms

## Security Notes

- All passwords are hashed with bcrypt
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Password history prevents reuse of last 5 passwords
- All data in transit should use TLS/SSL in production
- Change JWT secrets in production!

## Monitoring

### Health Check

```bash
curl http://localhost:5001/health
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service
```

### Database Monitoring

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d fitquest_auth

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema') 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Development Tips

1. **Use Swagger UI** for testing endpoints: `http://localhost:5001/swagger`
2. **Check logs** for debugging: `docker-compose logs -f auth-service`
3. **Use PostgreSQL client** to inspect data: `psql -h localhost -U postgres -d fitquest_auth`
4. **Use Redis CLI** to check cache: `redis-cli`
5. **Use RabbitMQ UI** to monitor messages: `http://localhost:15672`

## Performance Optimization

- Database queries are indexed
- Redis caching for tokens and profiles
- Connection pooling for database
- Async/await for non-blocking operations
- Minimal API overhead

## Security Best Practices

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens with expiration
- ✅ Refresh token rotation
- ✅ Password history tracking
- ✅ CORS configured
- ⚠️ Change JWT secrets in production
- ⚠️ Use HTTPS in production
- ⚠️ Implement rate limiting at API Gateway

## What's Next?

After the Authentication Service is running:

1. **User Profile Service** - Manage user profiles and preferences
2. **Workout Service** - Log and track workouts
3. **XP & Progression Service** - Calculate XP and level progression
4. **Exercise Library Service** - Manage exercise database
5. **Sync Service** - Handle offline sync and conflict resolution

See `BACKEND_IMPLEMENTATION_GUIDE.md` for detailed implementation steps.
