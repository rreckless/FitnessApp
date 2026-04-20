# FitQuest - Gamified Fitness Application

FitQuest is a gamified fitness application that combines workout logging, progression tracking, social competition, and AI-powered coaching. The system is built on an offline-first architecture with cloud synchronization.

## Project Structure

```
fitquest/
├── ios/                          # iOS app (Swift + SwiftUI)
│   └── FitQuest/
│       ├── FitQuest/
│       │   ├── FitQuestApp.swift
│       │   ├── ContentView.swift
│       │   ├── Config/
│       │   │   ├── Config.swift
│       │   │   └── Config.xcconfig
│       │   ├── Database/
│       │   │   └── DatabaseManager.swift
│       │   └── Logging/
│       │       └── Logger.swift
│       ├── Podfile
│       └── FitQuest.xcodeproj/
│
└── backend/                      # Node.js/Express backend
    ├── src/
    │   ├── index.ts
    │   ├── config/
    │   │   └── config.ts
    │   ├── database/
    │   │   ├── connection.ts
    │   │   └── schema.sql
    │   └── logging/
    │       └── logger.ts
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── dist/                     # Compiled JavaScript (generated)
```

## Technology Stack

### iOS
- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Local Database**: SQLite (via GRDB)
- **Error Tracking**: Sentry
- **Networking**: URLSession

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Error Tracking**: Sentry
- **Language**: TypeScript

## Setup Instructions

### iOS Setup

1. Install CocoaPods dependencies:
```bash
cd ios/FitQuest
pod install
```

2. Configure environment variables in `FitQuest/Config/Config.xcconfig`:
```
API_BASE_URL = https://api.fitquest.local
SENTRY_DSN = your_sentry_dsn_here
ENVIRONMENT = development
```

3. Open the project in Xcode:
```bash
open FitQuest.xcworkspace
```

### Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up PostgreSQL database:
```bash
# Create database and user
createdb fitquest
createuser fitquest_user
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

## Database Schemas

### iOS (SQLite)
- Users
- User Preferences
- Workouts
- Workout Exercises
- Exercises
- Muscle Group Ranks
- Achievements
- User Achievements
- Personal Records
- Sync Queue
- Body Weight
- Body Measurements
- Progress Photos
- GPS Routes

### Backend (PostgreSQL)
- Same tables as iOS, plus:
- Friendships
- Activity Feed
- Challenges
- Challenge Progress

## Configuration

### Environment Variables

#### Backend (.env)
- `NODE_ENV`: development, staging, or production
- `PORT`: Server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: JWT signing keys
- `SENTRY_DSN`: Sentry error tracking DSN
- `AWS_*`: AWS S3 configuration for file uploads
- `SMTP_*`: Email configuration

#### iOS (Config.xcconfig)
- `API_BASE_URL`: Backend API base URL
- `SENTRY_DSN`: Sentry error tracking DSN
- `ENVIRONMENT`: development or production

## Logging and Error Tracking

### Sentry Integration

Both iOS and backend are configured with Sentry for error tracking:

**Backend**: Configured in `src/logging/logger.ts`
- Automatically captures exceptions
- Tracks performance with tracing
- Integrates with HTTP requests

**iOS**: Configured in `FitQuest/Logging/Logger.swift`
- Captures exceptions and errors
- Sends to Sentry DSN
- Includes context information

## Offline-First Architecture

The app is designed with offline-first principles:

1. **Local Storage**: All data is stored locally in SQLite (iOS) or PostgreSQL (backend)
2. **Sync Queue**: Changes are queued locally and synced when connection is available
3. **Conflict Resolution**: Last-write-wins strategy using timestamps
4. **Retry Logic**: Exponential backoff for failed sync operations

## Performance Targets

- App launch: < 1000ms
- Screen navigation: < 500ms
- Exercise search: < 200ms
- Scroll performance: 60 FPS

## Development

### Running Tests

Backend:
```bash
npm test
npm run test:watch
```

### Building

Backend:
```bash
npm run build
npm start
```

iOS:
- Build in Xcode (Cmd+B)
- Run in simulator (Cmd+R)

## API Endpoints

The backend provides REST API endpoints for:
- Authentication (`/auth/*`)
- User profiles (`/users/*`)
- Workouts (`/workouts/*`)
- Exercises (`/exercises/*`)
- XP and progression (`/users/:id/xp`, `/users/:id/muscle-groups`)
- Achievements (`/achievements/*`)
- Leaderboards (`/leaderboards/*`)
- Social features (`/friends/*`, `/activity-feed`)
- Challenges (`/challenges/*`)
- Progress tracking (`/progress/*`)
- Body tracking (`/body/*`)
- Sync (`/sync/*`)

## Contributing

1. Follow TypeScript/Swift best practices
2. Write tests for new features
3. Ensure code passes linting
4. Update documentation

## License

MIT
