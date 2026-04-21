# User Profile Service

User Profile Service manages user profile information, preferences, and settings for FitQuest.

## Features

- User profile CRUD operations (GET, PUT)
- User preference management (fitness goals, equipment, experience level)
- Profile picture upload to S3
- Profile visibility controls
- User search functionality
- Redis caching (1-hour TTL)

## API Endpoints

### Get User Profile
```
GET /users/{id}
```
Returns the user profile with all information.

### Update User Profile
```
PUT /users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "bio": "Fitness enthusiast",
  "isPublic": true
}
```

### Get User Preferences
```
GET /users/{id}/preferences
```
Returns user preferences including fitness goals, experience level, workout frequency, and available equipment.

### Update User Preferences
```
PUT /users/{id}/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "fitnessGoals": ["STRENGTH", "MUSCLE_GAIN"],
  "experienceLevel": "INTERMEDIATE",
  "workoutFrequency": 4,
  "availableEquipment": ["DUMBBELLS", "BARBELL", "MACHINES"]
}
```

### Upload Profile Picture
```
POST /users/{id}/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

[file]
```
Uploads profile picture to S3 and returns the URL.

### Search Users
```
GET /users/search?query=john
```
Searches for public user profiles by name or email.

## Database Schema

### users table
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- name (VARCHAR)
- bio (TEXT, nullable)
- profile_picture_url (VARCHAR, nullable)
- level (INTEGER, default: 1)
- total_xp (INTEGER, default: 0)
- current_streak (INTEGER, default: 0)
- longest_streak (INTEGER, default: 0)
- is_public (BOOLEAN, default: true)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_sync_at (TIMESTAMP, nullable)

### user_preferences table
- id (UUID, PK)
- user_id (UUID, FK, UNIQUE)
- fitness_goals (JSONB)
- experience_level (VARCHAR)
- workout_frequency (INTEGER)
- available_equipment (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Caching Strategy

- User profiles cached for 1 hour in Redis
- Cache key: `profile:{userId}`
- Cache invalidated on profile update
- Search results cached for 1 hour

## Configuration

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_profiles;Username=postgres;Password=postgres",
    "Redis": "localhost:6379"
  },
  "S3": {
    "BucketName": "fitquest-profiles",
    "Region": "us-east-1"
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
docker build -f UserProfileService/Dockerfile -t fitquest-user-profile-service .

# Run container
docker run -p 5005:8080 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_profiles;Username=postgres;Password=postgres" \
  -e ConnectionStrings__Redis="redis:6379" \
  fitquest-user-profile-service
```

## Testing

```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test /p:CollectCoverage=true
```

## Performance Targets

- Profile retrieval: < 50ms (cached)
- Profile update: < 100ms
- User search: < 200ms
- Avatar upload: < 500ms

## Security

- JWT authentication required for profile updates
- Profile visibility controls
- S3 bucket access restricted to authenticated users
- Input validation on all endpoints
- Rate limiting on search endpoint

## Dependencies

- Entity Framework Core 8.0
- Npgsql 8.0
- StackExchange.Redis 2.6
- AWS SDK for S3
- System.IdentityModel.Tokens.Jwt 7.0

## Future Enhancements

- Profile picture cropping and resizing
- Social media integration
- Profile badges and achievements display
- Advanced search filters
- Profile analytics
