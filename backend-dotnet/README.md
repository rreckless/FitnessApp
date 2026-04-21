# FitQuest .NET 10 Microservices Backend

This is the new .NET 10 microservices-based backend for FitQuest, migrated from the monolithic Node.js/Express architecture.

## Architecture Overview

The backend is decomposed into 11 independent microservices, each with its own database and responsibility:

1. **Authentication Service** - User registration, login, JWT token management
2. **User Profile Service** - User profile CRUD, preferences, settings
3. **Workout Service** - Workout logging, exercise tracking, history
4. **XP & Progression Service** - XP calculation, level progression, muscle group ranks
5. **Leaderboard Service** - Global, friends, and weekly leaderboards
6. **Social Service** - Friend management, friend requests
7. **Achievement Service** - Achievement definitions, unlock conditions, tracking
8. **Activity Feed Service** - User activity feed, event aggregation
9. **GPS/Route Service** - GPS tracking, route planning, distance calculations
10. **Body Tracking Service** - Weight, measurements, progress photos
11. **Premium/Subscription Service** - Subscription management, billing

## Technology Stack

- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Language**: C#
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Message Queue**: RabbitMQ
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Project Structure

```
backend-dotnet/
├── FitQuest.Shared/              # Shared models and utilities
├── FitQuest.EventBus/            # Event bus abstractions and implementations
├── AuthenticationService/        # Auth microservice
├── UserProfileService/           # User profile microservice
├── WorkoutService/               # Workout microservice
├── XpProgressionService/         # XP & progression microservice
├── LeaderboardService/           # Leaderboard microservice
├── SocialService/                # Social features microservice
├── AchievementService/           # Achievement microservice
├── ActivityFeedService/          # Activity feed microservice
├── GpsRouteService/              # GPS & route microservice
├── BodyTrackingService/          # Body tracking microservice
├── PremiumSubscriptionService/   # Premium subscription microservice
├── docker-compose.yml            # Local development setup
└── README.md                     # This file
```

## Getting Started

### Prerequisites

- .NET 10 SDK
- Docker and Docker Compose
- PostgreSQL 14+ (or use Docker)
- Redis 7+ (or use Docker)
- RabbitMQ (or use Docker)

### Local Development Setup

1. **Start infrastructure services**:
   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - RabbitMQ (port 5672, management UI at 15672)

2. **Create databases**:
   ```bash
   # Connect to PostgreSQL
   psql -h localhost -U postgres

   # Create databases for each service
   CREATE DATABASE fitquest_auth;
   CREATE DATABASE fitquest_workouts;
   CREATE DATABASE fitquest_xp;
   CREATE DATABASE fitquest_leaderboard;
   CREATE DATABASE fitquest_social;
   CREATE DATABASE fitquest_achievements;
   CREATE DATABASE fitquest_activity_feed;
   CREATE DATABASE fitquest_gps;
   CREATE DATABASE fitquest_body_tracking;
   CREATE DATABASE fitquest_premium;
   ```

3. **Run migrations** (for each service):
   ```bash
   cd AuthenticationService
   dotnet ef database update
   cd ../WorkoutService
   dotnet ef database update
   # ... repeat for other services
   ```

4. **Start services**:
   ```bash
   # Terminal 1: Authentication Service
   cd AuthenticationService
   dotnet run

   # Terminal 2: Workout Service
   cd WorkoutService
   dotnet run

   # Terminal 3: XP & Progression Service
   cd XpProgressionService
   dotnet run

   # Terminal 4: Leaderboard Service
   cd LeaderboardService
   dotnet run
   ```

   Services will be available at:
   - Authentication: http://localhost:5001
   - Workout: http://localhost:5002
   - XP & Progression: http://localhost:5003
   - Leaderboard: http://localhost:5004

### Using Docker Compose

To run all services in Docker:

```bash
docker-compose up
```

This will start all microservices and infrastructure components. Services will be available at:
- Authentication: http://localhost:5001
- Workout: http://localhost:5002
- XP & Progression: http://localhost:5003
- Leaderboard: http://localhost:5004

## API Endpoints

### Authentication Service

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user

### Workout Service

- `POST /workouts` - Create workout
- `GET /workouts` - List user workouts
- `GET /workouts/{id}` - Get workout details
- `PUT /workouts/{id}` - Update workout
- `DELETE /workouts/{id}` - Delete workout
- `POST /workouts/{id}/complete` - Complete workout

### XP & Progression Service

- `GET /xp/users/{userId}` - Get user XP and level
- `GET /xp/users/{userId}/muscle-groups` - Get muscle group ranks
- `POST /xp/calculate` - Calculate XP for workout

### Leaderboard Service

- `GET /leaderboards/global` - Get global leaderboard
- `GET /leaderboards/friends` - Get friends leaderboard
- `GET /leaderboards/weekly` - Get weekly leaderboard
- `GET /leaderboards/{type}/position/{userId}` - Get user position

## Event-Driven Communication

Services communicate asynchronously via RabbitMQ events:

### Event Types

- **WorkoutCompleted** - Published by Workout Service
- **LevelUp** - Published by XP Service
- **RankUp** - Published by XP Service
- **StreakMilestone** - Published by Streak Service
- **AchievementUnlocked** - Published by Achievement Service
- **FriendshipCreated** - Published by Social Service
- **SubscriptionUpgraded** - Published by Premium Service

### Event Subscribers

- XP Service listens to `WorkoutCompleted`
- Leaderboard Service listens to `LevelUp`
- Achievement Service listens to `WorkoutCompleted`, `LevelUp`, `StreakMilestone`
- Activity Feed Service listens to all events
- Notification Service listens to all events

## Database Schema

Each service has its own database with service-specific tables. Shared data (users, exercises, achievements) is replicated across services or accessed via APIs.

### Shared Tables

- `users` - User accounts
- `exercises` - Exercise library
- `achievements` - Achievement definitions

### Service-Specific Tables

- **Authentication Service**: `users`, `refresh_tokens`
- **Workout Service**: `workouts`, `workout_exercises`, `workout_sets`
- **XP Service**: `user_xp`, `muscle_group_ranks`
- **Leaderboard Service**: Redis sorted sets (no persistent DB)
- **Social Service**: `friendships`
- **Achievement Service**: `achievements`, `user_achievements`
- **Activity Feed Service**: `activity_feed_entries`
- **GPS Service**: `gps_routes`, `gps_points`
- **Body Tracking Service**: `body_weight`, `body_measurements`, `progress_photos`
- **Premium Service**: `subscriptions`

## Caching Strategy

- **Redis Sorted Sets**: Leaderboard rankings (O(log n) lookups)
- **Redis Key-Value**: User profiles (1-hour TTL), exercise library (weekly TTL)
- **Session Tokens**: Blacklist in Redis (24-hour TTL)
- **Rate Limiting**: Counters in Redis

## Performance Targets

- App launch: < 1000ms
- Screen navigation: < 500ms
- Exercise search: < 200ms
- API response time: < 200ms (p95)
- Leaderboard query: < 100ms
- Sync latency: < 30 seconds

## Security

- JWT tokens with refresh token rotation
- Password hashing with bcrypt
- Device fingerprinting
- Rate limiting per user
- Request signing for API calls
- Data encryption at rest (AES-256)
- TLS 1.2+ for all data in transit
- GDPR and CCPA compliance

## Testing

### Unit Tests

```bash
cd AuthenticationService
dotnet test
```

### Integration Tests

```bash
dotnet test --filter "Category=Integration"
```

### Property-Based Tests

```bash
dotnet test --filter "Category=PropertyBased"
```

## Deployment

### Docker Build

```bash
docker build -f AuthenticationService/Dockerfile -t fitquest-auth-service .
docker build -f WorkoutService/Dockerfile -t fitquest-workout-service .
# ... repeat for other services
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests.

```bash
kubectl apply -f k8s/
```

## Monitoring and Observability

- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Tracing**: Jaeger or Zipkin
- **Logging**: ELK Stack or Loki
- **Alerting**: PagerDuty

## Migration Notes

This is a migration from the monolithic Node.js/Express backend. Key differences:

1. **Microservices**: Each service is independent with its own database
2. **Event-Driven**: Asynchronous communication via RabbitMQ
3. **Performance**: .NET 10 provides better performance than Node.js
4. **Type Safety**: C# provides stronger type safety than TypeScript
5. **Scalability**: Services can be scaled independently

## Contributing

1. Create a feature branch
2. Make changes
3. Write tests
4. Submit pull request

## License

MIT
