# Streak Tracking Service

Streak Tracking Service manages daily workout streaks, milestone tracking, and streak-based rewards.

## Features

- Daily streak tracking (24-hour UTC window)
- Streak reset logic
- Longest streak preservation
- Milestone detection (7, 14, 30, 60, 100 days)
- Milestone reward distribution
- StreakMilestone event publishing
- User streak information retrieval

## API Endpoints

### Get Streak Information
```
GET /users/{userId}/streak
```
Returns current streak, longest streak, last workout date, and next milestone.

### Update Streak
```
POST /users/{userId}/streak/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "workoutId": "550e8400-e29b-41d4-a716-446655440000"
}
```
Updates streak after workout completion. Returns updated streak and any milestone reached.

### Get Milestones
```
GET /users/{userId}/streak/milestones
```
Returns all milestones achieved by the user with dates and XP rewards.

## Streak Logic

### Streak Increment
- If workout completed today: no change (already counted)
- If workout completed yesterday: increment streak
- If no workout for 2+ days: reset streak to 1
- First workout: set streak to 1

### Longest Streak
- Updated whenever current streak exceeds it
- Preserved even after streak resets

### Milestones
- 7 days: 50 XP reward
- 14 days: 100 XP reward
- 30 days: 250 XP reward
- 60 days: 500 XP reward
- 100 days: 1000 XP reward

## Database Schema

### user_streaks table
- id (UUID, PK)
- user_id (UUID, FK, UNIQUE)
- current_streak (INTEGER)
- longest_streak (INTEGER)
- last_workout_date (TIMESTAMP, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### streak_milestones table
- id (UUID, PK)
- user_id (UUID, FK)
- days (INTEGER)
- xp_reward (INTEGER)
- achieved_at (TIMESTAMP)
- created_at (TIMESTAMP)

## Event Publishing

When a milestone is reached, the service publishes a `StreakMilestoneEvent`:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "milestoneDays": 7,
  "xpReward": 50,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

This event is consumed by:
- Achievement Service (to unlock streak achievements)
- Activity Feed Service (to display milestone in feed)
- Notification Service (to send milestone notification)

## Configuration

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_streaks;Username=postgres;Password=postgres"
  },
  "RabbitMQ": {
    "HostName": "localhost",
    "Port": 5672,
    "UserName": "guest",
    "Password": "guest"
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
docker build -f StreakTrackingService/Dockerfile -t fitquest-streak-tracking-service .

# Run container
docker run -p 5008:8080 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_streaks;Username=postgres;Password=postgres" \
  -e RabbitMQ__HostName="rabbitmq" \
  fitquest-streak-tracking-service
```

## Testing

```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test /p:CollectCoverage=true
```

## Performance Targets

- Get streak: < 50ms
- Update streak: < 100ms
- Get milestones: < 100ms
- Event publishing: < 10ms

## Security

- JWT authentication required for streak updates
- User can only update their own streak
- Workout ID validation required
- Timestamp validation to prevent tampering

## Dependencies

- Entity Framework Core 8.0
- Npgsql 8.0
- System.IdentityModel.Tokens.Jwt 7.0
- RabbitMQ .NET Client

## Future Enhancements

- Streak freeze (skip one day without losing streak)
- Streak sharing and comparison
- Streak-based challenges
- Streak leaderboards
- Streak analytics and insights
- Streak notifications and reminders
