# Swift to React Native Migration Guide

## Overview
FitQuest has been converted from native Swift (iOS only) to React Native for cross-platform iOS and Android support.

## Project Structure

### Before (Swift)
```
ios/
├── FitQuest/
│   ├── FitQuest/
│   │   ├── Services/
│   │   │   ├── AuthenticationService.swift
│   │   │   ├── WorkoutLoggerService.swift
│   │   │   ├── StreakService.swift
│   │   │   └── ...
│   │   └── ...
│   └── FitQuestTests/
│       └── Services/
```

### After (React Native)
```
mobile/
├── src/
│   ├── services/
│   │   ├── AuthenticationService.ts
│   │   ├── WorkoutLoggerService.ts
│   │   ├── StreakService.ts
│   │   └── ...
│   ├── database/
│   │   └── DatabaseManager.ts
│   ├── types/
│   │   └── index.ts
│   └── __tests__/
│       ├── WorkoutLoggerService.test.ts
│       ├── StreakService.test.ts
│       └── ...
├── package.json
├── tsconfig.json
└── ...
```

## Key Changes

### 1. Language & Runtime
- **Before**: Swift (iOS only)
- **After**: TypeScript/JavaScript (iOS + Android)

### 2. Database
- **Before**: SQLite via GRDB
- **After**: SQLite via react-native-sqlite-storage

### 3. Local Storage
- **Before**: Keychain (iOS native)
- **After**: react-native-keychain (cross-platform)

### 4. Type System
- **Before**: Swift's native type system
- **After**: TypeScript interfaces and enums

### 5. Async Operations
- **Before**: Swift async/await
- **After**: JavaScript async/await (same syntax, different runtime)

## Migration Mapping

### WorkoutLoggerService

#### Swift → React Native
```swift
// Swift
class WorkoutLoggerService {
    static let shared = WorkoutLoggerService()
    func startWorkout(userId: String) -> WorkoutSession
}

// React Native
class WorkoutLoggerService {
    static getInstance(): WorkoutLoggerService
    startWorkout(userId: string): WorkoutSession
}
```

#### Key Methods
| Swift | React Native | Notes |
|-------|--------------|-------|
| `startWorkout(userId:)` | `startWorkout(userId)` | Same functionality |
| `addExercise(to:...)` | `addExercise(workout, ...)` | Immutable pattern |
| `addSet(to:...)` | `addSet(workout, ...)` | Immutable pattern |
| `completeWorkout(_:)` | `completeWorkout(workout)` | Async function |
| `getWorkout(id:userId:)` | `getWorkout(id, userId)` | Async function |
| `getWorkouts(userId:...)` | `getWorkouts(userId, ...)` | Async function |

### StreakService

#### Swift → React Native
```swift
// Swift
class StreakService {
    func incrementStreak(userId: String, workoutDate: Date) throws
    func checkStreakMilestone(_ streak: Int) -> StreakMilestone?
}

// React Native
class StreakService {
    async incrementStreak(userId: string, workoutDate: Date): Promise<StreakData>
    checkStreakMilestone(currentStreak: number): StreakMilestone | null
}
```

#### Key Methods
| Swift | React Native | Notes |
|-------|--------------|-------|
| `incrementStreak(userId:workoutDate:)` | `incrementStreak(userId, workoutDate)` | Now async |
| `checkAndResetStreak(userId:)` | `checkAndResetStreak(userId)` | Now async |
| `getStreakData(userId:)` | `getStreakData(userId)` | Now async |
| `checkStreakMilestone(_:)` | `checkStreakMilestone(currentStreak)` | Synchronous |
| `getNextMilestone(_:)` | `getNextMilestone(currentStreak)` | Synchronous |

## Data Type Conversions

### Swift → TypeScript

| Swift | TypeScript |
|-------|-----------|
| `String` | `string` |
| `Int` | `number` |
| `Float` | `number` |
| `Date` | `Date` |
| `Bool` | `boolean` |
| `Array<T>` | `T[]` |
| `Optional<T>` | `T \| undefined` |
| `Enum` | `enum` or `type` |
| `Struct` | `interface` |
| `Error` | `Error` (class extending Error) |

### Example: WorkoutSession

```swift
// Swift
struct WorkoutSession: Codable {
    let id: String
    let userId: String
    var startTime: Date
    var endTime: Date?
    var exercises: [WorkoutExerciseEntry]
    var notes: String?
    var isOfflineCreated: Bool
    var syncedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
}

// TypeScript
interface WorkoutSession {
    id: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    exercises: WorkoutExerciseEntry[];
    notes?: string;
    isOfflineCreated: boolean;
    syncedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
```

## Database Changes

### SQLite Setup

#### Swift (GRDB)
```swift
let dbQueue = try DatabaseQueue(path: dbPath)
try dbQueue.write { db in
    try db.execute(sql: "CREATE TABLE ...")
}
```

#### React Native
```typescript
const db = await SQLite.openDatabase({
    name: 'fitquest.db',
    location: Platform.OS === 'ios' ? 'Library' : 'default',
});
await db.executeSql('CREATE TABLE ...');
```

### Query Execution

#### Swift
```swift
let rows = try Row.fetchAll(db, sql: "SELECT * FROM workouts WHERE userId = ?", arguments: [userId])
```

#### React Native
```typescript
const result = await db.executeSql(
    'SELECT * FROM workouts WHERE userId = ?',
    [userId]
);
const rows = result.rows;
```

## Error Handling

### Swift
```swift
enum WorkoutLoggerError: LocalizedError {
    case invalidExerciseIndex
    case noExercisesLogged
    case databaseError(String)
}

throw WorkoutLoggerError.invalidExerciseIndex
```

### React Native
```typescript
enum WorkoutLoggerErrorType {
    InvalidExerciseIndex = 'INVALID_EXERCISE_INDEX',
    NoExercisesLogged = 'NO_EXERCISES_LOGGED',
    DatabaseError = 'DATABASE_ERROR',
}

class WorkoutLoggerError extends Error {
    constructor(public type: WorkoutLoggerErrorType, message: string) {
        super(message);
    }
}

throw new WorkoutLoggerError(WorkoutLoggerErrorType.InvalidExerciseIndex, 'Invalid index');
```

## Testing

### Swift Tests
```swift
import XCTest

class WorkoutLoggerServiceTests: XCTestCase {
    func testStartWorkout() {
        let workout = WorkoutLoggerService.shared.startWorkout(userId: "test")
        XCTAssertEqual(workout.userId, "test")
    }
}
```

### React Native Tests
```typescript
import WorkoutLoggerService from '@services/WorkoutLoggerService';

describe('WorkoutLoggerService', () => {
    it('should start a workout', () => {
        const workout = WorkoutLoggerService.startWorkout('test');
        expect(workout.userId).toBe('test');
    });
});
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)

### Installation
```bash
cd mobile
npm install
```

### Running on iOS
```bash
npm run ios
```

### Running on Android
```bash
npm run android
```

### Running Tests
```bash
npm test
npm run test:watch
```

## Dependencies

### Core
- `react-native`: Cross-platform framework
- `react-native-sqlite-storage`: SQLite database
- `react-native-keychain`: Secure storage
- `react-native-uuid`: UUID generation

### Development
- `typescript`: Type safety
- `jest`: Testing framework
- `@testing-library/react-native`: Testing utilities

## Migration Checklist

- [x] Convert WorkoutLoggerService (Swift → TypeScript)
- [x] Convert StreakService (Swift → TypeScript)
- [x] Create DatabaseManager for React Native
- [x] Create TypeScript type definitions
- [x] Convert unit tests to Jest
- [ ] Convert AuthenticationService
- [ ] Convert UserProfileService
- [ ] Convert OnboardingService
- [ ] Convert ExerciseLibraryService
- [ ] Convert SyncEngine
- [ ] Create React Native UI components
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Performance testing
- [ ] Security audit

## Performance Considerations

### Advantages
- Single codebase for iOS and Android
- Faster development cycle
- Easier maintenance
- Larger developer pool

### Potential Issues
- Slightly slower than native (mitigated by React Native optimizations)
- Bridge overhead for native calls
- Platform-specific bugs

### Optimization Tips
- Use FlatList for large lists (not ScrollView)
- Memoize expensive computations
- Use react-native-sqlite-storage for efficient database access
- Implement proper error boundaries
- Profile with React Native Debugger

## Remaining Phase 1 Services to Convert

1. **AuthenticationService**
   - Keychain integration
   - JWT token management
   - Device fingerprinting

2. **UserProfileService**
   - Profile CRUD operations
   - S3 image upload
   - Preference management

3. **OnboardingService**
   - Multi-step wizard
   - Preference persistence
   - Initial user setup

4. **ExerciseLibraryService**
   - Fuzzy search
   - Offline caching
   - Exercise filtering

5. **SyncEngine**
   - Offline-first sync
   - Conflict resolution
   - Retry logic

## Next Steps

1. Convert remaining Phase 1 services
2. Create React Native UI components
3. Integrate with backend API
4. Test on both iOS and Android
5. Performance optimization
6. Security hardening
7. App store submission

## Support

For questions or issues during migration:
1. Check React Native documentation: https://reactnative.dev
2. Review TypeScript handbook: https://www.typescriptlang.org/docs
3. Check react-native-sqlite-storage docs: https://github.com/andpor/react-native-sqlite-storage
