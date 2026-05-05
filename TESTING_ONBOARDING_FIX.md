# Testing the Onboarding Fix

## Manual Testing Steps

### Prerequisites
1. Backend services running (Auth Service on port 5001, Sync Service on port 5002)
2. PostgreSQL database with tables created
3. iOS simulator running (iPhone 17 Pro)
4. Metro bundler running

### Test Scenario: Complete Onboarding Flow

#### Step 1: Register New User
1. Launch the app
2. Click "Create Account"
3. Enter email: `test@example.com`
4. Enter password: `TestPassword123!`
5. Click "Create Account"
6. **Expected**: Registration succeeds, user created on backend, session retrieved

#### Step 2: Complete Onboarding
1. Select fitness goals (e.g., "Build Strength")
2. Click "Next"
3. Select experience level (e.g., "Beginner")
4. Click "Next"
5. Select workout frequency (e.g., "3 days per week")
6. Click "Next"
7. Select equipment (e.g., "Bodyweight")
8. Click "Next"
9. Review summary
10. Click "Get Started"
11. **Expected**: 
    - No error alerts
    - Navigation to home screen
    - Onboarding marked as complete
    - Sync operations queued for preferences

#### Step 3: Verify Sync Operations
1. Check console logs for:
   - `[UserProfileService] Creating user preferences for userId: <userId>`
   - `[UserProfileService] Skipping local SQLite insert (will sync from backend)`
   - `[UserProfileService] Queueing sync operation for preferences...`
   - `[UserProfileService] Sync operation queued successfully`

#### Step 4: Verify Backend Receives Data
1. Check backend logs for sync operations
2. Verify user preferences created in PostgreSQL
3. Verify user profile updated with `onboardingCompleted: true`

#### Step 5: Verify Sync Pulls Data Back
1. Trigger sync (automatic or manual)
2. Check console logs for sync pull operations
3. Verify local SQLite database has user preferences
4. Verify user can view their profile with preferences

## Expected Console Output

```
[UserProfileService] Creating user preferences for userId: 19f1dc9c-9c4e-40e2-8f25-f3060ef39d31
[UserProfileService] Preferences: {
  userId: '19f1dc9c-9c4e-40e2-8f25-f3060ef39d31',
  fitnessGoals: ['STRENGTH'],
  experienceLevel: 'BEGINNER',
  workoutFrequency: 3,
  availableEquipment: ['BODYWEIGHT'],
  createdAt: '2026-04-24T08:02:59.764Z',
  updatedAt: '2026-04-24T08:02:59.764Z'
}
[UserProfileService] Skipping local SQLite insert (will sync from backend)
[UserProfileService] Queueing sync operation for preferences...
[UserProfileService] Sync operation queued successfully
[UserProfileService] User preferences created successfully (in-memory)
```

## Success Criteria

✅ User can complete onboarding without errors
✅ No "User does not exist in database" errors
✅ No "Cannot create preferences for non-existent user" errors
✅ Sync operations are queued successfully
✅ Backend receives user preferences
✅ User profile marked as `onboardingCompleted: true`
✅ Sync pulls data back to local database
✅ User can view their profile with preferences

## Troubleshooting

### If you see "User does not exist in database" error:
1. Check that backend is running
2. Check that user was created on backend during registration
3. Check that sync operations are being queued
4. Check backend logs for sync operation handling

### If you see "Cannot create preferences for non-existent user" error:
1. This should NOT happen with the fix
2. If it does, check that the fix was applied correctly
3. Verify `createUserPreferences()` is skipping SQLite insert
4. Check console logs for "Skipping local SQLite insert" message

### If sync operations are not queued:
1. Check that SyncEngine is initialized
2. Check that sync queue is working
3. Check console logs for sync operation errors
4. Verify backend is receiving sync operations

## Regression Testing

Run the full test suite to ensure no regressions:
```bash
npm test
```

Expected: All 152 tests pass

## Performance Testing

Monitor the following during onboarding:
- Time to complete onboarding: < 5 seconds
- Memory usage: < 100MB
- CPU usage: < 50%
- Network requests: 2-3 (registration + sync operations)
