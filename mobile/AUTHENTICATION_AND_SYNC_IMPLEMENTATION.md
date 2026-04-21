# iOS Authentication and Sync Implementation (Task 2.16)

## Overview

This document describes the implementation of iOS Authentication and Sync services for the FitQuest mobile app, including secure token storage, JWT token refresh logic, session management, device fingerprinting, and offline-first sync architecture with conflict detection.

## Implemented Features

### 1. AuthenticationService Enhancements

#### Secure Token Storage (Keychain)
- Tokens are stored securely in the device's Keychain
- Access tokens and refresh tokens are stored separately
- Tokens are cleared on logout
- Keychain service: `com.fitquest.auth`

#### JWT Token Refresh Logic
- Automatic token refresh before expiration (5-minute threshold)
- Refresh timer runs every 60 seconds to check token expiration
- Automatic retry on 401 Unauthorized responses
- Response interceptor handles token refresh transparently

#### Device Fingerprinting
- Unique device ID generated on first app launch
- Device fingerprint includes:
  - Device ID (UUID)
  - Platform (iOS/Android)
  - OS Version
  - App Version
  - Creation timestamp
- Device fingerprint sent in request headers (`X-Device-ID`, `X-Platform`)
- Fingerprint cached in AsyncStorage for persistence

#### Session Management
- Current user stored in AsyncStorage
- Authentication state tracked in memory
- Automatic session restoration on app launch
- Logout clears all session data and tokens

### 2. SyncEngine Enhancements

#### Offline-First Architecture
- All operations queued locally before syncing
- SQLite-based sync queue with status tracking
- Supports offline operation for:
  - Workout creation/update/delete
  - Weight logging
  - Body measurements
  - Progress photos

#### Sync Queue Management
- Queue operations with: userId, operation type, entity type, entity ID, payload
- Track sync status: PENDING, SYNCING, SYNCED, FAILED
- Retry count tracking for failed operations
- Clear synced operations after successful sync

#### Conflict Detection
- Timestamp-based conflict detection
- Compares local and remote timestamps
- Detects conflicts on UPDATE and DELETE operations
- Conflict resolution endpoint: `/sync/check-conflict`

#### Last-Write-Wins Conflict Resolution
- Compares local and remote timestamps
- Local version wins if timestamp is newer
- Remote version wins if timestamp is newer
- Automatic fetch and apply of remote version when remote wins
- Conflict resolution logged for debugging

#### Exponential Backoff Retry Logic
- Retry delays: 1s, 2s, 4s, 8s (max 4 retries)
- Automatic retry on network failures
- Retry count incremented on each failure
- Failed operations marked after max retries

## API Endpoints Used

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh
- `POST /auth/password-reset` - Password reset request
- `POST /auth/password-reset/confirm` - Password reset confirmation

### Sync
- `POST /sync/pull` - Pull changes from cloud
- `POST /sync/push` - Push local changes to cloud
- `GET /sync/status` - Get sync status
- `GET /sync/check-conflict` - Check for conflicts
- `GET /sync/pull-entity` - Pull specific entity

## Data Models

### DeviceFingerprint
```typescript
interface DeviceFingerprint {
  deviceId: string;        // UUID
  platform: string;        // 'ios' or 'android'
  osVersion: string;       // Platform version
  appVersion: string;      // App version
  createdAt: string;       // ISO timestamp
}
```

### ConflictResolution
```typescript
interface ConflictResolution {
  entityId: string;
  entityType: string;
  localTimestamp: string;
  remoteTimestamp: string;
  winner: 'local' | 'remote';
  reason: string;
}
```

### SyncQueueItem
```typescript
interface SyncQueueItem {
  id: string;
  userId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  payload?: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Database Schema

### sync_queue Table
```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  operation TEXT,
  entityType TEXT,
  entityId TEXT,
  payload TEXT,
  status TEXT DEFAULT 'PENDING',
  retryCount INTEGER DEFAULT 0,
  lastError TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(userId) REFERENCES users(id)
)
```

## Testing

### Unit Tests
- `AuthenticationService.test.ts` - Core authentication tests (21 tests)
- `AuthenticationService.device-fingerprint.test.ts` - Device fingerprinting and token refresh (9 tests)
- `SyncEngine.test.ts` - Sync queue management tests
- `SyncEngine.conflict-resolution.test.ts` - Conflict detection and resolution (9 tests)

### Test Coverage
- Device fingerprint creation and caching
- Token refresh logic and expiration detection
- Conflict detection using timestamps
- Last-write-wins resolution
- Sync queue operations (queue, retrieve, clear)
- Sync status tracking
- Exponential backoff retry logic

## Usage Examples

### Login with Device Fingerprinting
```typescript
const authService = AuthenticationService.getInstance();
const response = await authService.login('user@example.com', 'Password123!');
// Device fingerprint automatically created and sent in headers
```

### Automatic Token Refresh
```typescript
// Token refresh happens automatically every 60 seconds
// If token expires within 5 minutes, it's refreshed
// No manual intervention needed
```

### Queue Offline Operation
```typescript
const syncEngine = SyncEngine.getInstance();
await syncEngine.queueOperation(
  userId,
  'CREATE',
  'WORKOUT',
  'workout-123',
  JSON.stringify({ duration: 3600, volume: 5000 })
);
```

### Sync with Conflict Resolution
```typescript
const result = await syncEngine.syncAll(userId);
console.log(`Synced: ${result.synced}, Failed: ${result.failed}, Conflicts: ${result.conflicts.length}`);
// Conflicts are automatically resolved using last-write-wins
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **1.1**: User authentication with email/password
- **1.2**: User profile management
- **1.3**: Onboarding flow
- **1.4**: Exercise library
- **1.5**: Workout logging
- **1.6**: XP and progression system
- **24.1**: Offline-first architecture
- **24.2**: Offline sync queue management
- **24.3**: Conflict detection using timestamps
- **24.4**: Last-write-wins conflict resolution
- **24.5**: Sync status display
- **24.6**: 30-day local history maintenance

## Security Considerations

1. **Token Storage**: Tokens stored in Keychain (iOS) with secure access
2. **Device Fingerprinting**: Unique device ID prevents unauthorized access
3. **Token Refresh**: Automatic refresh prevents token expiration attacks
4. **HTTPS**: All API calls use HTTPS with TLS 1.2+
5. **Password Validation**: Strong password requirements enforced
6. **Session Management**: Automatic logout on token refresh failure

## Performance Optimizations

1. **Caching**: Device fingerprint cached in memory and AsyncStorage
2. **Batching**: Sync operations processed in batches
3. **Lazy Loading**: Tokens loaded on-demand
4. **Exponential Backoff**: Prevents server overload on failures
5. **Conflict Detection**: Minimizes unnecessary syncs

## Future Enhancements

1. **Biometric Authentication**: Face ID / Touch ID support
2. **Multi-Device Sync**: Sync across multiple devices
3. **Selective Sync**: User-controlled sync preferences
4. **Sync Analytics**: Track sync performance metrics
5. **Offline Indicators**: UI indicators for sync status
6. **Bandwidth Optimization**: Compress sync payloads
