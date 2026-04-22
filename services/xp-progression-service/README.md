# XP & Progression Service

The XP & Progression Service is a .NET 10 microservice responsible for calculating XP, managing user levels, and tracking muscle group ranks in the FitQuest gamified fitness application.

## Features

- **XP Calculation**: Calculates XP based on workout volume, exercise difficulty, and streak bonuses
- **Level Progression**: Manages user levels with cumulative XP thresholds
- **Muscle Group Ranks**: Tracks proficiency levels for specific muscle groups based on volume trained
- **Event-Driven Architecture**: Listens to WorkoutCompleted events and publishes LevelUp and RankUp events
- **Anti-Cheat Validation**: Validates workout data against suspicious patterns

## Architecture

### Technology Stack
- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 14+
- **Message Queue**: RabbitMQ
- **ORM**: Entity Framework Core

### Database Schema

#### UserXP
- `Id` (UUID): Primary key
- `UserId` (UUID): Foreign key to users table
- `TotalXP` (int): Cumulative XP earned
- `CurrentLevel` (int): Current user level (1-10)
- `XPToNextLevel` (int): XP remaining to next level
- `LastXPUpdate` (DateTime): Timestamp of last XP update
- `CreatedAt` (DateTime): Record creation timestamp
- `UpdatedAt` (DateTime): Record update timestamp

#### MuscleGroupRank
- `Id` (UUID): Primary key
- `UserId` (UUID): Foreign key to users table
- `MuscleGroup` (enum): Chest, Back, Shoulders, Arms, Legs, Core
- `Rank` (int): Current rank (1-10)
- `TotalVolume` (int): Total volume trained (lbs)
- `CreatedAt` (DateTime): Record creation timestamp
- `UpdatedAt` (DateTime): Record update timestamp

#### ProgressionHistory
- `Id` (UUID): Primary key
- `UserId` (UUID): Foreign key to users table
- `XPEarned` (int): XP earned in this event
- `TotalXPAfter` (int): Total XP after this event
- `LevelBefore` (int): Level before this event
- `LevelAfter` (int): Level after this event
- `EventType` (string): Type of event (WorkoutCompleted, LevelUp, etc.)
- `RelatedEntityId` (UUID): ID of related entity (workoutId, etc.)
- `CreatedAt` (DateTime): Record creation timestamp

## API Endpoints

### XP Endpoints

#### Get User XP
```
GET /api/xp/users/{userId}
```
Returns user's current XP, level, and progress to next level.

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "totalXP": 1250,
  "currentLevel": 2,
  "xpToNextLevel": 250,
  "lastXPUpdate": "2024-01-15T10:30:00Z"
}
```

#### Calculate XP
```
POST /api/xp/calculate
```
Internal endpoint to calculate XP for a workout.

**Request:**
```json
{
  "totalVolume": 5000,
  "difficulty": "Compound",
  "streakDays": 5
}
```

**Response:**
```json
{
  "xp": 72
}
```

### Muscle Group Endpoints

#### Get All Muscle Group Ranks
```
GET /api/musclegroup/users/{userId}
```
Returns all muscle group ranks for a user.

**Response:**
```json
[
  {
    "muscleGroup": "Chest",
    "rank": 2,
    "totalVolume": 8500
  },
  {
    "muscleGroup": "Back",
    "rank": 1,
    "totalVolume": 2000
  }
]
```

#### Get Specific Muscle Group Rank
```
GET /api/musclegroup/users/{userId}/{muscleGroup}
```
Returns rank for a specific muscle group.

**Response:**
```json
{
  "muscleGroup": "Chest",
  "rank": 2,
  "totalVolume": 8500
}
```

### Progression Endpoints

#### Get Progression History
```
GET /api/progression/users/{userId}?page=1&pageSize=50
```
Returns progression history for a user with pagination.

**Response:**
```json
[
  {
    "xpEarned": 50,
    "totalXPAfter": 1250,
    "levelBefore": 2,
    "levelAfter": 2,
    "eventType": "WorkoutCompleted",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

## XP Calculation Formula

```
Base XP = max(volume / 100, 10)
Difficulty Multiplier = 1.2 (Compound) | 1.0 (Isolation) | 0.8 (Cardio)
Streak Bonus = min(streakDays * 0.05, 0.5)
Final XP = Base XP × Difficulty Multiplier × (1 + Streak Bonus)
```

### Example
- Volume: 5000 lbs
- Difficulty: Compound (1.2x)
- Streak: 5 days (25% bonus)
- Calculation: max(5000/100, 10) × 1.2 × 1.25 = 50 × 1.2 × 1.25 = 75 XP

## Level Progression

| Level | XP Threshold |
|-------|-------------|
| 1     | 0           |
| 2     | 500         |
| 3     | 1500        |
| 4     | 3000        |
| 5     | 5000        |
| 6     | 7500        |
| 7     | 10000       |
| 8     | 13000       |
| 9     | 16500       |
| 10    | 20500       |

## Muscle Group Rank Progression

| Rank | Volume Threshold (lbs) |
|------|----------------------|
| 1    | 0                    |
| 2    | 5000                 |
| 3    | 15000                |
| 4    | 30000                |
| 5    | 50000                |
| 6    | 75000                |
| 7    | 105000               |
| 8    | 140000               |
| 9    | 180000               |
| 10   | 225000               |

## Anti-Cheat Validation

The service validates workout data against suspicious patterns:
- Maximum 50 reps per set
- Maximum 100 reps per exercise
- Weight range: 1-1000 lbs

## Event-Driven Communication

### Consumed Events

**WorkoutCompleted**
- Published by: Workout Service
- Routing Key: `workout.completed`
- Payload:
  ```json
  {
    "eventType": "WorkoutCompleted",
    "workoutId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "totalVolume": 5000,
    "totalXP": 50,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

### Published Events

**LevelUp**
- Routing Key: `xp.levelup`
- Payload:
  ```json
  {
    "eventType": "LevelUp",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "newLevel": 3,
    "totalXP": 1500,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**RankUp**
- Routing Key: `xp.rankup`
- Payload:
  ```json
  {
    "eventType": "RankUp",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "muscleGroup": "Chest",
    "newRank": 3,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

## Setup and Deployment

### Local Development

1. **Prerequisites**
   - .NET 10 SDK
   - PostgreSQL 14+
   - RabbitMQ

2. **Database Setup**
   ```bash
   # Create database
   createdb fitquest_xp
   
   # Run migrations
   dotnet ef database update
   ```

3. **Run Service**
   ```bash
   dotnet run
   ```

4. **Access API**
   - Swagger UI: http://localhost:5000/swagger
   - Health Check: http://localhost:5000/health

### Docker Deployment

1. **Build Image**
   ```bash
   docker build -t xp-progression-service:latest .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     -e ConnectionStrings__DefaultConnection="Host=postgres;Database=fitquest_xp;Username=postgres;Password=postgres" \
     -e ConnectionStrings__RabbitMQ="amqp://guest:guest@rabbitmq:5672/" \
     -p 8080:8080 \
     xp-progression-service:latest
   ```

### Kubernetes Deployment

1. **Create Secrets**
   ```bash
   kubectl create secret generic xp-progression-secrets \
     --from-literal=database-connection-string="Host=postgres;Database=fitquest_xp;Username=postgres;Password=postgres" \
     --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq:5672/" \
     -n fitquest
   ```

2. **Deploy Service**
   ```bash
   kubectl apply -f kubernetes-deployment.yaml
   kubectl apply -f kubernetes-service.yaml
   ```

3. **Verify Deployment**
   ```bash
   kubectl get pods -n fitquest -l app=xp-progression-service
   kubectl logs -n fitquest -l app=xp-progression-service
   ```

## Configuration

### Environment Variables

- `ASPNETCORE_ENVIRONMENT`: Environment (Development, Production)
- `ConnectionStrings__DefaultConnection`: PostgreSQL connection string
- `ConnectionStrings__RabbitMQ`: RabbitMQ connection string

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_xp;Username=postgres;Password=postgres",
    "RabbitMQ": "amqp://guest:guest@localhost:5672/"
  }
}
```

## Testing

### Unit Tests
```bash
dotnet test
```

### Property-Based Tests
Property-based tests validate universal correctness properties:
- XP calculation correctness
- Level progression accuracy
- Muscle group rank tracking
- Anti-cheat validation

## Monitoring and Observability

### Health Checks
- Endpoint: `GET /health`
- Returns: `{ "status": "healthy" }`

### Logging
- Structured logging with Serilog
- Log levels: Debug, Information, Warning, Error
- Logs include: service operations, errors, event processing

### Metrics
- XP calculation performance
- Level up frequency
- Rank up frequency
- Event processing latency

## Performance Considerations

- **Database Indexes**: Optimized for userId and createdAt queries
- **Caching**: User XP cached in memory during request
- **Batch Processing**: Progression history paginated (50 items per page)
- **Async Operations**: All I/O operations are asynchronous

## Security

- **Input Validation**: All inputs validated against anti-cheat rules
- **Authorization**: Endpoints should be protected by API Gateway
- **Data Encryption**: All data encrypted in transit (TLS)
- **Audit Logging**: All XP changes logged in ProgressionHistory

## Troubleshooting

### Service Won't Start
- Check database connection string
- Verify PostgreSQL is running
- Check RabbitMQ connection

### Events Not Processing
- Verify RabbitMQ is running
- Check queue bindings
- Review service logs

### Database Errors
- Run migrations: `dotnet ef database update`
- Check database permissions
- Verify connection string

## Contributing

Follow .NET best practices:
- Use async/await for I/O operations
- Implement proper error handling
- Add logging for debugging
- Write unit tests for new features
- Follow naming conventions

## License

Part of the FitQuest project.
