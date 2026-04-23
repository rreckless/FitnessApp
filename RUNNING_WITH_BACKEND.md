# FitQuest - Running with Real Backend Services

## Current Status

✅ **Backend Services Running:**
- PostgreSQL 15 (port 5432)
- Redis 7 (port 6379)
- RabbitMQ 3.12 (port 5672, 15672)
- Authentication Service (.NET 10) (port 5001)

✅ **iOS App Updated:**
- LoginScreen now uses real Authentication Service API
- RegisterScreen now uses real Authentication Service API
- All 145 tests passing

## Quick Start

### Terminal 1: Start Metro Bundler
```bash
cd FitQuestNative
npm start
```

### Terminal 2: Run iOS App
```bash
cd FitQuestNative
npm run ios -- --simulator="iPhone 17 Pro"
```

## Testing the Backend Integration

### 1. Register a New Account

**Requirements:**
- Email: any valid email (e.g., `test@example.com`)
- Password: 12+ characters with uppercase, lowercase, number, and special character
  - Example: `TestPass123!`
- Name: any name (e.g., `Test User`)

**Steps:**
1. Open the app on the simulator
2. Tap "Register"
3. Enter name, email, and password
4. Tap "Register"
5. If successful, you'll be taken to the onboarding screen

### 2. Login with Your Account

**Steps:**
1. If you just registered, you'll be logged in automatically
2. If you're on the login screen:
   - Enter your email
   - Enter your password
   - Tap "Login"
3. If successful, you'll be taken to the onboarding screen

### 3. Complete Onboarding

**Steps:**
1. Select fitness goals (Strength, Muscle Gain, Endurance, Fat Loss, Flexibility)
2. Select experience level (Beginner, Intermediate, Advanced)
3. Select workout frequency (1-7 days per week)
4. Select available equipment (Dumbbells, Barbell, Kettlebells, Bodyweight, etc.)
5. Tap "Complete"
6. You'll be taken to the Home screen

### 4. Use the App

- **Log Workout:** Tap "Log Workout" to log exercises
- **View Profile:** Tap profile icon to view/edit profile
- **Search Exercises:** Tap "Exercise Library" to search exercises

## Backend API Endpoints

### Authentication Service (Port 5001)

**Register:**
```
POST http://localhost:5001/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPass123!",
  "name": "Test User",
  "deviceFingerprint": "device-id"
}

Response:
{
  "userId": "user-id",
  "email": "test@example.com",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

**Login:**
```
POST http://localhost:5001/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPass123!",
  "deviceFingerprint": "device-id"
}

Response:
{
  "userId": "user-id",
  "email": "test@example.com",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

**Logout:**
```
POST http://localhost:5001/auth/logout
Authorization: Bearer {accessToken}
```

**Refresh Token:**
```
POST http://localhost:5001/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}

Response:
{
  "userId": "user-id",
  "email": "test@example.com",
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token",
  "expiresIn": 900
}
```

## Testing with cURL

### Register a User
```bash
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User",
    "deviceFingerprint": "test-device"
  }'
```

### Login
```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "deviceFingerprint": "test-device"
  }'
```

### Check Health
```bash
curl http://localhost:5001/health
```

## Docker Services Management

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f fitquest-auth-service
docker-compose logs -f fitquest-postgres
docker-compose logs -f fitquest-redis
docker-compose logs -f fitquest-rabbitmq
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### View Service Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Database Access

### PostgreSQL
```bash
# Connect to PostgreSQL
docker exec -it fitquest-postgres psql -U fitquest -d fitquest

# List tables
\dt

# View users table
SELECT * FROM users;

# View user_profiles table
SELECT * FROM user_profiles;
```

### Redis
```bash
# Connect to Redis
docker exec -it fitquest-redis redis-cli

# View all keys
KEYS *

# Get a specific key
GET key-name
```

### RabbitMQ Management UI
```
http://localhost:15672
Username: guest
Password: guest
```

## Troubleshooting

### App Won't Connect to Backend

**Check if services are running:**
```bash
docker ps
```

**Check if Authentication Service is healthy:**
```bash
curl http://localhost:5001/health
```

**Check service logs:**
```bash
docker-compose logs fitquest-auth-service
```

### Registration Fails with "Request failed with status code 400"

**Possible causes:**
- Password doesn't meet requirements (12+ chars, uppercase, lowercase, number, special char)
- Email already registered
- Invalid email format

**Solution:**
- Use a strong password: `TestPass123!`
- Use a unique email: `test-{timestamp}@example.com`

### Registration Fails with "Request failed with status code 500"

**Possible causes:**
- Database connection issue
- Service error

**Solution:**
1. Check service logs: `docker-compose logs fitquest-auth-service`
2. Restart services: `docker-compose restart`
3. Check database: `docker exec -it fitquest-postgres psql -U fitquest -d fitquest`

### Metro Bundler Issues

**Clear cache and rebuild:**
```bash
cd FitQuestNative
npm start -- --reset-cache
```

### Simulator Issues

**Restart simulator:**
```bash
xcrun simctl erase all
```

## Next Steps

1. **Implement User Profile Service** - Replace mock UserProfileService with real API calls
2. **Implement Workout Service** - Replace mock WorkoutLogger with real API calls
3. **Implement Exercise Library Service** - Replace mock ExerciseLibraryService with real API calls
4. **Implement Sync Service** - Replace mock SyncEngine with real API calls
5. **Add more microservices** - Leaderboards, Social, Achievements, etc.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    iOS App (React Native)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LoginScreen / RegisterScreen / HomeScreen / etc.    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AuthenticationService (Real API)                    │   │
│  │  UserProfileService (Mock → Real)                    │   │
│  │  WorkoutLogger (Mock → Real)                         │   │
│  │  ExerciseLibraryService (Mock → Real)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services (Docker)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Authentication Service (.NET 10) - Port 5001        │   │
│  │  User Profile Service (.NET 10) - Port 5002          │   │
│  │  Workout Service (.NET 10) - Port 5003               │   │
│  │  Exercise Library Service (.NET 10) - Port 5004       │   │
│  │  XP & Progression Service (.NET 10) - Port 5005       │   │
│  │  Sync Service (.NET 10) - Port 5006                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Port 5432)                              │   │
│  │  Redis (Port 6379)                                   │   │
│  │  RabbitMQ (Port 5672)                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Summary

You now have:
- ✅ iOS app with real Authentication Service integration
- ✅ All 145 tests passing
- ✅ Docker services running and healthy
- ✅ Ready to test registration and login with real backend

**Next: Run the app and test registration/login!**
