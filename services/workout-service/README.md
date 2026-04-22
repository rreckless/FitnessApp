# Workout Service

The Workout Service is a .NET 10 microservice responsible for workout logging, exercise tracking, and workout history management in the FitQuest application.

## Features

- **Workout CRUD Operations**: Create, read, update, and delete workouts
- **Exercise Tracking**: Log exercises with sets, reps, weight, and notes
- **Volume Calculation**: Automatic calculation of total volume (weight × reps × sets)
- **XP Calculation**: Automatic XP calculation based on volume
- **Offline Support**: Store workout data locally and sync when connection is restored
- **Soft Delete**: Workouts can be deleted within 24 hours of completion
- **Event Publishing**: Publishes WorkoutCompleted events to RabbitMQ for other services to consume
- **Pagination**: List endpoints support pagination for efficient data retrieval

## Technology Stack

- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 14+
- **Message Queue**: RabbitMQ
- **Logging**: Serilog

## Project Structure

```
workout-service/
├── Controllers/
│   └── WorkoutController.cs          # API endpoints
├── Data/
│   └── WorkoutDbContext.cs           # Entity Framework Core context
├── Models/
│   ├── Workout.cs                    # Workout entity
│   ├── WorkoutExercise.cs            # Exercise entity
│   ├── CreateWorkoutRequest.cs       # Request DTOs
│   ├── UpdateWorkoutRequest.cs
│   ├── CompleteWorkoutRequest.cs
│   └── WorkoutResponse.cs            # Response DTOs
├── Services/
│   ├── WorkoutService.cs             # Business logic
│   ├── VolumeCalculationService.cs   # Volume calculation
│   ├── XPCalculationService.cs       # XP calculation
│   └── RabbitMQPublisher.cs          # Event publishing
├── Program.cs                        # Application setup
├── appsettings.json                  # Configuration
├── Dockerfile                        # Container image
├── kubernetes-deployment.yaml        # Kubernetes deployment
├── kubernetes-service.yaml           # Kubernetes service
└── README.md                         # This file
```

## API Endpoints

### Create Workout
```
POST /api/workout
Content-Type: application/json

{
  "startTime": "2024-01-15T10:00:00Z",
  "notes": "Morning workout",
  "isOfflineCreated": false
}
```

### Get Workout
```
GET /api/workout/{id}
```

### List User Workouts (Paginated)
```
GET /api/workout?page=1&pageSize=20
```

### Update Workout
```
PUT /api/workout/{id}
Content-Type: application/json

{
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T11:00:00Z",
  "notes": "Updated notes",
  "exercises": [
    {
      "exerciseId": "550e8400-e29b-41d4-a716-446655440000",
      "order": 1,
      "sets": [
        {
          "reps": 10,
          "weight": 225,
          "rpe": 8,
          "notes": "Good form"
        }
      ]
    }
  ]
}
```

### Complete Workout
```
POST /api/workout/{id}/complete
Content-Type: application/json

{
  "endTime": "2024-01-15T11:00:00Z",
  "notes": "Great workout!"
}
```

### Delete Workout (Soft Delete)
```
DELETE /api/workout/{id}
```

## Setup and Deployment

### Local Development

1. **Prerequisites**
   - .NET 9.0 SDK or later
   - PostgreSQL 14+
   - RabbitMQ

2. **Database Setup**
   ```bash
   # Create database
   createdb fitquest_workouts
   
   # Run migrations
   dotnet ef database update
   ```

3. **Run the Service**
   ```bash
   dotnet run
   ```

4. **Access Swagger UI**
   - Navigate to `https://localhost:5001/swagger`

### Docker Build

```bash
docker build -t fitquest/workout-service:latest .
```

### Kubernetes Deployment

1. **Create Secrets**
   ```bash
   kubectl create secret generic workout-service-secrets \
     --from-literal=database-connection-string="Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_workouts;Username=fitquest;Password=changeme" \
     --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq.fitquest.svc.cluster.local:5672/" \
     -n fitquest
   ```

2. **Deploy Service**
   ```bash
   kubectl apply -f kubernetes-deployment.yaml
   kubectl apply -f kubernetes-service.yaml
   ```

3. **Verify Deployment**
   ```bash
   kubectl get pods -n fitquest -l app=workout-service
   kubectl logs -n fitquest -l app=workout-service -f
   ```

## Configuration

### Environment Variables

- `ASPNETCORE_ENVIRONMENT`: Set to "Production" for production deployments
- `ConnectionStrings__DefaultConnection`: PostgreSQL connection string
- `ConnectionStrings__RabbitMQ`: RabbitMQ connection string

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_workouts;Username=postgres;Password=password",
    "RabbitMQ": "amqp://guest:guest@localhost:5672/"
  }
}
```

## Data Models

### Workout
- `id`: Unique identifier (UUID)
- `userId`: User who created the workout
- `startTime`: When the workout started
- `endTime`: When the workout ended (optional)
- `duration`: Total duration in seconds
- `totalVolume`: Total volume in lbs (weight × reps × sets)
- `totalXP`: XP earned from the workout
- `notes`: Optional notes about the workout
- `isOfflineCreated`: Whether the workout was created offline
- `syncedAt`: When the workout was synced to cloud
- `createdAt`: When the record was created
- `updatedAt`: When the record was last updated
- `deletedAt`: When the record was soft deleted (null if not deleted)

### WorkoutExercise
- `id`: Unique identifier (UUID)
- `workoutId`: Reference to the workout
- `exerciseId`: Reference to the exercise
- `order`: Order of the exercise in the workout
- `sets`: Array of exercise sets with reps, weight, RPE, and notes
- `totalVolume`: Total volume for this exercise
- `createdAt`: When the record was created
- `updatedAt`: When the record was last updated

## Volume and XP Calculation

### Volume Calculation
- **Set Volume**: weight × reps
- **Exercise Volume**: sum of all sets
- **Workout Volume**: sum of all exercises

### XP Calculation
- **Formula**: max(volume / 100, 10)
- **Minimum**: 10 XP per workout
- **Example**: 1000 lbs volume = 10 XP, 2000 lbs volume = 20 XP

## Event Publishing

The service publishes `WorkoutCompleted` events to RabbitMQ when a workout is completed. Other services can subscribe to these events to:
- Update user XP and level
- Unlock achievements
- Update leaderboards
- Generate activity feed entries

### Event Format
```json
{
  "eventType": "WorkoutCompleted",
  "workoutId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "totalVolume": 2500,
  "totalXP": 25,
  "timestamp": "2024-01-15T11:00:00Z"
}
```

## Error Handling

The service returns appropriate HTTP status codes:
- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `204 No Content`: Successful DELETE request
- `400 Bad Request`: Invalid input or business logic violation
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Testing

### Unit Tests
```bash
dotnet test
```

### Integration Tests
```bash
dotnet test --filter "Category=Integration"
```

## Performance Considerations

- **Indexes**: Workouts are indexed by userId and createdAt for efficient queries
- **Pagination**: List endpoints support pagination to limit data transfer
- **Soft Delete**: Deleted workouts are marked with deletedAt timestamp instead of being removed
- **Volume Caching**: Total volume is calculated and stored to avoid recalculation

## Security

- All endpoints require authentication (JWT token)
- User can only access their own workouts
- Workouts can only be edited/deleted within 24 hours of completion
- All data is encrypted in transit (TLS 1.2+)
- Database credentials are stored in Kubernetes secrets

## Monitoring

The service exposes a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy"
}
```

This endpoint is used by Kubernetes liveness and readiness probes.

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running and accessible
- Check connection string in appsettings.json
- Ensure database user has appropriate permissions

### RabbitMQ Connection Issues
- Verify RabbitMQ is running and accessible
- Check connection string in appsettings.json
- Ensure RabbitMQ user has appropriate permissions

### Migration Issues
```bash
# View pending migrations
dotnet ef migrations list

# Create new migration
dotnet ef migrations add MigrationName

# Remove last migration
dotnet ef migrations remove
```

## Contributing

When making changes to the Workout Service:
1. Update models if data structure changes
2. Create database migrations for schema changes
3. Update API endpoints if contract changes
4. Add unit tests for new functionality
5. Update this README if behavior changes

## License

FitQuest - All rights reserved
