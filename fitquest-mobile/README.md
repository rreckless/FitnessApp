# FitQuest Mobile App - iOS (React Native/TypeScript)

## Overview

FitQuest Mobile is a React Native application for iOS that implements an offline-first architecture with cloud synchronization. The app allows users to log workouts, track progress, and compete with friends while maintaining full functionality without internet connectivity.

## Architecture

### Key Components

1. **AuthenticationService** - Handles user authentication, session management, and secure token storage
2. **SyncEngine** - Manages offline-first synchronization with conflict resolution
3. **DatabaseService** - SQLite database management for local data persistence
4. **DeviceFingerprintService** - Generates and manages device fingerprints for security

### Storage Architecture

```
Local Storage:
├── SQLite Database (fitquest.db)
│   ├── users
│   ├── workouts
│   ├── workout_exercises
│   ├── exercises
│   ├── muscle_group_ranks
│   ├── achievements
│   ├── user_achievements
│   ├── personal_records
│   ├── friendships
│   ├── activity_feed
│   ├── body_weight
│   ├── body_measurements
│   ├── progress_photos
│   └── sync_queue
├── AsyncStorage (key-value pairs)
│   ├── user_token
│   ├── user_id
│   ├── last_sync_time
│   └── app_preferences
└── Keychain (secure storage)
    ├── refresh_token
    └── device_fingerprint
```

## Installation

### Prerequisites

- Node.js 16+ and npm/yarn
- React Native CLI
- Xcode 14+ (for iOS development)
- CocoaPods

### Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Install iOS pods:
```bash
cd ios
pod install
cd ..
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API base URL
```

## Usage

### Authentication

```typescript
import { AuthenticationService } from './src/services/AuthenticationService';

const authService = AuthenticationService.getInstance('http://localhost:5000/api');

// Register
const registerResponse = await authService.register({
  email: 'user@example.com',
  password: 'ValidPass123!',
  name: 'John Doe',
});

// Login
const loginResponse = await authService.login({
  email: 'user@example.com',
  password: 'ValidPass123!',
});

// Check authentication status
const isAuthenticated = await authService.isAuthenticated();

// Logout
await authService.logout();
```

### Sync Engine

```typescript
import { SyncEngine } from './src/services/SyncEngine';
import { SyncOperation, SyncEntityType } from './src/models/SyncModels';

const syncEngine = SyncEngine.getInstance('http://localhost:5000/api');

// Initialize sync engine
await syncEngine.initialize();

// Queue a workout operation
await syncEngine.queueOperation(
  SyncOperation.CREATE,
  SyncEntityType.WORKOUT,
  'workout123',
  {
    startTime: new Date().toISOString(),
    exercises: [
      { exerciseId: 'ex1', sets: 3, reps: 10, weight: 100 }
    ]
  }
);

// Perform sync
await syncEngine.sync();

// Get sync status
const status = await syncEngine.getSyncStatus();
console.log(`Pending: ${status.pendingCount}, Failed: ${status.failedCount}`);

// Cleanup old data
await syncEngine.cleanupOldData();

// Shutdown
await syncEngine.shutdown();
```

### Database Operations

```typescript
import DatabaseService from './src/database/DatabaseService';

const db = DatabaseService.getInstance();

// Initialize database
await db.initialize();

// Insert
await db.insert('workouts', {
  id: 'workout123',
  userId: 'user123',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  duration: 3600,
  totalVolume: 5000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Query
const workouts = await db.queryAll(
  'SELECT * FROM workouts WHERE userId = ? ORDER BY createdAt DESC',
  ['user123']
);

// Update
await db.update(
  'workouts',
  { totalVolume: 5500, updatedAt: new Date().toISOString() },
  'id = ?',
  ['workout123']
);

// Delete
await db.delete('workouts', 'id = ?', ['workout123']);

// Close database
await db.close();
```

## Password Requirements

Passwords must meet the following requirements:
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}';:"\\|,.<>/?

Example valid password: `SecurePass123!`

## Token Management

- **Access Token**: 15-minute expiry
- **Refresh Token**: 7-day expiry
- Tokens are automatically refreshed 2 minutes before expiry
- Refresh tokens are stored securely in Keychain
- Access tokens are stored in AsyncStorage

## Sync Strategy

### Offline-First Architecture

1. All operations are saved locally first
2. Operations are queued in the sync_queue table
3. When connection is available, operations are synced to the server
4. Conflicts are resolved using last-write-wins (most recent timestamp wins)
5. Failed operations are retried with exponential backoff (1s, 2s, 4s, 8s)

### Sync Status

- **PENDING**: Operation waiting to be synced
- **SYNCING**: Operation currently being synced
- **SYNCED**: Operation successfully synced
- **FAILED**: Operation failed after max retries

### Conflict Resolution

When a conflict is detected:
1. Compare local and remote timestamps
2. Use the version with the most recent timestamp
3. Log the conflict for debugging
4. Continue with other operations

### Data Retention

- Offline history: 30 days
- Synced data is cleaned up after 30 days
- Failed operations are retained for debugging

## Testing

### Run Tests

```bash
npm test
# or
yarn test
```

### Run Tests with Coverage

```bash
npm run test:coverage
# or
yarn test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
# or
yarn test:watch
```

### Test Structure

- **Unit Tests**: Test individual functions and methods
- **Property-Based Tests**: Test universal properties across many inputs
- **Integration Tests**: Test service-to-service communication

## Security

### Authentication Security

- Passwords hashed with bcrypt
- JWT tokens with refresh token rotation
- Device fingerprinting for security
- Rate limiting to prevent brute force attacks
- Account lockout after 5 failed attempts (15-minute lockout)

### Data Security

- Secure token storage in Keychain
- Encrypted data in transit (TLS 1.2+)
- Device fingerprint verification
- Session management with automatic logout

### Privacy

- No sensitive data logged
- Secure deletion of session data on logout
- GDPR/CCPA compliant data handling

## Performance

### Targets

- App launch: < 1000ms
- Screen navigation: < 500ms
- Exercise search: < 200ms
- List scrolling: 60 FPS
- Workout logging: < 100ms per set entry
- Sync latency: < 30 seconds

### Optimization

- Aggressive caching with SQLite
- Lazy loading of images
- Pagination for large lists
- Indexed database queries
- Efficient sync queue management

## Troubleshooting

### Database Issues

If you encounter database errors:
1. Clear app data: `npm run clean`
2. Reinstall dependencies: `npm install`
3. Rebuild iOS app: `npm run ios`

### Authentication Issues

If login fails:
1. Check API base URL in environment variables
2. Verify server is running
3. Check network connectivity
4. Review authentication logs

### Sync Issues

If sync fails:
1. Check network connectivity
2. Verify authentication token is valid
3. Check sync queue status: `await syncEngine.getSyncStatus()`
4. Review sync logs for errors

## API Integration

### Authentication Endpoints

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### Sync Endpoints

- `POST /sync/pull` - Pull changes from server
- `POST /sync/push` - Push local changes to server
- `GET /sync/status` - Get sync status

## Development

### Project Structure

```
src/
├── database/
│   ├── DatabaseService.ts
│   └── schema.ts
├── models/
│   ├── AuthModels.ts
│   └── SyncModels.ts
├── services/
│   ├── AuthenticationService.ts
│   ├── DeviceFingerprintService.ts
│   ├── SyncEngine.ts
│   └── __tests__/
│       ├── AuthenticationService.test.ts
│       └── SyncEngine.test.ts
└── utils/
    └── (utility functions)
```

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for code formatting
- Jest for testing

### Type Safety

All code is written in TypeScript with strict type checking enabled. No `any` types are used without explicit justification.

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Submit a pull request

## License

MIT

## Support

For issues or questions, please contact the development team or open an issue in the repository.
