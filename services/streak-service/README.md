# Streak Tracking Service

A .NET 10 microservice for tracking user workout streaks, handling streak resets, preserving longest streaks, detecting milestones, and publishing events.

## Features

- **Streak Increment**: Increment current streak by 1 when user completes a workout in a day
- **Streak Reset**: Reset current streak to 0 when user does not complete a workout for 24 hours
- **Longest Streak Tracking**: Track and display longest streak on user's profile
- **Milestone Rewards**: Award milestone rewards at 7, 14, 30, 60, 100 days
- **Longest Streak Preservation**: Preserve longest streak record when current streak resets
- **Event Publishing**: Publish StreakMilestone events to RabbitMQ

## Architecture

### Technology Stack
- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL
- **Message Queue**: RabbitMQ
- **Containerization**: Docker
- **Orchestration**: Kubernetes

### Data Models

#### StreakTracking
```csharp
public class StreakTracking
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateTime LastWorkoutDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

#### StreakMilestone
```csharp
public class StreakMilestone
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int Days { get; set; } // 7, 14, 30, 60, 100
    public int XPReward { get; set; }
    public DateTime AchievedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

## API Endpoints

### POST /api/streaks/increment
Increment streak for user after workout completion.

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "workoutDate": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "currentStreak": 5,
  "longestStreak": 10,
  "lastWorkoutDate": "2024-01-15T00:00:00Z",
  "milestoneReached": 7,
  "xpReward": 100
}
```

### GET /api/streaks/{userId}
Get current and longest streak for a user.

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "currentStreak": 5,
  "longestStreak": 10,
  "lastWorkoutDate": "2024-01-15T00:00:00Z",
  "milestoneReached": null,
  "xpReward": null
}
```

### GET /api/streaks/{userId}/milestones
Get milestone history for a user.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "days": 7,
    "xpReward": 100,
    "achievedAt": "2024-01-10T12:00:00Z",
    "createdAt": "2024-01-10T12:00:00Z"
  }
]
```

## Milestone Rewards

| Days | XP Reward |
|------|-----------|
| 7    | 100       |
| 14   | 250       |
| 30   | 500       |
| 60   | 1000      |
| 100  | 2000      |

## Event Publishing

### StreakMilestone Event
Published to RabbitMQ when a user reaches a milestone.

**Exchange**: `fitquest.events`
**Routing Key**: `streak.milestone`

**Payload:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "days": 7,
  "xpReward": 100,
  "achievedAt": "2024-01-10T12:00:00Z"
}
```

## Setup and Deployment

### Prerequisites
- .NET 10 SDK
- PostgreSQL 14+
- RabbitMQ 3.12+
- Docker (for containerization)
- Kubernetes (for orchestration)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/streak-service
   ```

2. **Install dependencies**
   ```bash
   dotnet restore
   ```

3. **Configure database connection**
   Update `appsettings.Development.json`:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_streak_dev;Username=postgres;Password=postgres",
       "RabbitMQ": "amqp://guest:guest@localhost:5672/"
     }
   }
   ```

4. **Run migrations**
   ```bash
   dotnet ef database update
   ```

5. **Run the service**
   ```bash
   dotnet run
   ```

6. **Access Swagger UI**
   Navigate to `https://localhost:5001/swagger`

### Docker Deployment

1. **Build Docker image**
   ```bash
   docker build -t streak-service:latest .
   ```

2. **Run Docker container**
   ```bash
   docker run -p 80:80 -p 443:443 \
     -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_streak;Username=postgres;Password=postgres" \
     -e ConnectionStrings__RabbitMQ="amqp://guest:guest@rabbitmq:5672/" \
     streak-service:latest
   ```

### Kubernetes Deployment

1. **Create namespace**
   ```bash
   kubectl create namespace fitquest
   ```

2. **Create secrets**
   ```bash
   kubectl create secret generic streak-service-secrets \
     --from-literal=database-connection-string="Host=postgres;Port=5432;Database=fitquest_streak;Username=postgres;Password=postgres" \
     --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq:5672/" \
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
   kubectl get svc -n fitquest
   ```

## Testing

### Unit Tests

Run unit tests:
```bash
dotnet test
```

### Integration Tests

Integration tests verify the service with a real PostgreSQL database and RabbitMQ instance.

## Monitoring and Logging

### Health Check
```bash
curl http://localhost/health
```

### Logs
View logs in Kubernetes:
```bash
kubectl logs -f deployment/streak-service -n fitquest
```

## Error Handling

The service handles the following error scenarios:

- **Missing User**: Returns 404 Not Found if streak not found for user
- **Invalid Request**: Returns 400 Bad Request for invalid input
- **Database Errors**: Returns 500 Internal Server Error with retry logic
- **RabbitMQ Errors**: Logs error and continues (non-blocking)

## Performance Considerations

- **Database Indexes**: Indexes on UserId and LastWorkoutDate for fast lookups
- **Caching**: Consider Redis caching for frequently accessed streaks
- **Batch Operations**: Milestone checks are performed in-memory
- **Connection Pooling**: PostgreSQL connection pooling configured

## Future Enhancements

- Redis caching for streak data
- Batch streak updates for multiple users
- Streak statistics and analytics
- Streak leaderboards
- Streak notifications
