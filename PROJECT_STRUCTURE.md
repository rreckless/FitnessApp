# FitQuest Project Structure

## Overview

FitQuest is organized into two main components: iOS app and Node.js backend, with shared configuration and documentation.

## Directory Structure

```
fitquest/
├── ios/                              # iOS application
│   └── FitQuest/
│       ├── FitQuest/                 # Main app source
│       │   ├── FitQuestApp.swift     # App entry point
│       │   ├── ContentView.swift     # Root view
│       │   ├── Config/
│       │   │   ├── Config.swift      # Runtime configuration
│       │   │   └── Config.xcconfig   # Build configuration
│       │   ├── Database/
│       │   │   └── DatabaseManager.swift  # SQLite management with GRDB
│       │   ├── Logging/
│       │   │   └── Logger.swift      # Logging and Sentry integration
│       │   ├── Services/             # (Future) Business logic services
│       │   ├── Models/               # (Future) Data models
│       │   ├── Views/                # (Future) SwiftUI views
│       │   └── Utils/                # (Future) Utility functions
│       ├── FitQuestTests/            # (Future) Unit tests
│       ├── Podfile                   # CocoaPods dependencies
│       └── FitQuest.xcodeproj/       # Xcode project
│
├── backend/                          # Node.js/Express backend
│   ├── src/
│   │   ├── index.ts                  # Server entry point
│   │   ├── config/
│   │   │   └── config.ts             # Configuration management
│   │   ├── database/
│   │   │   ├── connection.ts         # PostgreSQL connection pool
│   │   │   └── schema.sql            # Database schema
│   │   ├── logging/
│   │   │   └── logger.ts             # Logging and Sentry integration
│   │   ├── routes/                   # (Future) API routes
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── workouts.ts
│   │   │   ├── exercises.ts
│   │   │   ├── xp.ts
│   │   │   ├── achievements.ts
│   │   │   ├── leaderboards.ts
│   │   │   ├── social.ts
│   │   │   ├── progress.ts
│   │   │   ├── body.ts
│   │   │   ├── sync.ts
│   │   │   └── premium.ts
│   │   ├── services/                 # (Future) Business logic
│   │   │   ├── auth.ts
│   │   │   ├── user.ts
│   │   │   ├── workout.ts
│   │   │   ├── xp.ts
│   │   │   ├── achievement.ts
│   │   │   ├── leaderboard.ts
│   │   │   ├── social.ts
│   │   │   ├── sync.ts
│   │   │   └── premium.ts
│   │   ├── models/                   # (Future) Data models/types
│   │   ├── middleware/               # (Future) Express middleware
│   │   ├── utils/                    # (Future) Utility functions
│   │   ├── validators/               # (Future) Input validation
│   │   ├── errors/                   # (Future) Error handling
│   │   └── migrations/
│   │       └── run.ts                # Database migration runner
│   ├── __tests__/                    # (Future) Test files
│   ├── dist/                         # Compiled JavaScript (generated)
│   ├── package.json                  # Dependencies and scripts
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── jest.config.js                # Jest testing configuration
│   ├── .eslintrc.json                # ESLint configuration
│   └── .env.example                  # Environment variables template
│
├── .kiro/                            # Kiro specification files
│   └── specs/
│       └── fitquest-gamified-fitness/
│           ├── requirements.md       # Feature requirements
│           ├── design.md             # Technical design
│           └── tasks.md              # Implementation tasks
│
├── docker-compose.yml                # Docker services (PostgreSQL, Redis)
├── .gitignore                        # Git ignore rules
├── README.md                         # Project overview
├── SETUP.md                          # Setup instructions
└── PROJECT_STRUCTURE.md              # This file
```

## Key Files

### iOS

| File | Purpose |
|------|---------|
| `FitQuestApp.swift` | App entry point, scene setup |
| `ContentView.swift` | Root view hierarchy |
| `Config/Config.swift` | Runtime configuration loading |
| `Config/Config.xcconfig` | Build-time configuration |
| `Database/DatabaseManager.swift` | SQLite database initialization and schema |
| `Logging/Logger.swift` | Logging service with Sentry integration |
| `Podfile` | CocoaPods dependency management |

### Backend

| File | Purpose |
|------|---------|
| `src/index.ts` | Express app setup and server startup |
| `src/config/config.ts` | Configuration from environment variables |
| `src/database/connection.ts` | PostgreSQL connection pool management |
| `src/database/schema.sql` | PostgreSQL schema definition |
| `src/logging/logger.ts` | Logging service with Sentry integration |
| `src/migrations/run.ts` | Database migration runner |
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler options |
| `jest.config.js` | Jest test configuration |
| `.eslintrc.json` | ESLint linting rules |
| `.env.example` | Environment variable template |

### Configuration & Documentation

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Docker services for local development |
| `.gitignore` | Git ignore patterns |
| `README.md` | Project overview and quick start |
| `SETUP.md` | Detailed setup instructions |
| `PROJECT_STRUCTURE.md` | This file |

## Database Schema

### iOS (SQLite)

Tables created by `DatabaseManager.swift`:
- `users` - User accounts
- `user_preferences` - User settings
- `workouts` - Logged workouts
- `workout_exercises` - Exercises in workouts
- `exercises` - Exercise library
- `muscle_group_ranks` - Muscle group proficiency
- `achievements` - Achievement definitions
- `user_achievements` - Unlocked achievements
- `personal_records` - Personal best records
- `sync_queue` - Offline sync queue
- `body_weight` - Weight logs
- `body_measurements` - Measurement logs
- `progress_photos` - Progress photos
- `gps_routes` - GPS routes

### Backend (PostgreSQL)

Tables defined in `src/database/schema.sql`:
- All iOS tables plus:
- `friendships` - Friend connections
- `activity_feed` - User activity
- `challenges` - Fitness challenges
- `challenge_progress` - Challenge progress tracking

## Configuration

### Environment Variables

Backend configuration via `.env`:
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fitquest
DB_USER=fitquest_user
DB_PASSWORD=secure_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret
SENTRY_DSN=your_sentry_dsn
```

iOS configuration via `Config.xcconfig`:
```
API_BASE_URL=http://localhost:3000
SENTRY_DSN=your_sentry_dsn
ENVIRONMENT=development
```

## Dependencies

### iOS (CocoaPods)
- `GRDB.swift` - SQLite database access
- `Sentry` - Error tracking

### Backend (npm)
- `express` - Web framework
- `pg` - PostgreSQL client
- `redis` - Redis client
- `@sentry/node` - Error tracking
- `typescript` - Language
- `jest` - Testing framework
- `eslint` - Code linting

## Development Workflow

### Backend Development

```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start development server
npm test             # Run tests
npm run lint         # Lint code
npm run build        # Build for production
```

### iOS Development

```bash
cd ios/FitQuest
pod install          # Install CocoaPods
open FitQuest.xcworkspace  # Open in Xcode
# Build and run in Xcode (Cmd+R)
```

### Database Setup

```bash
# Using Docker Compose
docker-compose up -d

# Or manually
createdb fitquest
createuser fitquest_user
psql -U fitquest_user -d fitquest -f backend/src/database/schema.sql
```

## Future Expansion

The structure is designed to accommodate:

### iOS
- `Services/` - Business logic (authentication, workouts, sync, etc.)
- `Models/` - Data models and view models
- `Views/` - SwiftUI view components
- `Utils/` - Helper functions and extensions
- `FitQuestTests/` - Unit and integration tests

### Backend
- `routes/` - API endpoint handlers
- `services/` - Business logic implementation
- `models/` - TypeScript interfaces and types
- `middleware/` - Express middleware
- `validators/` - Input validation schemas
- `errors/` - Custom error classes
- `__tests__/` - Unit and integration tests

## Performance Considerations

### iOS
- SQLite with GRDB for efficient local storage
- Lazy loading of images and data
- Efficient sync queue management
- Sentry for error tracking

### Backend
- PostgreSQL with indexes for fast queries
- Redis caching for frequently accessed data
- Connection pooling for database efficiency
- Sentry for error tracking and performance monitoring

## Security

### iOS
- Keychain for secure token storage
- TLS for all network communication
- Sentry for error tracking

### Backend
- JWT authentication with refresh tokens
- bcryptjs for password hashing
- Helmet for security headers
- Rate limiting for API endpoints
- Sentry for error tracking

## Testing

### Backend
- Jest for unit testing
- TypeScript for type safety
- ESLint for code quality

### iOS
- XCTest for unit testing (future)
- SwiftUI preview for UI testing (future)

## Deployment

### Backend
- Build: `npm run build`
- Start: `npm start`
- Environment: Set via `.env` or environment variables

### iOS
- Build in Xcode
- Archive for App Store submission
- Configuration via `Config.xcconfig`

## Monitoring

### Sentry Integration
- Backend: Automatic exception capture
- iOS: Manual and automatic error reporting
- Performance monitoring enabled
- Environment-specific tracking

## Documentation

- `README.md` - Project overview
- `SETUP.md` - Setup instructions
- `PROJECT_STRUCTURE.md` - This file
- `.kiro/specs/fitquest-gamified-fitness/requirements.md` - Feature requirements
- `.kiro/specs/fitquest-gamified-fitness/design.md` - Technical design
- `.kiro/specs/fitquest-gamified-fitness/tasks.md` - Implementation tasks
