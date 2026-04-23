# Exercise Library Service

A .NET 10 microservice that provides a comprehensive exercise library with 200+ built-in exercises, fuzzy search, filtering by muscle group, and support for user-specific custom exercises.

## Features

- **200+ Built-in Exercises**: Pre-populated database with exercises across all muscle groups
- **Fuzzy Search**: Find exercises by name or description with intelligent matching
- **Muscle Group Filtering**: Filter exercises by primary and secondary muscle groups
- **Difficulty Levels**: Beginner, Intermediate, Advanced
- **Custom Exercises**: Users can create and manage their own exercises
- **Redis Caching**: Weekly cache TTL for exercise library with automatic invalidation
- **Pagination**: Efficient pagination for large result sets
- **User-Specific Data**: Custom exercises are isolated per user
- **OpenAPI/Swagger**: Full API documentation

## Architecture

### Technology Stack
- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Logging**: Serilog

### Data Models

#### Exercise
```csharp
{
  id: UUID (primary key)
  name: String (unique)
  description: String
  primaryMuscleGroup: Enum (CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE, CARDIO)
  secondaryMuscleGroups: Array<Enum>
  difficulty: Enum (BEGINNER, INTERMEDIATE, ADVANCED)
  equipment: Array<Enum>
  formTips: Array<String>
  videoUrl: String (optional)
  isBuiltIn: Boolean
  createdByUserId: UUID (optional, for custom exercises)
  createdAt: DateTime
  updatedAt: DateTime
}
```

## API Endpoints

### Search Exercises
```
GET /api/exercises?query=bench&muscleGroup=Chest&difficulty=Intermediate&page=1&pageSize=20
```

**Query Parameters:**
- `query` (optional): Text search query for fuzzy matching
- `muscleGroup` (optional): Filter by muscle group (Chest, Back, Shoulders, Arms, Legs, Core, Cardio)
- `difficulty` (optional): Filter by difficulty (Beginner, Intermediate, Advanced)
- `page` (default: 1): Page number for pagination
- `pageSize` (default: 20, max: 100): Items per page

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Barbell Bench Press",
      "description": "Lie on a flat bench and press a barbell upward",
      "primaryMuscleGroup": "Chest",
      "secondaryMuscleGroups": ["Shoulders", "Arms"],
      "difficulty": "Intermediate",
      "equipment": ["Barbell", "Machines"],
      "formTips": ["Keep feet flat", "Lower to chest", "Press explosively"],
      "videoUrl": null,
      "isBuiltIn": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 150,
  "totalPages": 8
}
```

### Get Exercise by ID
```
GET /api/exercises/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Barbell Bench Press",
  "description": "Lie on a flat bench and press a barbell upward",
  "primaryMuscleGroup": "Chest",
  "secondaryMuscleGroups": ["Shoulders", "Arms"],
  "difficulty": "Intermediate",
  "equipment": ["Barbell", "Machines"],
  "formTips": ["Keep feet flat", "Lower to chest", "Press explosively"],
  "videoUrl": null,
  "isBuiltIn": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Get Exercises by Muscle Group
```
GET /api/exercises/muscle-groups/{muscleGroup}?page=1&pageSize=20
```

**Path Parameters:**
- `muscleGroup`: Chest, Back, Shoulders, Arms, Legs, Core, or Cardio

**Response:** Same as search endpoint

### Create Custom Exercise
```
POST /api/exercises/custom
Headers: X-User-Id: {userId}
```

**Request Body:**
```json
{
  "name": "My Custom Exercise",
  "description": "Description of the exercise",
  "primaryMuscleGroup": "Chest",
  "secondaryMuscleGroups": ["Shoulders"],
  "difficulty": "Intermediate",
  "equipment": ["Dumbbells"],
  "formTips": ["Tip 1", "Tip 2"],
  "videoUrl": "https://example.com/video"
}
```

**Response:** Exercise object with generated ID

### Get User's Custom Exercises
```
GET /api/exercises/users/{userId}/custom?page=1&pageSize=20
Headers: X-User-Id: {userId}
```

**Response:** Paginated list of custom exercises

### Get All Built-in Exercises (for offline caching)
```
GET /api/exercises/builtin/all
```

**Response:** Array of all built-in exercises (cached for 1 week)

## Setup and Deployment

### Local Development

1. **Prerequisites**
   - .NET 10 SDK
   - PostgreSQL 14+
   - Redis 7+

2. **Database Setup**
   ```bash
   # Create database
   createdb fitquest_exercises
   
   # Run migrations
   dotnet ef database update
   ```

3. **Run the Service**
   ```bash
   dotnet run
   ```

4. **Access Swagger UI**
   - Navigate to `http://localhost:5000/swagger`

### Docker Build

```bash
docker build -t exercise-library-service:latest .
docker run -p 8080:8080 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_exercises;Username=fitquest;Password=changeme" \
  -e ConnectionStrings__Redis="redis:6379" \
  exercise-library-service:latest
```

### Kubernetes Deployment

1. **Create Secrets**
   ```bash
   kubectl create secret generic exercise-library-secrets \
     --from-literal=database-connection-string="Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_exercises;Username=fitquest;Password=changeme" \
     --from-literal=redis-connection-string="redis.fitquest.svc.cluster.local:6379" \
     -n fitquest
   ```

2. **Deploy Service**
   ```bash
   kubectl apply -f kubernetes-deployment.yaml
   kubectl apply -f kubernetes-service.yaml
   ```

3. **Verify Deployment**
   ```bash
   kubectl get pods -n fitquest -l app=exercise-library-service
   kubectl logs -n fitquest -l app=exercise-library-service
   ```

## Caching Strategy

### Redis Cache Configuration
- **Exercise by ID**: 1-week TTL (604,800 seconds)
- **All Built-in Exercises**: 1-week TTL
- **Cache Key Format**: `exercises:{exerciseId}` or `exercises:all_builtin`

### Cache Invalidation
- Automatic TTL expiration after 1 week
- Manual invalidation on custom exercise creation (if needed)

## Performance Characteristics

- **Search Response Time**: < 200ms (with caching)
- **Get by ID**: < 50ms (from cache)
- **Pagination**: Supports up to 100 items per page
- **Concurrent Users**: Scales horizontally with Kubernetes replicas

## Security

- **User Isolation**: Custom exercises are user-specific and validated via X-User-Id header
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Implemented via API Gateway
- **HTTPS**: All communication encrypted in transit
- **Database**: Connection pooling and parameterized queries

## Monitoring and Logging

- **Health Check**: `GET /health` endpoint
- **Structured Logging**: Serilog with console output
- **Metrics**: Prometheus-compatible metrics (via middleware)
- **Tracing**: Distributed tracing support

## Testing

### Unit Tests
```bash
cd ../exercise-library-service.tests
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

## Requirements Validation

This service implements the following requirements:

- **Requirement 4.1**: 200+ built-in exercises with name, description, primary and secondary muscle groups ✓
- **Requirement 4.2**: Exercises categorized by muscle group (chest, back, shoulders, arms, legs, core, cardio) ✓
- **Requirement 4.3**: Fuzzy search with matching results ✓
- **Requirement 4.4**: Custom exercise storage with name, description, muscle groups ✓
- **Requirement 4.5**: User-specific custom exercises ✓
- **Requirement 4.8**: Offline availability with periodic cloud updates (via Redis caching) ✓
- **Requirement 4.9**: Custom exercise sync to cloud and availability on other devices ✓

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running and accessible
- Check connection string in appsettings.json
- Ensure database user has proper permissions

### Redis Connection Issues
- Verify Redis is running and accessible
- Check Redis connection string
- Verify Redis port (default: 6379)

### Slow Search Performance
- Check database indexes on Name and PrimaryMuscleGroup
- Verify Redis cache is working
- Monitor database query performance

## Future Enhancements

- Video URL validation and storage
- Exercise image storage
- Exercise difficulty ratings from users
- Exercise popularity metrics
- Advanced search filters (equipment combinations)
- Exercise recommendation engine
- Batch import/export functionality
