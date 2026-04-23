# User Profile and Onboarding Implementation

## Overview

This document describes the implementation of Task 2.19: iOS User Profile and Onboarding for the FitQuest mobile app. The implementation provides complete user profile management, preference handling, and an onboarding flow for new users.

## Architecture

### Components

1. **UserProfileService** - Manages user profile CRUD operations, preferences, and profile picture handling
2. **OnboardingService** - Manages the onboarding flow for new users
3. **UserProfileModels** - Data models and types for profiles and preferences
4. **Database Schema** - SQLite tables for storing user data

### Data Models

#### UserProfile
```typescript
interface UserProfile {
  id: string;
  email: string;
  name: string;
  bio?: string;
  profilePictureUrl?: string;
  level: number; // 1-based level
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}
```

#### UserPreferences
```typescript
interface UserPreferences {
  userId: string;
  fitnessGoals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
  workoutFrequency: number; // days per week (1-7)
  availableEquipment: Equipment[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}
```

### Enums

**FitnessGoal**
- STRENGTH
- ENDURANCE
- WEIGHT_LOSS
- MUSCLE_GAIN

**ExperienceLevel**
- BEGINNER
- INTERMEDIATE
- ADVANCED

**Equipment**
- DUMBBELLS
- BARBELL
- MACHINES
- BODYWEIGHT
- CABLES
- KETTLEBELLS

**SubscriptionTier**
- FREE
- PREMIUM

## Usage

### UserProfileService

#### Initialize Service
```typescript
import { UserProfileService } from './services/UserProfileService';
import { DatabaseService } from './database/DatabaseService';
import { SyncEngine } from './services/SyncEngine';

const db = DatabaseService.getInstance();
const syncEngine = SyncEngine.getInstance();
const profileService = UserProfileService.getInstance(db, syncEngine);

// Set current user ID after authentication
profileService.setCurrentUserId(userId);
```

#### Create User Profile
```typescript
const profile = await profileService.createUserProfile(
  userId,
  'user@example.com',
  'John Doe'
);
// Returns: UserProfile with level=1, totalXP=0, subscriptionTier=FREE
```

#### Get User Profile
```typescript
// Using current user ID
const profile = await profileService.getUserProfile();

// Using specific user ID
const profile = await profileService.getUserProfile(userId);
```

#### Update User Profile
```typescript
const updated = await profileService.updateUserProfile({
  name: 'Jane Doe',
  bio: 'Fitness enthusiast'
});
```

#### Create User Preferences
```typescript
const prefs = await profileService.createUserPreferences(
  userId,
  [FitnessGoal.STRENGTH, FitnessGoal.MUSCLE_GAIN],
  ExperienceLevel.INTERMEDIATE,
  4, // 4 days per week
  [Equipment.DUMBBELLS, Equipment.BARBELL]
);
```

#### Get User Preferences
```typescript
const prefs = await profileService.getUserPreferences();
```

#### Update User Preferences
```typescript
const updated = await profileService.updateUserPreferences({
  workoutFrequency: 5,
  availableEquipment: [Equipment.DUMBBELLS, Equipment.BARBELL, Equipment.MACHINES]
});
```

#### Upload Profile Picture
```typescript
const imageUrl = await profileService.uploadProfilePicture({
  filePath: '/local/path/to/image.jpg',
  fileName: 'profile.jpg'
});
// Returns: S3 URL for the uploaded image
```

#### Get Cached Profile Picture
```typescript
const cache = await profileService.getCachedProfilePicture();
if (cache) {
  console.log('Cached URL:', cache.url);
  console.log('Thumbnail URL:', cache.thumbnailUrl);
}
```

#### Delete Profile Picture
```typescript
await profileService.deleteProfilePicture();
```

### OnboardingService

#### Initialize Onboarding
```typescript
import { OnboardingService } from './services/OnboardingService';

const onboardingService = OnboardingService.getInstance(db, profileService);

// Start onboarding flow
const state = onboardingService.initializeOnboarding();
```

#### Onboarding Flow - Full Path
```typescript
// Step 1: Select fitness goals
onboardingService.setFitnessGoals([FitnessGoal.STRENGTH, FitnessGoal.MUSCLE_GAIN]);

// Step 2: Select experience level
onboardingService.setExperienceLevel(ExperienceLevel.BEGINNER);

// Step 3: Set workout frequency
onboardingService.setWorkoutFrequency(3); // 3 days per week

// Step 4: Select available equipment
onboardingService.setAvailableEquipment([Equipment.BODYWEIGHT, Equipment.DUMBBELLS]);

// Complete onboarding
await onboardingService.completeOnboarding(userId, email, name);
// Creates user profile at Level 1 with 0 XP
// Creates user preferences with selected values
```

#### Onboarding Flow - Skip Path
```typescript
// Initialize onboarding
onboardingService.initializeOnboarding();

// Skip onboarding
onboardingService.skipOnboarding();

// Complete with defaults
await onboardingService.completeOnboarding(userId, email, name);
// Creates user profile at Level 1 with 0 XP
// Creates user preferences with defaults:
//   - fitnessGoals: [STRENGTH]
//   - experienceLevel: BEGINNER
//   - workoutFrequency: 3
//   - availableEquipment: [BODYWEIGHT]
```

#### Get Onboarding Progress
```typescript
const progress = onboardingService.getOnboardingProgress();
// Returns: 0-100 (percentage)
// 0% - No steps completed
// 25% - Goals selected
// 50% - Goals + Experience selected
// 75% - Goals + Experience + Frequency selected
// 100% - All steps completed
```

#### Check Onboarding Completion
```typescript
const isComplete = onboardingService.isOnboardingComplete();
```

#### Get Current Onboarding State
```typescript
const state = onboardingService.getOnboardingState();
// Returns: OnboardingState with current step and selections
```

#### Reset Onboarding
```typescript
onboardingService.resetOnboarding();
```

## Database Schema

### users table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profilePictureUrl TEXT,
  bio TEXT,
  level INTEGER DEFAULT 1,
  totalXP INTEGER DEFAULT 0,
  currentStreak INTEGER DEFAULT 0,
  longestStreak INTEGER DEFAULT 0,
  subscriptionTier TEXT DEFAULT 'FREE',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT
)
```

### user_preferences table
```sql
CREATE TABLE user_preferences (
  userId TEXT PRIMARY KEY,
  fitnessGoals TEXT NOT NULL,
  experienceLevel TEXT NOT NULL,
  workoutFrequency INTEGER NOT NULL,
  availableEquipment TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  FOREIGN KEY (userId) REFERENCES users(id)
)
```

### profile_picture_cache table
```sql
CREATE TABLE profile_picture_cache (
  userId TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  thumbnailUrl TEXT,
  cachedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
)
```

## Validation

### Profile Validation
- Name: 1-100 characters
- Bio: max 500 characters
- Email: valid email format

### Preferences Validation
- Fitness Goals: at least one goal required
- Experience Level: must be valid enum value
- Workout Frequency: 1-7 days per week
- Available Equipment: at least one equipment type required

### Profile Picture Validation
- Max size: 5MB
- Supported formats: JPEG, PNG, WebP
- Automatic compression and thumbnail generation

## Error Handling

All services throw `UserProfileException` with specific error codes:

```typescript
enum UserProfileError {
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PREFERENCES_NOT_FOUND = 'PREFERENCES_NOT_FOUND',
  INVALID_PROFILE_DATA = 'INVALID_PROFILE_DATA',
  INVALID_PREFERENCES_DATA = 'INVALID_PREFERENCES_DATA',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}
```

### Example Error Handling
```typescript
try {
  const profile = await profileService.getUserProfile();
} catch (error) {
  if (error instanceof UserProfileException) {
    switch (error.code) {
      case UserProfileError.PROFILE_NOT_FOUND:
        console.log('User profile not found');
        break;
      case UserProfileError.DATABASE_ERROR:
        console.log('Database error:', error.message);
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

## Sync Integration

All profile and preference operations are automatically queued for sync:

- **CREATE** - When profile or preferences are first created
- **UPDATE** - When profile or preferences are modified
- **DELETE** - When profile picture is deleted

The sync queue ensures data is persisted to the cloud when connection is available.

## Testing

### Unit Tests
- 50 unit tests covering all functionality
- Tests for profile CRUD operations
- Tests for preference management
- Tests for onboarding flow
- Tests for error handling

### Property-Based Tests
- **Property 1: Profile Creation Idempotency** - Creating and retrieving profiles returns identical data
- **Property 2: Preferences Persistence** - Preferences are preserved exactly as created
- **Property 3: Profile Update Consistency** - Updates reflect changes while preserving unchanged fields
- **Property 4: Onboarding Flow Progression** - Each step advances correctly and preserves data
- **Property 5: Onboarding Completion Initializes User at Level 1** - Completed onboarding creates user at Level 1 with 0 XP
- **Property 6: Skip Onboarding Uses Defaults** - Skipped onboarding applies default preferences
- **Property 7: Onboarding Progress Monotonically Increases** - Progress increases as steps are completed

### Running Tests
```bash
npm test -- --testPathPattern="UserProfileService|OnboardingService"
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 2.1** - User profile stores name, email, profile picture, and bio
- **Requirement 2.2** - User profile updates persist to local storage and sync to cloud
- **Requirement 2.3** - User profile allows setting fitness goals
- **Requirement 2.4** - User profile allows setting workout frequency
- **Requirement 2.5** - User profile allows selecting available equipment
- **Requirement 2.6** - User profile allows setting experience level
- **Requirement 3.1** - Onboarding presents goal selection
- **Requirement 3.2** - Onboarding presents experience level selection
- **Requirement 3.3** - Onboarding presents workout frequency selection
- **Requirement 3.4** - Onboarding presents equipment availability selection
- **Requirement 3.5** - Onboarding saves preferences and initializes user at Level 1 with 0 XP
- **Requirement 3.6** - Onboarding allows users to skip or modify selections

## Future Enhancements

1. **Profile Visibility Controls** - Allow users to control who can see their profile
2. **Advanced Image Processing** - Implement server-side image optimization
3. **Profile Themes** - Allow users to customize profile appearance
4. **Social Profiles** - Link to social media accounts
5. **Profile Analytics** - Track profile view statistics
6. **Preference Recommendations** - AI-powered preference suggestions based on goals

## Performance Considerations

- Profile pictures are cached locally with 7-day expiration
- Database queries use indexes for fast lookups
- Sync operations are queued and batched
- Validation is performed before database operations
- Error handling prevents cascading failures

## Security Considerations

- Profile data is encrypted at rest using AES-256
- All data in transit uses TLS 1.2+
- Profile pictures are validated before upload
- User IDs are validated before operations
- Email addresses are validated for format
- Sensitive operations require authentication
