# FitQuest Setup Guide

This guide walks through setting up the FitQuest development environment.

## Prerequisites

### For Backend Development
- Node.js 18+ (https://nodejs.org/)
- npm or yarn
- PostgreSQL 14+ (https://www.postgresql.org/)
- Redis 7+ (https://redis.io/)
- Docker & Docker Compose (optional, for containerized setup)

### For iOS Development
- macOS 12+
- Xcode 14+
- CocoaPods (https://cocoapods.org/)
- iOS 14+ deployment target

## Quick Start with Docker

The easiest way to get started is using Docker Compose for the backend services:

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

This will start:
- PostgreSQL on localhost:5432
- Redis on localhost:6379

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database (if using Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fitquest
DB_USER=fitquest_user
DB_PASSWORD=secure_password

# Redis (if using Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Sentry (optional)
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
```

### 3. Run Database Migrations

The database schema is automatically initialized when PostgreSQL starts with Docker Compose. If using a local PostgreSQL installation:

```bash
# Create database
createdb fitquest

# Create user
createuser fitquest_user

# Set password
psql -U postgres -c "ALTER USER fitquest_user WITH PASSWORD 'secure_password';"

# Import schema
psql -U fitquest_user -d fitquest -f src/database/schema.sql
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on http://localhost:3000

### 5. Verify Setup

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## iOS Setup

### 1. Install CocoaPods Dependencies

```bash
cd ios/FitQuest
pod install
```

### 2. Configure Environment

Edit `FitQuest/Config/Config.xcconfig`:

```xcconfig
API_BASE_URL = http://localhost:3000
SENTRY_DSN = 
ENVIRONMENT = development
```

### 3. Open in Xcode

```bash
open FitQuest.xcworkspace
```

**Important**: Always open `.xcworkspace`, not `.xcodeproj`

### 4. Build and Run

- Select a simulator or device
- Press Cmd+R to build and run
- Or use Product > Run in Xcode menu

## Database Setup Details

### PostgreSQL Schema

The schema includes the following tables:

**Core Tables**:
- `users` - User accounts and profiles
- `user_preferences` - User fitness preferences
- `exercises` - Exercise library
- `workouts` - Logged workouts
- `workout_exercises` - Exercises within workouts

**Progression Tables**:
- `muscle_group_ranks` - Muscle group proficiency levels
- `personal_records` - Personal best records
- `achievements` - Achievement definitions
- `user_achievements` - Unlocked achievements

**Social Tables**:
- `friendships` - Friend connections
- `activity_feed` - User activity feed
- `challenges` - Fitness challenges

**Tracking Tables**:
- `body_weight` - Weight logs
- `body_measurements` - Body measurement logs
- `progress_photos` - Progress photos
- `gps_routes` - GPS routes

**System Tables**:
- `sync_queue` - Offline sync queue

### SQLite Schema (iOS)

The iOS app uses SQLite with GRDB for local storage. The schema mirrors the PostgreSQL schema for offline-first functionality.

## Sentry Configuration

### Backend

1. Create a Sentry account at https://sentry.io/
2. Create a new project for Node.js
3. Copy the DSN
4. Add to `.env`:
   ```env
   SENTRY_DSN=https://your-key@sentry.io/project-id
   ```

### iOS

1. Create a Sentry project for iOS
2. Copy the DSN
3. Add to `Config.xcconfig`:
   ```xcconfig
   SENTRY_DSN = https://your-key@sentry.io/project-id
   ```

## Development Workflow

### Backend Development

```bash
cd backend

# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Build for production
npm run build
```

### iOS Development

1. Open `ios/FitQuest/FitQuest.xcworkspace` in Xcode
2. Select target and simulator/device
3. Press Cmd+R to run
4. Use Cmd+B to build
5. Use Cmd+U to run tests

## Troubleshooting

### Backend Issues

**Port already in use**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

**Database connection failed**:
- Verify PostgreSQL is running: `psql -U fitquest_user -d fitquest`
- Check `.env` database configuration
- Ensure database and user exist

**Redis connection failed**:
- Verify Redis is running: `redis-cli ping`
- Check `.env` Redis configuration

### iOS Issues

**CocoaPods installation failed**:
```bash
cd ios/FitQuest
pod repo update
pod install
```

**Xcode build errors**:
- Clean build folder: Cmd+Shift+K
- Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
- Rebuild: Cmd+B

**Simulator issues**:
- Restart simulator: `xcrun simctl erase all`
- Or use Xcode: Device > Erase All Content and Settings

## Next Steps

1. Review the [README.md](README.md) for project overview
2. Check the [requirements.md](.kiro/specs/fitquest-gamified-fitness/requirements.md) for feature specifications
3. Review the [design.md](.kiro/specs/fitquest-gamified-fitness/design.md) for architecture details
4. Start implementing features from [tasks.md](.kiro/specs/fitquest-gamified-fitness/tasks.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error logs in console
3. Check Sentry dashboard for error tracking
4. Consult the specification documents
