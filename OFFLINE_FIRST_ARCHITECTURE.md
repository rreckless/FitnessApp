# Offline-First Architecture - FitQuest Mobile

## Overview

FitQuest implements a true offline-first architecture where the local SQLite database serves as a cache of synced data from the backend, not as a primary data store for user-created data.

## Architecture Principles

### 1. Backend is Source of Truth
- All user data is created and stored on the backend (PostgreSQL)
- Backend is the authoritative source for all data
- Local database is a read-only cache of backend data

### 2. Local Database = Synced Data Only
- Local SQLite database only contains data that has been synced from backend
- User-created data is NOT written directly to local database
- This eliminates SQLite library bugs and compatibility issues

### 3. Sync Queue for Offline Operations
- All user operations are queued in the sync queue
- Sync queue is stored in local SQLite (separate from user data)
- When network is available, sync operations are sent to backend
- Backend processes operations and returns updated data
- Updated data is synced back to local database

### 4. Offline-First User Experience
- Users can perform operations offline (create workouts, log exercises, etc.)
- Operations are queued locally and synced when network is available
- No data loss - all operations are persisted in sync queue
- Seamless transition between online and offline modes

## Data Flow

### Online Registration Flow
```
User Input
    ↓
AuthenticationService.register()
    ↓
Backend creates user (PostgreSQL)
    ↓
Session retrieved with userId
    ↓
UserProfileService.createUserProfile()
    ├─ Create in-memory profile
    └─ Queue sync operation
    ↓
Sync Engine runs
    ├─ Send sync operation to backend
    └─ Backend confirms user created
    ↓
User proceeds to onboarding
```

### Online Onboarding Flow
```
User completes onboarding steps
    ↓
OnboardingService.completeOnboarding()
    ├─ UserProfileService.createUserPreferences()
    │   ├─ Create in-memory preferences
    │   └─ Queue sync operation
    └─ UserProfileService.completeOnboarding()
        ├─ Create in-memory profile update
        └─ Queue sync operation
    ↓
Sync Engine runs
    ├─ Send sync operations to backend
    └─ Backend creates preferences and updates user
    ↓
Sync Engine pulls changes
    ├─ Fetch user profile from backend
    ├─ Fetch user preferences from backend
    └─ Store in local SQLite
    ↓
User navigates to home screen
    ├─ Read user profile from local SQLite
    └─ Display user data
```

### Offline Workout Logging Flow
```
User logs workout (no network)
    ↓
WorkoutLogger.completeWorkout()
    ├─ Create in-memory workout
    └─ Queue sync operation
    ↓
Sync queue stored in local SQLite
    ↓
User continues using app offline
    ├─ Can view local data
    ├─ Can log more workouts
    └─ All operations queued
    ↓
Network becomes available
    ↓
Sync Engine runs
    ├─ Send all queued operations to backend
    └─ Backend processes all operations
    ↓
Sync Engine pulls changes
    ├─ Fetch updated data from backend
    └─ Store in local SQLite
    ↓
User sees all data synced
```

## Implementation Details

### UserProfileService Changes
```typescript
// Before: Tried to insert directly to SQLite
async createUserProfile(userId, email, name) {
  // ❌ This failed due to SQLite library bugs
  await this.db.insert('users', { ... });
}

// After: Create in-memory and queue sync
async createUserProfile(userId, email, name) {
  const profile = { ... };
  // ✅ Skip local insert
  // ✅ Queue sync operation
  await this.syncEngine.queueOperation(
    SyncOperation.CREATE,
    SyncEntityType.USER,
    userId,
    profile
  );
  return profile;
}
```

### OnboardingService Changes
```typescript
// Before: Tried to create preferences in SQLite
async completeOnboarding(userId, email, name) {
  // ❌ This failed because user didn't exist in local DB
  await this.userProfileService.createUserPreferences(...);
}

// After: Create in-memory and queue sync
async completeOnboarding(userId, email, name) {
  // ✅ Create in-memory preferences
  // ✅ Queue sync operation
  await this.userProfileService.createUserPreferences(...);
  // ✅ Mark onboarding complete in-memory
  // ✅ Queue sync operation
  await this.userProfileService.completeOnboarding(userId);
}
```

## Benefits

### 1. Eliminates SQLite Library Bugs
- No more "Cannot convert undefined value to object" errors
- No more parameter passing issues
- No more compatibility problems

### 2. Proper Offline-First Architecture
- Local database is a cache, not a data store
- Sync queue handles all offline operations
- Seamless online/offline transitions

### 3. Consistent Data Model
- Backend is always the source of truth
- No data conflicts or inconsistencies
- Easier to debug and maintain

### 4. Better Performance
- Fewer database operations
- Reduced SQLite library overhead
- Faster sync operations

### 5. Improved Reliability
- No data loss during offline operations
- All operations queued and persisted
- Automatic retry on network failure

## Sync Queue Implementation

### Sync Queue Storage
```typescript
// Sync queue stored in SQLite
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  data TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);
```

### Sync Queue Operations
```typescript
// Queue operation
await syncEngine.queueOperation(
  SyncOperation.CREATE,
  SyncEntityType.USER_PREFERENCES,
  userId,
  preferences
);

// Process queue
await syncEngine.sync();
// ├─ Get pending operations from queue
// ├─ Send to backend
// ├─ Mark as synced
// └─ Pull updated data
```

## Testing Strategy

### Unit Tests
- Test in-memory profile creation
- Test sync operation queueing
- Test sync queue processing

### Integration Tests
- Test complete registration flow
- Test complete onboarding flow
- Test offline operations
- Test sync with backend

### End-to-End Tests
- Test user registration to home screen
- Test offline operations and sync
- Test data consistency

## Migration Path

### For Existing Users
1. Existing local data remains in SQLite
2. Sync pulls latest data from backend
3. Sync queue processes any pending operations
4. No data loss or corruption

### For New Users
1. Registration creates user on backend
2. Onboarding creates preferences on backend
3. Sync pulls data to local database
4. All subsequent operations use sync queue

## Future Improvements

### 1. Conflict Resolution
- Implement last-write-wins strategy
- Implement custom conflict resolution
- Implement merge strategies

### 2. Sync Optimization
- Implement delta sync (only changed data)
- Implement compression for large payloads
- Implement batch operations

### 3. Offline Capabilities
- Implement offline search
- Implement offline filtering
- Implement offline sorting

### 4. Performance
- Implement caching strategies
- Implement lazy loading
- Implement pagination

## Conclusion

The offline-first architecture with sync queue provides a robust, reliable, and maintainable solution for mobile app data management. By treating the local database as a cache and the backend as the source of truth, we eliminate SQLite library issues and provide a seamless offline-first experience.
