# FitQuest Backend Migration Guide: Node.js to .NET 10

This document outlines the migration from the monolithic Node.js/Express backend to the .NET 10 microservices architecture.

## Migration Overview

### Current State (Node.js/Express)
- Single monolithic application
- All routes in one Express server
- Single PostgreSQL database
- Redis for caching and async tasks
- Bull for job queues
- TypeScript for type safety

### Target State (.NET 10 Microservices)
- 11 independent microservices
- Each service has its own database
- Shared databases for users/exercises/achievements
- Redis for caching and leaderboards
- RabbitMQ for event-driven communication
- C# for type safety and performance

## Phase-by-Phase Migration

### Phase 1: Infrastructure Foundation ✅ (Completed)

**Completed Tasks:**
- ✅ Created project structure for 11 microservices
- ✅ Set up shared projects (FitQuest.Shared, FitQuest.EventBus)
- ✅ Created docker-compose.yml for local development
- ✅ Implemented Dockerfiles for each service

**Next Steps:**
- Deploy Kubernetes cluster
- Set up API Gateway (Kong or Nginx)
- Deploy RabbitMQ cluster
- Set up monitoring stack (Prometheus, Grafana, Jaeger)

### Phase 2: Core Microservices (In Progress)

**Completed:**
- ✅ Authentication Service
  - User registration with email validation
  - Login with JWT token generation
  - Refresh token rotation
  - Token blacklist via Redis
  - Password hashing with bcrypt

- ✅ Workout Service
  - Workout CRUD operations
  - Exercise tracking
  - Volume calculation
  - Soft delete support

- ✅ XP & Progression Service
  - XP calculation: max(volume/100, 10) × difficulty × (1 + streak bonus)
  - Level progression with cumulative thresholds
  - Muscle group rank tracking
  - Anti-cheat validation

- ✅ Leaderboard Service
  - Global leaderboard ranking
  - Friends leaderboard
  - Weekly leaderboard with Monday reset
  - Redis sorted set caching

**Remaining:**
- User Profile Service
- Sync Service
- Exercise Library Service
- Streak Tracking System

### Phase 3: Business Logic Services (Pending)

**To Implement:**
- Social Service (friends, friend requests)
- Achievement Service (unlock conditions, tracking)
- Activity Feed Service (event aggregation)
- Challenge Service (friend and community challenges)

### Phase 4: Supporting Services (Pending)

**To Implement:**
- Progress Tracking Service (PRs, volume, charts)
- Body Tracking Service (weight, measurements, photos)
- GPS/Route Service (GPS tracking, route planning)
- Premium/Subscription Service (billing, feature gating)

### Phase 5: Integrations (Pending)

**To Implement:**
- Apple Health Integration
- Spotify Integration
- Stripe Payment Integration
- AI Personal Trainer Service

### Phase 6-8: Deployment & Production (Pending)

**To Implement:**
- Docker images for all services
- Kubernetes manifests
- CI/CD pipeline
- Monitoring and observability
- Load testing and optimization

## Key Migration Patterns

### 1. Service Decomposition

**Node.js Routes → .NET Microservices**

```
Node.js:
- POST /auth/register → AuthenticationService
- POST /auth/login → AuthenticationService
- POST /workouts → WorkoutService
- GET /workouts → WorkoutService
- POST /xp/calculate → XpProgressionService
- GET /leaderboards → LeaderboardService

.NET:
- Each service has its own Program.cs with Minimal APIs
- Each service has its own database
- Services communicate via REST APIs or RabbitMQ events
```

### 2. Database Migration

**Monolithic Database → Service-Specific Databases**

```
Node.js (Single Database):
- users
- workouts
- workout_exercises
- achievements
- user_achievements
- leaderboards
- friendships
- etc.

.NET (Service-Specific):
- AuthenticationService: users, refresh_tokens
- WorkoutService: workouts, workout_exercises, workout_sets
- XpProgressionService: user_xp, muscle_group_ranks
- LeaderboardService: Redis sorted sets
- SocialService: friendships
- AchievementService: achievements, user_achievements
- etc.
```

### 3. Async Communication

**Bull Job Queue → RabbitMQ Events**

```
Node.js (Bull):
- Queue: 'workout-completed'
- Handler: calculateXP, updateLeaderboard, checkAchievements

.NET (RabbitMQ):
- Event: WorkoutCompletedEvent
- Subscribers: XpService, LeaderboardService, AchievementService
- Async handlers with retry logic and dead letter queues
```

### 4. Caching Strategy

**Redis Usage Remains Similar**

```
Node.js:
- User profile cache (1-hour TTL)
- Exercise library cache (weekly TTL)
- Session tokens (blacklist)
- Rate limiting counters

.NET:
- Same caching strategy
- Redis sorted sets for leaderboards (O(log n) lookups)
- Distributed cache via IDistributedCache
```

## Data Migration Strategy

### Step 1: Parallel Running

1. Keep Node.js backend running
2. Deploy .NET services alongside
3. Sync data between systems
4. Validate data consistency

### Step 2: Gradual Cutover

1. Route new users to .NET services
2. Migrate existing users in batches
3. Monitor for issues
4. Rollback if needed

### Step 3: Decommission Node.js

1. Ensure all data migrated
2. Archive Node.js codebase
3. Decommission Node.js infrastructure
4. Document migration process

## API Compatibility

### Authentication

**Node.js:**
```
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

Response:
{
  "success": true,
  "accessToken": "jwt...",
  "refreshToken": "refresh...",
  "userId": "uuid"
}
```

**.NET:**
```
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

Response:
{
  "success": true,
  "accessToken": "jwt...",
  "refreshToken": "refresh...",
  "userId": "uuid"
}
```

### Workouts

**Node.js:**
```
POST /workouts
{
  "startTime": "2024-01-15T10:00:00Z",
  "exercises": [
    {
      "exerciseId": "uuid",
      "sets": [
        { "reps": 10, "weight": 225 }
      ]
    }
  ]
}
```

**.NET:**
```
POST /workouts
{
  "startTime": "2024-01-15T10:00:00Z",
  "exercises": [
    {
      "exerciseId": "uuid",
      "sets": [
        { "reps": 10, "weight": 225, "rpe": null }
      ]
    }
  ]
}
```

## Performance Improvements

### Expected Performance Gains

| Metric | Node.js | .NET 10 | Improvement |
|--------|---------|---------|-------------|
| App Launch | 1200ms | 800ms | 33% faster |
| API Response | 250ms | 150ms | 40% faster |
| Leaderboard Query | 150ms | 80ms | 47% faster |
| Memory Usage | 200MB | 120MB | 40% less |
| Throughput | 1000 req/s | 2500 req/s | 2.5x |

### Optimization Strategies

1. **Caching**: Redis sorted sets for leaderboards
2. **Database Indexing**: Indexes on userId, createdAt, muscleGroup
3. **Connection Pooling**: Npgsql connection pooling
4. **Async/Await**: Non-blocking I/O throughout
5. **Lazy Loading**: Pagination and lazy loading of data

## Testing Strategy

### Unit Tests

```csharp
[Fact]
public async Task CalculateXP_WithValidVolume_ReturnsCorrectXP()
{
    // Arrange
    var service = new XpServiceImpl(_dbContext);
    var volume = 1000;
    var exerciseTypes = new List<string> { "compound" };
    var streak = 5;

    // Act
    var xp = await service.CalculateWorkoutXPAsync(volume, exerciseTypes, streak);

    // Assert
    Assert.Equal(15, xp); // (1000/100) * 1.2 * (1 + 0.25) = 15
}
```

### Property-Based Tests

```csharp
[Property]
public void XPCalculation_AlwaysReturnsMinimum10(
    int volume,
    List<string> exerciseTypes,
    int streak)
{
    // Arrange
    var service = new XpServiceImpl(_dbContext);

    // Act
    var xp = service.CalculateWorkoutXPAsync(volume, exerciseTypes, streak).Result;

    // Assert
    Assert.True(xp >= 10);
}
```

### Integration Tests

```csharp
[Fact]
public async Task WorkoutCompletion_UpdatesLeaderboard()
{
    // Arrange
    var workoutService = new WorkoutServiceImpl(_dbContext);
    var xpService = new XpServiceImpl(_dbContext);
    var leaderboardService = new LeaderboardServiceImpl(_redis);

    // Act
    var workout = await workoutService.CreateWorkoutAsync(userId, request);
    await workoutService.CompleteWorkoutAsync(workout.Id);
    var xp = await xpService.UpdateUserXPAsync(userId, 50);
    await leaderboardService.UpdateLeaderboardAsync(userId, xp.TotalXP, xp.CurrentLevel, "John");

    // Assert
    var position = await leaderboardService.GetUserPositionAsync(userId, "global");
    Assert.NotNull(position);
}
```

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Route traffic back to Node.js
2. **Data Sync**: Sync any changes back to Node.js database
3. **Investigation**: Identify root cause
4. **Fix and Retry**: Deploy fixes and retry migration

## Timeline

- **Week 1-2**: Infrastructure setup, Phase 1 completion
- **Week 3-4**: Core microservices (Phase 2)
- **Week 5-6**: Business logic services (Phase 3)
- **Week 7-8**: Supporting services (Phase 4)
- **Week 9-10**: Integrations (Phase 5)
- **Week 11-12**: Deployment and optimization (Phase 6-8)

## Success Criteria

- ✅ All microservices deployed and healthy
- ✅ All API endpoints working correctly
- ✅ Performance targets met (< 200ms p95)
- ✅ All tests passing (unit, integration, property-based)
- ✅ Monitoring and alerting operational
- ✅ Zero data loss during migration
- ✅ Successful rollback procedures tested

## References

- [.NET 10 Documentation](https://learn.microsoft.com/en-us/dotnet/)
- [ASP.NET Core Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis)
- [Entity Framework Core](https://learn.microsoft.com/en-us/ef/core/)
- [RabbitMQ .NET Client](https://www.rabbitmq.com/dotnet-api-guide.html)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
