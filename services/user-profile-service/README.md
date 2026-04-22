# User Profile Service

The User Profile Service is a .NET 10 microservice that manages user profile data and preferences for the FitQuest application. It provides endpoints for managing user profiles, preferences, and profile picture uploads to AWS S3.

## Features

- **User Profile Management**: Create, read, and update user profiles with name, email, bio, and profile picture
- **User Preferences**: Manage fitness goals, experience level, workout frequency, and available equipment
- **Profile Picture Upload**: Generate presigned URLs for S3 uploads and manage profile picture URLs
- **Data Persistence**: PostgreSQL database for reliable data storage
- **Caching**: Redis integration for performance optimization
- **AWS S3 Integration**: Secure profile picture storage with presigned URLs

## Technology Stack

- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **File Storage**: AWS S3
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Prerequisites

- .NET 10 SDK
- PostgreSQL 14+
- Redis 7+
- AWS S3 bucket
- Docker (for containerization)
- Kubernetes cluster (for deployment)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd services/user-profile-service
```

### 2. Configure Environment Variables

Create an `appsettings.Development.json` file with your local configuration:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft": "Information"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fitquest_users;Username=fitquest;Password=changeme",
    "Redis": "localhost:6379"
  },
  "AWS": {
    "S3": {
      "BucketName": "fitquest-profiles-dev",
      "PresignedUrlExpirationMinutes": 15
    }
  }
}
```

### 3. Set Up PostgreSQL

```bash
# Create database
createdb -U fitquest fitquest_users

# Or using Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=fitquest \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=fitquest_users \
  -p 5432:5432 \
  postgres:14
```

### 4. Set Up Redis

```bash
# Using Docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7
```

### 5. Configure AWS Credentials

Set up AWS credentials for S3 access:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### 6. Restore Dependencies and Run

```bash
# Restore NuGet packages
dotnet restore

# Run migrations
dotnet ef database update

# Run the service
dotnet run
```

The service will be available at `http://localhost:5000`

## API Endpoints

### User Profile Endpoints

#### Get User Profile
```
GET /api/userprofile/{userId}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "name": "John Doe",
  "email": "john@example.com",
  "bio": "Fitness enthusiast",
  "profilePictureUrl": "https://s3.amazonaws.com/...",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update User Profile
```
PUT /api/userprofile/{userId}
Content-Type: application/json

{
  "name": "Jane Doe",
  "bio": "Updated bio"
}
```

### User Preferences Endpoints

#### Get User Preferences
```
GET /api/userprofile/{userId}/preferences
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "fitnessGoals": "[\"STRENGTH\", \"MUSCLE_GAIN\"]",
  "experienceLevel": "INTERMEDIATE",
  "workoutFrequency": 4,
  "availableEquipment": "[\"DUMBBELLS\", \"BARBELL\", \"MACHINES\"]",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update User Preferences
```
PUT /api/userprofile/{userId}/preferences
Content-Type: application/json

{
  "fitnessGoals": ["STRENGTH", "MUSCLE_GAIN"],
  "experienceLevel": "INTERMEDIATE",
  "workoutFrequency": 4,
  "availableEquipment": ["DUMBBELLS", "BARBELL", "MACHINES"]
}
```

### Profile Picture Endpoints

#### Generate Upload URL
```
POST /api/userprofile/{userId}/avatar?fileName=profile.jpg
```

Response:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/fitquest-profiles/profiles/550e8400-e29b-41d4-a716-446655440001/550e8400-e29b-41d4-a716-446655440003_profile.jpg?..."
}
```

#### Update Profile Picture URL
```
PUT /api/userprofile/{userId}/avatar
Content-Type: application/json

{
  "pictureUrl": "https://s3.amazonaws.com/fitquest-profiles/profiles/550e8400-e29b-41d4-a716-446655440001/550e8400-e29b-41d4-a716-446655440003_profile.jpg"
}
```

## Database Schema

### UserProfile Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  bio VARCHAR(1000),
  profile_picture_url VARCHAR(2048),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### UserPreferences Table
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  fitness_goals VARCHAR(500) NOT NULL,
  experience_level VARCHAR(50) NOT NULL,
  workout_frequency INT NOT NULL,
  available_equipment VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Docker Build and Push

### Build Docker Image
```bash
docker build -t fitquest/user-profile-service:latest .
```

### Push to Registry
```bash
docker push fitquest/user-profile-service:latest
```

## Kubernetes Deployment

### Create Namespace
```bash
kubectl create namespace fitquest
```

### Create Secrets
```bash
kubectl create secret generic user-profile-service-secrets \
  --from-literal=database-connection-string="Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_users;Username=fitquest;Password=changeme" \
  --from-literal=redis-connection-string="redis.fitquest.svc.cluster.local:6379" \
  --from-literal=aws-access-key-id="your_access_key" \
  --from-literal=aws-secret-access-key="your_secret_key" \
  -n fitquest
```

### Create ConfigMap
```bash
kubectl create configmap user-profile-service-config \
  --from-literal=s3-bucket-name="fitquest-profiles" \
  --from-literal=s3-presigned-url-expiration="15" \
  --from-literal=aws-region="us-east-1" \
  -n fitquest
```

### Deploy Service
```bash
kubectl apply -f kubernetes-deployment.yaml
kubectl apply -f kubernetes-service.yaml
```

### Verify Deployment
```bash
kubectl get pods -n fitquest -l app=user-profile-service
kubectl logs -n fitquest -l app=user-profile-service -f
```

## Health Check

The service exposes a health check endpoint:

```
GET /health
```

Response:
```json
{
  "status": "healthy"
}
```

## Error Handling

The service returns appropriate HTTP status codes:

- `200 OK`: Successful request
- `204 No Content`: Successful update with no response body
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a message:
```json
{
  "message": "Error description"
}
```

## Logging

The service uses Serilog for structured logging. Logs are written to the console and can be aggregated using ELK Stack or Loki.

## Performance Considerations

- **Caching**: User profiles and preferences are cached in Redis with appropriate TTLs
- **Database Indexing**: Indexes on `user_id` for fast lookups
- **S3 Presigned URLs**: 15-minute expiration for security
- **Connection Pooling**: PostgreSQL connection pooling for efficient database access

## Security

- **Data Encryption**: All data in transit uses TLS 1.2+
- **S3 Presigned URLs**: Secure, time-limited URLs for file uploads
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Sensitive information is not exposed in error messages

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## License

This project is part of the FitQuest application and is licensed under the same terms as the main project.
