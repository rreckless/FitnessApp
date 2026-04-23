# FitQuest Sync Error Handling

## Overview

The "Periodic sync failed: SyncException: Failed to pull changes" message is **expected behavior** when the backend is unavailable. FitQuest is designed with an **offline-first architecture**, which means the app continues to work seamlessly even when the backend is not accessible.

## How Offline-First Works

### When Backend is Available
- App syncs data every 30 seconds
- Changes are pushed to the server
- Server changes are pulled to the local device
- Data is kept in sync across devices

### When Backend is Unavailable
- App continues to work with local data
- All changes are stored in the local SQLite database
- Changes are queued for sync when connection is restored
- User can log workouts, view history, and access all features

## Sync Error Messages

### Expected Warnings (Not Errors)
```
Periodic sync failed (network unavailable): ...
Pull failed (backend unavailable): ...
Push failed (backend unavailable): ...
```

These are **warnings**, not errors. They indicate:
- Backend is temporarily unavailable
- App is working offline
- Changes will sync when connection is restored

### Critical Errors (Require Action)
```
Unauthorized - User needs to re-authenticate
```

## Current Implementation

### SyncEngine.ts Changes

1. **Improved Error Logging**
   - Network errors logged as warnings (not errors)
   - Clear messages indicating offline mode
   - Distinguishes between network issues and auth issues

2. **Graceful Degradation**
   - Pull failures don't stop the app
   - Push failures queue changes for later
   - Periodic sync continues attempting every 30 seconds

3. **Offline Queue Management**
   - All local changes stored in `sync_queue` table
   - Changes persist across app restarts
   - Automatic retry with exponential backoff when connection restored

## Testing Offline Functionality

### To Test Offline Mode:
1. Start the app
2. Complete onboarding and create a profile
3. Stop the backend (or disconnect from network)
4. Create a workout
5. View the workout in the app
6. Restart the app - workout should still be there
7. Reconnect to backend
8. Sync should automatically resume

### To Test Sync Recovery:
1. Make changes while offline
2. Reconnect to backend
3. App will automatically sync within 30 seconds
4. Check backend to verify changes were synced

## Backend Requirements

For sync to work, the backend must provide these endpoints:

### POST /sync/pull
**Request:**
```json
{
  "timestamp": 1234567890,
  "entityTypes": ["WORKOUT", "USER_PROFILE", ...]
}
```

**Response:**
```json
{
  "data": [
    {
      "entityType": "WORKOUT",
      "entityId": "uuid",
      "operation": "CREATE|UPDATE|DELETE",
      "data": { /* entity data */ },
      "timestamp": 1234567890
    }
  ]
}
```

### POST /sync/push
**Request:**
```json
{
  "operations": [
    {
      "id": "uuid",
      "operation": "CREATE|UPDATE|DELETE",
      "entityType": "WORKOUT",
      "entityId": "uuid",
      "payload": { /* entity data */ },
      "status": "PENDING",
      "retryCount": 0,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "successful": ["operation-id-1", "operation-id-2"],
  "failed": [
    {
      "id": "operation-id-3",
      "error": "Validation failed"
    }
  ],
  "conflicts": [
    {
      "id": "operation-id-4",
      "localVersion": { /* data */ },
      "serverVersion": { /* data */ },
      "resolution": "KEEP_LOCAL|KEEP_SERVER"
    }
  ]
}
```

## Configuration

### Sync Interval
- **Current:** 30 seconds
- **Location:** `SyncEngine.ts` line 407
- **To change:** Modify the interval in `setInterval(async () => { ... }, 30000)`

### Retry Strategy
- **Delays:** 1s, 2s, 4s, 8s (exponential backoff)
- **Max retries:** 3 attempts
- **Location:** `SyncEngine.ts` lines 24-25

### Timeout
- **Current:** 30 seconds per sync operation
- **Location:** `SyncEngine.ts` line 26

## Troubleshooting

### Sync Not Working After Backend Comes Online
1. Check that backend is running on `http://localhost:5001`
2. Verify authentication token is valid
3. Check browser console for detailed error messages
4. Restart the app to force a sync attempt

### Changes Not Syncing
1. Check network connectivity
2. Verify backend is accessible
3. Check `sync_queue` table in local database
4. Look for "Unauthorized" errors (auth issue)

### Data Inconsistency
1. Last-write-wins conflict resolution is used
2. Most recent timestamp takes precedence
3. Check `updatedAt` field on entities

## Summary

The sync error messages are **normal and expected** when the backend is unavailable. The app is designed to work seamlessly offline and will automatically sync when the connection is restored. This is a feature, not a bug.

To eliminate these messages, ensure the backend is running and accessible at `http://localhost:5001/api`.
