# Exercise Library Service

Exercise Library Service provides a comprehensive database of exercises with search, filtering, and custom exercise support.

## Features

- 200+ built-in exercises with metadata
- Exercise search and filtering by muscle group
- Custom exercise support (user-specific)
- Redis caching (weekly TTL)
- Fuzzy search support
- Exercise categorization by difficulty and equipment

## API Endpoints

### Search Exercises
```
GET /exercises?query=bench&muscleGroup=CHEST&limit=50
```
Searches exercises by name/description and optionally filters by muscle group.

### Get Exercise Details
```
GET /exercises/{id}
```
Returns detailed information about a specific exercise.

### Get Exercises by Muscle Group
```
GET /exercises/muscle-groups/{group}
```
Returns all exercises for a specific muscle group (CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE, CARDIO).

### Create Custom Exercise
```
POST /exercises
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Custom Exercise",
  "description": "Description",
  "primaryMuscleGroup": "CHEST",
  "secondaryMuscleGroups": ["SHOULDERS"],
  "difficulty": "INTERMEDIATE",
  "equipment": ["DUMBBELLS"],
  "formTips": ["Keep chest up", "Control the weight"],
  "videoUrl": "https://example.com/video.mp4"
}
```
Creates a custom exercise for the authenticated user.

## Database Schema

### exercises table
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT)
- primary_muscle_group (VARCHAR)
- secondary_muscle_groups (JSONB)
- difficulty (VARCHAR) - BEGINNER, INTERMEDIATE, ADVANCED
- equipment (JSONB)
- form_tips (JSONB)
- video_url (VARCHAR, nullable)
- is_custom (BOOLEAN)
- created_by_user_id (UUID, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Caching Strategy

- All exercises cached for 1 week in Redis
- Cache keys:
  - `exercises:all` - All exercises
  - `exercises:search:{query}:{muscleGroup}:{limit}` - Search results
  - `exercises:muscle-group:{group}` - Exercises by muscle group
  - `exercise:{id}` - Individual exercise
- Cache invalidated on custom exercise creation

## Exercise Data

### Muscle Groups
- CHEST
- BACK
- SHOULDERS
- ARMS
- LEGS
- CORE
- CARDIO

### Difficulty Levels
- BEGINNER
- INTERMEDIATE
- ADVANCED

### Equipment Types
- DUMBBELLS
- BARBELL
- MACHINES
- BODYWEIGHT
- CABLES
- KETTLEBELLS

## Configuration

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_exercises;Username=postgres;Password=postgres",
    "Redis": "localhost:6379"
  }
}
```

## Running Locally

```bash
# Build
dotnet build

# Run migrations
dotnet ef database update

# Seed exercises (optional)
dotnet run -- seed-exercises

# Run
dotnet run
```

## Docker

```bash
# Build image
docker build -f ExerciseLibraryService/Dockerfile -t fitquest-exercise-library-service .

# Run container
docker run -p 5007:8080 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_exercises;Username=postgres;Password=postgres" \
  -e ConnectionStrings__Redis="redis:6379" \
  fitquest-exercise-library-service
```

## Testing

```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test /p:CollectCoverage=true
```

## Performance Targets

- Exercise search: < 200ms
- Get exercise details: < 50ms (cached)
- Get exercises by muscle group: < 100ms (cached)
- Create custom exercise: < 100ms

## Security

- JWT authentication required for custom exercise creation
- Custom exercises associated with user ID
- Input validation on all endpoints
- Rate limiting on search endpoint

## Dependencies

- Entity Framework Core 8.0
- Npgsql 8.0
- StackExchange.Redis 2.6
- System.IdentityModel.Tokens.Jwt 7.0

## Future Enhancements

- Exercise video hosting and streaming
- Exercise ratings and reviews
- Exercise variation suggestions
- AI-powered exercise recommendations
- Exercise difficulty adjustment based on user level
- Exercise progression tracking
