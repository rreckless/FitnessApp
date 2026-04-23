# FitQuest Backend Implementation Guide

## Overview

This guide provides a comprehensive overview of the FitQuest .NET microservices backend implementation. The backend is built using .NET 9 with ASP.NET Core Minimal APIs, PostgreSQL, Redis, and RabbitMQ.

## Project Structure

```
services/
├── AuthenticationService/          # ✅ COMPLETED
│   ├── Models/
│   │   ├── User.cs
│   │   └── PasswordHistory.cs
│   ├── Data/
│   │   └── AuthDbContext.cs
│   ├── DTOs/
│   │   ├── AuthRequest.cs
│   │   └── AuthResponse.cs
│   ├── Services/
│   │   ├── PasswordValidator.cs
│   │   └── AuthenticationService.cs
│   ├── Migrations/
│   │   ├── InitialCreate.cs
│   │   └── AuthDbContextModelSnapshot.cs
│   ├── Program.cs
│   ├── appsettings.json
│   ├── AuthenticationService.csproj
│   └── Dockerfile
├── UserProfileService/             # 🔄 IN PROGRESS
├── WorkoutService/                 # 🔄 IN PROGRESS
├── XPProgressionService/           # 🔄 IN PROGRESS
├── ExerciseLibraryService/         # 🔄 IN PROGRESS
├── SyncService/                    # 🔄 IN PROGRESS
├── LeaderboardService/             # ⏳ PLANNED
├── SocialService/                  # ⏳ PLANNED
├── AchievementService/             # ⏳ PLANNED
├── ProgressTrackingService/        # ⏳ PLANNED
├── BodyTrackingService/            # ⏳ PLANNED
├── GPSRouteService/                # ⏳ PLANNED
├── PremiumSubscriptionService/     # ⏳ PLANNED
├── AITrainerService/               # ⏳ PLANNED
├── README.md
└── docker-compose.yml

FitQuestNative/                     # iOS React Native App
├── src/
│   ├── services/
│   │   ├── AuthenticationService.ts
│   │   ├── UserProfileService.ts
│   │   ├── WorkoutLogger.ts
│   │   ├── ExerciseLibraryService.ts
│   │   └── SyncEngine.ts
│   └── ...
└── ...
```

## Phase 1: Core Microservices (COMPLETED)

### ✅ Authentication Service

**Status**: COMPLETED

**Features Implemented**:
- User registration with email validation
- Password strength validation (12+ chars, uppercase, lowercase, number, special char)
- Password reuse prevention (5-password history)
- User login with JWT token generation
- Refresh token rotation
- Logout with token blacklist (Redis)
- Password reset flow with email verification
- Device fingerprinting support

**Key Files**:
- `Models/User.cs` - User entity
- `Models/PasswordHistory.cs` - Password history tracking
- `Data/AuthDbContext.cs` - EF Core database context
- `Services/PasswordValidator.cs` - Password validation logic
- `Services/AuthenticationService.cs` - Core authentication logic
- `Program.cs` - API endpoints and configuration
- `Dockerfile` - Multi-stage Docker build

**Database Schema**:
- `Users` table - User accounts
- `PasswordHistories` table - Password history for reuse prevention

**API Endpoints**:
- `POST /auth/register` - Create new account
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Invalidate session
- `POST /auth/password-reset` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm reset with token
- `POST /auth/validate-password` - Validate password strength
- `GET /health` - Health check

**Testing**:
```bash
# Register
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'

# Login
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

## Phase 2: Remaining Core Services (IN PROGRESS)

### 🔄 User Profile Service

**Status**: READY TO IMPLEMENT

**Requirements**:
- GET /users/:id - Get user profile
- PUT /users/:id - Update profile
- GET /users/:id/preferences - Get user preferences
- PUT /users/:id/preferences - Update preferences
- POST /users/:id/avatar - Upload profile picture

**Models**:
- User (shared with Auth Service)
- UserPreferences

**Database Tables**:
- users (shared)
- user_preferences

**Implementation Steps**:
1. Create UserProfileService project
2. Create User and UserPreferences models
3. Create UserProfileDbContext
4. Implement profile CRUD endpoints
5. Implement preference management
6. Add S3 integration for avatar upload
7. Create Dockerfile
8. Add to docker-compose.yml

### 🔄 Workout Service

**Status**: READY TO IMPLEMENT

**Requirements**:
- POST /workouts - Create workout
- GET /workouts - List user workouts (paginated)
- GET /workouts/:id - Get workout details
- PUT /workouts/:id - Update workout
- DELETE /workouts/:id - Delete workout
- POST /workouts/:id/complete - Mark workout complete
- Publish WorkoutCompleted event to message queue

**Models**:
- Workout
- WorkoutExercise
- WorkoutSet

**Database Tables**:
- workouts
- workout_exercises
- workout_sets

**Implementation Steps**:
1. Create WorkoutService project
2. Create Workout, WorkoutExercise, WorkoutSet models
3. Create WorkoutDbContext
4. Implement workout CRUD endpoints
5. Implement volume calculation
6. Implement RabbitMQ event publishing
7. Create Dockerfile
8. Add to docker-compose.yml

### 🔄 XP & Progression Service

**Status**: READY TO IMPLEMENT

**Requirements**:
- GET /users/:id/xp - Get XP and level info
- GET /users/:id/muscle-groups - Get muscle group ranks
- GET /users/:id/progression - Get progression history
- XP calculation: max(volume / 100, 10) × difficulty multiplier
- Level progression with cumulative XP thresholds
- Muscle group rank tracking by volume
- Subscribe to WorkoutCompleted events
- Publish LevelUp and RankUp events

**Models**:
- UserXP
- MuscleGroupRank

**Database Tables**:
- user_xp
- muscle_group_ranks

**Implementation Steps**:
1. Create XPProgressionService project
2. Create UserXP and MuscleGroupRank models
3. Create XPDbContext
4. Implement XP calculation engine
5. Implement level progression logic
6. Implement muscle group rank tracking
7. Subscribe to WorkoutCompleted events
8. Publish LevelUp and RankUp events
9. Create Dockerfile
10. Add to docker-compose.yml

### 🔄 Exercise Library Service

**Status**: READY TO IMPLEMENT

**Requirements**:
- GET /exercises - List exercises (with search/filter)
- GET /exercises/:id - Get exercise details
- GET /exercises/muscle-groups/:group - Get exercises by muscle group
- 200+ built-in exercises with muscle group categorization
- Support for custom user-specific exercises

**Models**:
- Exercise
- CustomExercise

**Database Tables**:
- exercises
- custom_exercises

**Implementation Steps**:
1. Create ExerciseLibraryService project
2. Create Exercise and CustomExercise models
3. Create ExerciseDbContext
4. Implement exercise search and filtering
5. Seed 200+ built-in exercises
6. Implement custom exercise support
7. Add Redis caching (weekly TTL)
8. Create Dockerfile
9. Add to docker-compose.yml

### 🔄 Sync Service

**Status**: READY TO IMPLEMENT

**Requirements**:
- POST /sync/pull - Pull changes from cloud
- POST /sync/push - Push local changes to cloud
- GET /sync/status - Get sync status
- Bidirectional sync with conflict detection
- Last-write-wins conflict resolution
- Sync queue management with retry logic
- Exponential backoff retry logic (1s, 2s, 4s, 8s)

**Models**:
- SyncQueue
- SyncConflict

**Database Tables**:
- sync_queue
- sync_conflicts

**Implementation Steps**:
1. Create SyncService project
2. Create SyncQueue and SyncConflict models
3. Create SyncDbContext
4. Implement sync pull endpoint
5. Implement sync push endpoint
6. Implement conflict detection and resolution
7. Implement retry logic with exponential backoff
8. Create Dockerfile
9. Add to docker-compose.yml

## Phase 3: Infrastructure Setup

### Docker Compose Configuration

**Status**: COMPLETED

The `docker-compose.yml` file includes:
- PostgreSQL 15 (port 5432)
- Redis 7 (port 6379)
- RabbitMQ 3.12 (ports 5672, 15672)
- Authentication Service (port 5001)

**Start Services**:
```bash
docker-compose up -d
```

**Stop Services**:
```bash
docker-compose down
```

**View Logs**:
```bash
docker-compose logs -f
```

### Database Setup

**PostgreSQL Connection**:
```
Host: localhost
Port: 5432
Username: postgres
Password: postgres
Database: fitquest
```

**Create Databases**:
```bash
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_auth;"
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_users;"
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_workouts;"
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_xp;"
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_exercises;"
psql -U postgres -h localhost -c "CREATE DATABASE fitquest_sync;"
```

### Redis Setup

**Redis Connection**:
```
Host: localhost
Port: 6379
```

**Test Connection**:
```bash
redis-cli ping
```

### RabbitMQ Setup

**RabbitMQ Connection**:
```
Host: localhost
Port: 5672 (AMQP)
Port: 15672 (Management UI)
Username: guest
Password: guest
```

**Management UI**: http://localhost:15672

## Phase 4: iOS App Integration

### Update AuthenticationService

**File**: `FitQuestNative/src/services/AuthenticationService.ts`

**Changes**:
1. Replace mock authentication with real backend calls
2. Update API base URL to `http://localhost:5001` (development) or production URL
3. Implement JWT token storage in Keychain
4. Implement token refresh logic
5. Add error handling for authentication failures

**Example**:
```typescript
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const API_BASE_URL = 'http://localhost:5001';

export class AuthenticationService {
  async register(email: string, password: string, name: string) {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password,
      name
    });
    
    // Store tokens in Keychain
    await Keychain.setGenericPassword('fitquest_access_token', response.data.accessToken);
    await Keychain.setGenericPassword('fitquest_refresh_token', response.data.refreshToken);
    
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    
    // Store tokens in Keychain
    await Keychain.setGenericPassword('fitquest_access_token', response.data.accessToken);
    await Keychain.setGenericPassword('fitquest_refresh_token', response.data.refreshToken);
    
    return response.data;
  }

  async logout() {
    const token = await Keychain.getGenericPassword('fitquest_access_token');
    if (token) {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    
    // Clear tokens from Keychain
    await Keychain.resetGenericPassword('fitquest_access_token');
    await Keychain.resetGenericPassword('fitquest_refresh_token');
  }
}
```

### Update Other Services

Similar updates needed for:
- UserProfileService
- WorkoutLogger
- ExerciseLibraryService
- SyncEngine

## Development Workflow

### 1. Start Infrastructure

```bash
docker-compose up -d
```

### 2. Build and Run Service

```bash
cd services/AuthenticationService
dotnet build
dotnet run
```

### 3. Test Endpoints

```bash
curl http://localhost:5001/health
```

### 4. View Logs

```bash
docker-compose logs -f auth-service
```

### 5. Stop Services

```bash
docker-compose down
```

## Common Tasks

### Add a New Microservice

1. Create project:
   ```bash
   cd services
   dotnet new web -n NewService -f net9.0
   ```

2. Add dependencies to `.csproj`

3. Create Models, Data, DTOs, Services folders

4. Implement DbContext

5. Create API endpoints in Program.cs

6. Create Dockerfile

7. Add to docker-compose.yml

### Run Database Migrations

```bash
cd services/AuthenticationService
dotnet ef database update
```

### Create New Migration

```bash
cd services/AuthenticationService
dotnet ef migrations add MigrationName
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:5001/health

# Register
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'
```

## Performance Optimization

### Caching Strategy

- **Redis Sorted Sets**: Leaderboard rankings
- **Redis Key-Value**: User profiles, exercise library, session tokens
- **TTL-based expiration**: Automatic cache invalidation

### Database Optimization

- Create indexes on frequently queried columns
- Use connection pooling
- Implement query result caching
- Partition large tables by date

### API Optimization

- Implement pagination for list endpoints
- Use lazy loading for related data
- Compress responses with gzip
- Implement request batching

## Security Considerations

- All passwords hashed with bcrypt
- JWT tokens with expiration times
- Refresh tokens stored in Redis
- Password history prevents reuse
- Rate limiting at API Gateway level
- TLS/SSL for all data in transit
- GDPR/CCPA compliance

## Monitoring and Logging

### Logging

- Structured logging with Serilog
- Log levels: Debug, Information, Warning, Error, Critical
- Centralized logging with ELK Stack or Loki

### Monitoring

- Prometheus metrics collection
- Grafana dashboards
- Health check endpoints
- Performance metrics

### Alerting

- High error rate alerts
- Slow query alerts
- Service unavailability alerts
- Database connection pool exhaustion alerts

## Deployment

### Development

```bash
docker-compose up -d
```

### Staging

Deploy to Kubernetes cluster with staging configuration

### Production

Deploy to Kubernetes cluster with production configuration

## Next Steps

1. ✅ Complete Authentication Service
2. 🔄 Implement User Profile Service
3. 🔄 Implement Workout Service
4. 🔄 Implement XP & Progression Service
5. 🔄 Implement Exercise Library Service
6. 🔄 Implement Sync Service
7. ⏳ Implement Leaderboard Service
8. ⏳ Implement Social Service
9. ⏳ Implement Achievement Service
10. ⏳ Set up API Gateway (Kong or Nginx)
11. ⏳ Configure RabbitMQ for event-driven communication
12. ⏳ Deploy to Kubernetes

## Resources

- [.NET 9 Documentation](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9)
- [ASP.NET Core Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis)
- [Entity Framework Core](https://learn.microsoft.com/en-us/ef/core/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Docker Documentation](https://docs.docker.com/)

## Support

For questions or issues, refer to the spec documents:
- `.kiro/specs/fitquest-gamified-fitness/requirements.md`
- `.kiro/specs/fitquest-gamified-fitness/design.md`
- `.kiro/specs/fitquest-gamified-fitness/tasks.md`
