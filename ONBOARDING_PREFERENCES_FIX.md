# Onboarding Preferences Creation Fix

## Issue
When completing onboarding, the app was throwing:
```
UserProfileException: Failed to create user preferences
```

## Root Cause
The user profile was not being created in the local SQLite database during registration. Here's what was happening:

1. User registers on backend (Auth Service) ✅
2. User profile is created on backend ✅
3. User goes to onboarding ✅
4. When completing onboarding, app tries to create preferences in local SQLite ❌
5. **But the user doesn't exist in local SQLite yet!** ← This was the problem

The `createUserPreferences()` method has a check to verify the user exists before creating preferences:
```typescript
const userExists = await this.db.queryOne('SELECT id FROM users WHERE id = ?', [userId]);
if (!userExists) {
  throw new UserProfileException(
    UserProfileError.DATABASE_ERROR,
    'User does not exist. Cannot create preferences for non-existent user.',
    { userId }
  );
}
```

This check was failing because the user profile was never created in the local database.

## Solution
Updated the `RegisterScreen` in both `FitQuestNative` and `fitquest-mobile` to create the user profile in the local SQLite database immediately after successful registration.

### Changes Made

#### FitQuestNative/src/screens/RegisterScreen.tsx
```typescript
const handleRegister = async () => {
  if (!validateForm()) return;

  setLoading(true);
  try {
    const authService = AuthenticationService.getInstance('http://localhost:5001');
    await authService.register({
      name,
      email,
      password,
    });

    // Get the session to retrieve user ID
    const session = await authService.getSession();
    if (session?.userId) {
      // Create user profile in local database with onboardingCompleted: false
      const profileService = UserProfileService.getInstance();
      await profileService.createUserProfile(session.userId, email, name);
      console.log('User profile created in local database:', session.userId);
    }

    onRegisterSuccess();
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof AuthException) {
      Alert.alert('Registration Failed', error.message);
    } else {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  } finally {
    setLoading(false);
  }
};
```

#### fitquest-mobile/src/screens/RegisterScreen.tsx
Applied the same fix - added import for `UserProfileService` and updated `handleRegister` to create the user profile in local database.

## Flow After Fix

1. User registers on backend (Auth Service) ✅
2. User profile is created on backend ✅
3. **User profile is created in local SQLite** ✅ ← NEW
4. User goes to onboarding ✅
5. When completing onboarding, app creates preferences in local SQLite ✅
6. User is taken to home screen ✅

## Verification

After the fix:
1. Register a new user
2. Complete all onboarding steps
3. Click "Get Started" on final step
4. User should be taken to home screen without errors
5. Check console logs for: "User profile created in local database: [userId]"

## Files Modified
- `FitQuestNative/src/screens/RegisterScreen.tsx`
- `fitquest-mobile/src/screens/RegisterScreen.tsx`

## Status
✅ All TypeScript diagnostics passing
✅ Ready for testing

## Testing Checklist
- [ ] Register a new user
- [ ] Complete all onboarding steps
- [ ] Click "Get Started" on final step
- [ ] Verify user is taken to home screen
- [ ] Check console logs for success messages
- [ ] Verify preferences are saved to local SQLite
- [ ] Kill and restart app
- [ ] Verify preferences persist
