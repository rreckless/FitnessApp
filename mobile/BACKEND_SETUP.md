# Backend Setup Guide

The mobile app now uses real backend services for authentication. Follow these steps to get everything running.

## Prerequisites

- Docker and Docker Compose installed
- .NET 10 SDK (optional, Docker handles it)
- PostgreSQL, Redis, and RabbitMQ will run in Docker containers

## Starting the Backend (Quick Start)

For testing authentication only, run just the essential services:

```bash
cd backend-dotnet
docker-compose up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- RabbitMQ (port 5672)
- **Authentication Service (port 5001)** ← Main service for login/signup

## Starting All Services (Full Stack)

To run all microservices:

```bash
cd backend-dotnet
docker-compose --profile full up
```

This additionally starts:
- Workout Service (port 5002)
- XP Progression Service (port 5003)
- Leaderboard Service (port 5004)
- User Profile Service (port 5005)
- Sync Service (port 5006)
- Exercise Library Service (port 5007)
- Streak Tracking Service (port 5008)
- Social Service (port 5009)
- Achievement Service (port 5010)
- Activity Feed Service (port 5011)
- Challenge Service (port 5012)
- Progress Tracking Service (port 5013)
- Body Tracking Service (port 5014)
- GPS/Route Service (port 5015)
- Premium Subscription Service (port 5016)

## Testing Authentication

Once the backend is running, the mobile app will connect to:
- **Authentication Service**: http://localhost:5001

### Create a Test Account

1. Open the app and tap "Don't have an account? Sign Up"
2. Enter:
   - Username: any name
   - Email: any valid email (e.g., test@example.com)
   - Password: at least 8 characters
3. Tap "Create Account"

### Login

1. Use the credentials you just created
2. Or tap "Try Demo Account" to use the demo account (if it exists)

## Troubleshooting

### "Cannot connect to server"
- Make sure Docker containers are running: `docker-compose ps`
- Check that port 5001 is not blocked
- Verify the backend is healthy: `docker-compose logs authentication-service`
- Make sure you're running `docker-compose up` (not `docker-compose up --profile full`)

### "Invalid email or password"
- Make sure you created an account first
- Check that the email and password are correct
- Verify the database is running: `docker-compose logs postgres`

### Database Connection Issues
- Check PostgreSQL is running: `docker-compose logs postgres`
- Verify the connection string in docker-compose.yml
- Check available disk space for database

### Port Already in Use
- If port 5001 is already in use, modify the docker-compose.yml:
  ```yaml
  authentication-service:
    ports:
      - "5001:8080"  # Change first number to unused port
  ```
- Then update the AuthenticationService baseURL in `mobile/src/services/AuthenticationService.ts`

## Stopping the Backend

```bash
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

## API Documentation

Once running, view the Swagger documentation at:
- http://localhost:5001/swagger (Authentication Service)
- http://localhost:5002/swagger (Workout Service, if running with --profile full)
- etc. for other services

## Next Steps

Once authentication is working:
1. Test other features (workout logging, leaderboards, etc.)
2. Verify sync functionality
3. Test offline-first capabilities
