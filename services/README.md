# FitQuest Microservices Backend

This directory contains all the .NET 9 microservices for the FitQuest gamified fitness application.

## Architecture Overview

The FitQuest backend is built using a microservices architecture with the following components:

### Core Microservices

1. **Authentication Service** - User registration, login, JWT token management, password security
2. **User Profile Service** - User profile management, preferences, settings
3. **Workout Service** - Workout logging, exercise tracking, workout history
4. **XP & Progression Service** - XP calculation, level progression, muscle group ranks
5. **Exercise Library Service** - Exercise database, search, filtering, custom exercises
6. **Sync Service** - Data synchronization, conflict resolution, offline sync queue

### Infrastructure Services

- **PostgreSQL** - Primary database for all services
- **Redis** - Caching layer for performance optimization
- **RabbitMQ** - Message queue for asynchronous event-driven communication
- **API Gateway** - Request routing, rate limiting, authentication validation

## Technology Stack

- **Runtime**: .NET 9
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Message Queue**: RabbitMQ 3.12+
- **Containerization**: Docker
- **Orchestration**: Docker Compose (development), Kubernetes (production)

## Getting Started

### Prerequisites

- .NET 9 SDK
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)
- RabbitMQ 3.12+ (or use Docker)

### Local Development Setup

1. **Start infrastructure services**:
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL on port 5432
   - Redis on port 6379
   - RabbitMQ on port 5672 (AMQP) and 15672 (Management UI)

2. **Build and run Authentication Service**:
   ```bash
   cd services/AuthenticationService
   dotnet build
   dotnet run
   ```

   The service will be available at `http://localhost:5001`

3. **Verify the service is running**:
   ```bash
   curl http://localhost:5001/health
   ```

## API Endpoints

### Authentication Service

**Base URL**: `http://localhost:5001`

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token",
  "expiresIn": 900
}
```

#### Logout
```
POST /auth/logout
Authorization: Bearer {accessToken}

Response: 200 OK
```

#### Validate Password
```
POST /auth/validate-password
Content-Type: application/json

{
  "password": "SecurePassword123!"
}

Response:
{
  "isValid": true,
  "errors": []
}
```

#### Request Password Reset
```
POST /auth/password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: 200 OK
```

#### Confirm Password Reset
```
POST /auth/password-reset/confirm
Content-Type: application/json

{
  "token": "reset-token",
  "newPassword": "NewSecurePassword123!"
}

Response: 200 OK
```

## Password Requirements

Passwords must meet the following criteria:
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}';:"",.<>?/\|`~)

## Password Reuse Prevention

The system maintains a history of the last 5 passwords and prevents reuse of any of them.

## Database Migrations

Migrations are automatically applied when the service starts. To manually apply migrations:

```bash
cd services/AuthenticationService
dotnet ef database update
```

To create a new migration:

```bash
dotnet ef migrations add MigrationName
```

## Configuration

Configuration is managed through `appsettings.json` and environment variables.

### Environment Variables

```
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://+:5001
ConnectionStrings__DefaultConnection=Host=localhost;Database=fitquest_auth;Username=postgres;Password=postgres
ConnectionStrings__Redis=localhost:6379
Jwt__SecretKey=your-secret-key-change-in-production-minimum-32-characters
Jwt__RefreshSecretKey=your-refresh-secret-key-change-in-production-minimum-32-characters
Jwt__Issuer=fitquest
Jwt__Audience=fitquest-app
```

## Docker Deployment

### Build Docker Image

```bash
cd services/AuthenticationService
docker build -t fitquest-auth-service:latest .
```

### Run with Docker Compose

```bash
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f auth-service
```

## Testing

### Unit Tests

```bash
cd services/AuthenticationService
dotnet test
```

### Manual Testing with cURL

```bash
# Register
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

# Health Check
curl http://localhost:5001/health
```

## Troubleshooting

### Database Connection Issues

If you get a connection error, ensure:
1. PostgreSQL is running: `docker-compose ps postgres`
2. Connection string is correct in `appsettings.json`
3. Database exists: `createdb fitquest_auth`

### Redis Connection Issues

If you get a Redis connection error:
1. Ensure Redis is running: `docker-compose ps redis`
2. Check Redis connection string in `appsettings.json`
3. Test Redis connection: `redis-cli ping`

### Port Already in Use

If port 5001 is already in use:
1. Change the port in `appsettings.json`
2. Or kill the process using the port: `lsof -i :5001`

## Performance Considerations

- JWT tokens are cached in Redis for quick validation
- Password hashing uses bcrypt with salt
- Database queries are indexed for performance
- Connection pooling is configured for database connections

## Security Considerations

- All passwords are hashed with bcrypt
- JWT tokens have expiration times
- Refresh tokens are stored in Redis and can be revoked
- Password history prevents reuse
- Rate limiting should be implemented at the API Gateway level
- All data in transit should use TLS/SSL

## Next Steps

1. Implement User Profile Service
2. Implement Workout Service
3. Implement XP & Progression Service
4. Implement Exercise Library Service
5. Implement Sync Service
6. Set up API Gateway (Kong or Nginx)
7. Configure RabbitMQ for event-driven communication
8. Deploy to Kubernetes

## Contributing

When adding new services:
1. Follow the same project structure as AuthenticationService
2. Use Minimal APIs for lightweight endpoints
3. Implement proper error handling and logging
4. Add database migrations
5. Create comprehensive API documentation
6. Add unit and integration tests

## License

Proprietary - FitQuest
