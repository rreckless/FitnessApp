# WorkoutLogger Service

The WorkoutLogger service provides comprehensive workout logging functionality for the FitQuest iOS mobile app. It supports offline-first architecture with automatic sync queue integration, anti-cheat validation, and real-time volume calculations.

## Features

- **Offline-First Architecture**: All operations work without internet connectivity
- **Real-Time Volume Calculation**: Automatic calculation of weight × reps for each set
- **Anti-Cheat Validation**: Enforces constraints on reps (max 50/set, max 100/exercise) and weight (1-1000 lbs)
- **Sync Queue Integration**: Automatic queuing of operations for cloud synchronization
- **Workout Management**: Start, add exercises, log sets, update/delete sets, and complete workouts
- **Pagination Support**: Retrieve workout history with pagination
- **Comprehensive Error Handling**: Detailed error messages and exception types

## Data Structures

### Workout
```typescript
interface Workout {
  id: string;
  userId: string;
  startTime: string; // ISO 8601 timestamp
  endTime?: string;
  duration?: number; // in seconds
  totalVolume: number; // sum of all set volumes
  totalXP?: number;
  exercises: WorkoutExercise[];
  status: WorkoutStatus; // IN_PROGRESS | COMPLETED | CANCELLED
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}
```

### WorkoutExercise
```typescript
interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}
```

### WorkoutSet
```typescript
interface WorkoutSet {
  id: string;
  reps: number;
  weight: number; // in lbs
  volume: number; // weight × reps
  notes?: string;
  createdAt: string;
}
```

## Usage Examples

### Initialize the Service

```typescript
import { WorkoutLogger } from './services/WorkoutLogger';
import { DatabaseService } from './database/DatabaseService';
import { SyncEngine } from './services/SyncEngine';

// Initialize database and sync engine first
const db = DatabaseService.getInstance();
await db.initialize();

const syncEngine = SyncEngine.getInstance();
await syncEngine.initialize();

// Get WorkoutLogger instance
const workoutLogger = WorkoutLogger.getInstance(db, syncEngine);
```

### Start a Workout

```typescript
const workout = await workoutLogger.startWorkout({
  userId: 'user123',
  notes: 'Chest and triceps day'
});

console.log(`Workout started: ${workout.id}`);
console.log(`Start time: ${workout.startTime}`);
```

### Add an Exercise

```typescript
const exercise = await workoutLogger.addExercise({
  exerciseId: 'bench-press-123',
  exerciseName: 'Bench Press'
});

console.log(`Exercise added: ${exercise.exerciseName}`);
```

### Log a Set

```typescript
const set = await workoutLogger.addSet({
  exerciseId: 'bench-press-123',
  reps: 10,
  weight: 225,
  notes: 'Good form, felt strong'
});

console.log(`Set logged: ${set.reps} reps × ${set.weight} lbs`);
console.log(`Volume: ${set.volume} lbs`);
```

### Log Multiple Sets for an Exercise

```typescript
// Set 1: 10 reps × 225 lbs = 2250 volume
await workoutLogger.addSet({
  exerciseId: 'bench-press-123',
  reps: 10,
  weight: 225
});

// Set 2: 8 reps × 245 lbs = 1960 volume
await workoutLogger.addSet({
  exerciseId: 'bench-press-123',
  reps: 8,
  weight: 245
});

// Set 3: 6 reps × 265 lbs = 1590 volume
await workoutLogger.addSet({
  exerciseId: 'bench-press-123',
  reps: 6,
  weight: 265
});

// Total volume for exercise: 5800 lbs
const currentWorkout = workoutLogger.getCurrentWorkout();
console.log(`Total workout volume: ${currentWorkout?.totalVolume}`);
```

### Update a Set

```typescript
const currentWorkout = workoutLogger.getCurrentWorkout();
const setId = currentWorkout?.exercises[0].sets[0].id;

const updated = await workoutLogger.updateSet({
  setId,
  reps: 12,
  weight: 225,
  notes: 'Increased reps'
});

console.log(`Set updated: ${updated.reps} reps × ${updated.weight} lbs`);
console.log(`New volume: ${updated.volume}`);
```

### Delete a Set

```typescript
const currentWorkout = workoutLogger.getCurrentWorkout();
const setId = currentWorkout?.exercises[0].sets[0].id;

await workoutLogger.deleteSet(setId);
console.log('Set deleted');
```

### Complete a Workout

```typescript
const completed = await workoutLogger.completeWorkout({
  notes: 'Great workout, felt strong'
});

console.log(`Workout completed: ${completed.id}`);
console.log(`Duration: ${completed.duration} seconds`);
console.log(`Total volume: ${completed.totalVolume} lbs`);
console.log(`Status: ${completed.status}`);
```

### Get Current Workout

```typescript
const currentWorkout = workoutLogger.getCurrentWorkout();

if (currentWorkout) {
  console.log(`Current workout: ${currentWorkout.id}`);
  console.log(`Exercises: ${currentWorkout.exercises.length}`);
  console.log(`Total volume: ${currentWorkout.totalVolume}`);
} else {
  console.log('No active workout');
}
```

### Get Workout History

```typescript
const history = await workoutLogger.getWorkoutHistory({
  limit: 10,
  offset: 0
});

console.log(`Total workouts: ${history.total}`);
console.log(`Workouts retrieved: ${history.workouts.length}`);

for (const workout of history.workouts) {
  console.log(`- ${workout.createdAt}: ${workout.totalVolume} lbs`);
}
```

### Get Specific Workout

```typescript
const workout = await workoutLogger.getWorkoutById('workout-id-123');

if (workout) {
  console.log(`Workout: ${workout.id}`);
  console.log(`Duration: ${workout.duration} seconds`);
  console.log(`Exercises: ${workout.exercises.length}`);
  
  for (const exercise of workout.exercises) {
    console.log(`  - ${exercise.exerciseName}: ${exercise.sets.length} sets`);
    for (const set of exercise.sets) {
      console.log(`    - ${set.reps} × ${set.weight} lbs (${set.volume} volume)`);
    }
  }
}
```

### Cancel a Workout

```typescript
await workoutLogger.cancelWorkout();
console.log('Workout cancelled without saving');
```

## Anti-Cheat Validation

The WorkoutLogger enforces the following constraints to prevent data manipulation:

- **Max reps per set**: 50
- **Max reps per exercise**: 100
- **Min weight**: 1 lbs
- **Max weight**: 1000 lbs

### Example: Validation Errors

```typescript
try {
  // This will fail - exceeds max reps per set
  await workoutLogger.addSet({
    exerciseId: 'bench-press',
    reps: 51,
    weight: 100
  });
} catch (error) {
  console.error(`Validation error: ${error.message}`);
  // Output: "Reps cannot exceed 50 per set"
}

try {
  // This will fail - weight exceeds maximum
  await workoutLogger.addSet({
    exerciseId: 'bench-press',
    reps: 10,
    weight: 1001
  });
} catch (error) {
  console.error(`Validation error: ${error.message}`);
  // Output: "Weight cannot exceed 1000 lbs"
}
```

## Offline Sync Integration

The WorkoutLogger automatically integrates with the SyncEngine to queue operations for cloud synchronization:

```typescript
// When you complete a workout, it's automatically queued for sync
const completed = await workoutLogger.completeWorkout();

// The SyncEngine will:
// 1. Store the operation in the sync_queue table
// 2. Attempt to sync when connection is available
// 3. Retry failed operations with exponential backoff
// 4. Resolve conflicts using last-write-wins strategy
```

## Error Handling

The WorkoutLogger throws `WorkoutLoggerException` with specific error codes:

```typescript
import { WorkoutLoggerException, WorkoutLoggerError } from './models/WorkoutModels';

try {
  await workoutLogger.addSet({
    exerciseId: 'bench-press',
    reps: 10,
    weight: 225
  });
} catch (error) {
  if (error instanceof WorkoutLoggerException) {
    switch (error.code) {
      case WorkoutLoggerError.NO_ACTIVE_WORKOUT:
        console.error('No active workout. Start a workout first.');
        break;
      case WorkoutLoggerError.INVALID_SET:
        console.error('Invalid set entry:', error.details);
        break;
      case WorkoutLoggerError.DATABASE_ERROR:
        console.error('Database error:', error.message);
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

## Volume Calculation

Volume is calculated automatically for each set and aggregated at the exercise and workout levels:

```typescript
// Per set: weight × reps
const set = await workoutLogger.addSet({
  exerciseId: 'bench-press',
  reps: 10,
  weight: 225
});
console.log(`Set volume: ${set.volume}`); // 2250

// Per exercise: sum of all set volumes
// Per workout: sum of all exercise volumes
const workout = workoutLogger.getCurrentWorkout();
console.log(`Total workout volume: ${workout?.totalVolume}`);
```

## Testing

The WorkoutLogger includes comprehensive unit and property-based tests:

```bash
npm test -- WorkoutLogger.test.ts
```

Tests cover:
- Workout creation and management
- Exercise and set logging
- Volume calculations
- Anti-cheat validation
- Sync queue integration
- Error handling
- Offline functionality

## Requirements Validation

This implementation validates the following requirements:

- **5.1**: Start workout with start time tracking ✓
- **5.2**: Add exercise to workout ✓
- **5.3**: Add set/rep/weight entry for exercise ✓
- **5.4**: Calculate volume for each set (weight × reps) ✓
- **5.5**: Calculate total volume for workout (sum of all set volumes) ✓
- **5.6**: Complete workout with duration calculation ✓
- **5.7**: Offline storage to sync queue ✓

## Performance Considerations

- **Database Indexes**: Queries use indexed columns for fast lookups
- **Lazy Loading**: Exercises and sets are loaded on-demand
- **Pagination**: Workout history supports pagination to limit memory usage
- **Sync Queue**: Operations are batched for efficient cloud synchronization

## Future Enhancements

- GPS tracking integration for cardio workouts
- Exercise form tips and video guidance
- Automatic PR detection and notifications
- Workout templates and program support
- Social sharing of workout achievements
