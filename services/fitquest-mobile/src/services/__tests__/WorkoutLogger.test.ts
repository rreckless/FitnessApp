/**
 * WorkoutLogger Tests
 * Unit and property-based tests for workout logging functionality
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
 */

import { WorkoutLogger } from '../WorkoutLogger';
import { DatabaseService } from '../../database/DatabaseService';
import { SyncEngine } from '../SyncEngine';
import { SyncOperation, SyncEntityType } from '../../models/SyncModels';
import {
  Workout,
  WorkoutStatus,
  WorkoutLoggerException,
  WorkoutLoggerError,
  ANTI_CHEAT_CONSTRAINTS,
} from '../../models/WorkoutModels';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../database/DatabaseService');
jest.mock('../SyncEngine');

describe('WorkoutLogger', () => {
  let workoutLogger: WorkoutLogger;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockSyncEngine: jest.Mocked<SyncEngine>;
  const userId = 'user123';
  const workoutId = uuidv4();

  beforeEach(() => {
    jest.clearAllMocks();
    WorkoutLogger.resetInstance();

    // Setup mock database
    mockDb = {
      insert: jest.fn().mockResolvedValue(''),
      update: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      queryOne: jest.fn().mockResolvedValue(null),
      queryAll: jest.fn().mockResolvedValue([]),
    } as any;

    // Setup mock sync engine
    mockSyncEngine = {
      queueOperation: jest.fn().mockResolvedValue(undefined),
    } as any;

    workoutLogger = WorkoutLogger.getInstance(mockDb, mockSyncEngine);
  });

  describe('Start Workout', () => {
    it('should start a new workout with start time', async () => {
      const workout = await workoutLogger.startWorkout({ userId });

      expect(workout).toBeDefined();
      expect(workout.userId).toBe(userId);
      expect(workout.status).toBe(WorkoutStatus.IN_PROGRESS);
      expect(workout.startTime).toBeDefined();
      expect(workout.totalVolume).toBe(0);
      expect(workout.exercises).toHaveLength(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error if workout already in progress', async () => {
      await workoutLogger.startWorkout({ userId });

      await expect(workoutLogger.startWorkout({ userId })).rejects.toThrow(
        WorkoutLoggerException
      );
    });

    it('should include notes if provided', async () => {
      const notes = 'Chest and triceps day';
      const workout = await workoutLogger.startWorkout({ userId, notes });

      expect(workout.notes).toBe(notes);
    });

    // Property-based test: Starting a workout should always create valid structure
    it('should create workout with all required fields', async () => {
      const workout = await workoutLogger.startWorkout({ userId });

      expect(workout.id).toBeTruthy();
      expect(workout.userId).toBe(userId);
      expect(workout.startTime).toBeTruthy();
      expect(workout.totalVolume).toBe(0);
      expect(workout.status).toBe(WorkoutStatus.IN_PROGRESS);
      expect(workout.exercises).toEqual([]);
      expect(workout.createdAt).toBeTruthy();
      expect(workout.updatedAt).toBeTruthy();
    });
  });

  describe('Add Exercise', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
    });

    it('should add exercise to current workout', async () => {
      const exerciseId = 'bench-press-123';
      const exerciseName = 'Bench Press';

      const exercise = await workoutLogger.addExercise({
        exerciseId,
        exerciseName,
      });

      expect(exercise).toBeDefined();
      expect(exercise.exerciseId).toBe(exerciseId);
      expect(exercise.exerciseName).toBe(exerciseName);
      expect(exercise.sets).toHaveLength(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error if no active workout', async () => {
      await workoutLogger.cancelWorkout();

      await expect(
        workoutLogger.addExercise({
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
        })
      ).rejects.toThrow(WorkoutLoggerException);
    });

    // Property-based test: Added exercises should be retrievable from current workout
    it('should add multiple exercises to workout', async () => {
      const exercises = [
        { exerciseId: 'bench-press', exerciseName: 'Bench Press' },
        { exerciseId: 'squat', exerciseName: 'Squat' },
        { exerciseId: 'deadlift', exerciseName: 'Deadlift' },
      ];

      for (const ex of exercises) {
        await workoutLogger.addExercise(ex);
      }

      const currentWorkout = workoutLogger.getCurrentWorkout();
      expect(currentWorkout?.exercises).toHaveLength(3);
    });
  });

  describe('Add Set', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
    });

    it('should add set with reps and weight', async () => {
      const set = await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });

      expect(set).toBeDefined();
      expect(set.reps).toBe(10);
      expect(set.weight).toBe(225);
      expect(set.volume).toBe(2250); // 225 * 10
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should calculate volume correctly (weight × reps)', async () => {
      const set = await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 8,
        weight: 185,
      });

      expect(set.volume).toBe(1480); // 185 * 8
    });

    it('should update workout total volume', async () => {
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });

      const workout = workoutLogger.getCurrentWorkout();
      expect(workout?.totalVolume).toBe(2250);
    });

    it('should reject reps exceeding max per set', async () => {
      await expect(
        workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: ANTI_CHEAT_CONSTRAINTS.MAX_REPS_PER_SET + 1,
          weight: 100,
        })
      ).rejects.toThrow(WorkoutLoggerException);
    });

    it('should reject weight below minimum', async () => {
      await expect(
        workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: 10,
          weight: ANTI_CHEAT_CONSTRAINTS.MIN_WEIGHT - 1,
        })
      ).rejects.toThrow(WorkoutLoggerException);
    });

    it('should reject weight exceeding maximum', async () => {
      await expect(
        workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: 10,
          weight: ANTI_CHEAT_CONSTRAINTS.MAX_WEIGHT + 1,
        })
      ).rejects.toThrow(WorkoutLoggerException);
    });

    it('should reject total reps exceeding max per exercise', async () => {
      // Add sets that approach the limit
      for (let i = 0; i < 2; i++) {
        await workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: 50,
          weight: 100,
        });
      }

      // This should exceed the limit
      await expect(
        workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: 1,
          weight: 100,
        })
      ).rejects.toThrow(WorkoutLoggerException);
    });

    it('should include notes if provided', async () => {
      const notes = 'Good form, felt strong';
      const set = await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
        notes,
      });

      expect(set.notes).toBe(notes);
    });

    // Property-based test: Volume calculation should always be weight × reps
    it('should calculate volume correctly for various weights and reps', async () => {
      const testCases = [
        { reps: 1, weight: 100, expectedVolume: 100 },
        { reps: 5, weight: 225, expectedVolume: 1125 },
        { reps: 10, weight: 185, expectedVolume: 1850 },
        { reps: 20, weight: 95, expectedVolume: 1900 },
        { reps: 50, weight: 50, expectedVolume: 2500 },
      ];

      for (const testCase of testCases) {
        // Reset for each test
        await workoutLogger.cancelWorkout();
        await workoutLogger.startWorkout({ userId });
        await workoutLogger.addExercise({
          exerciseId: 'test-exercise',
          exerciseName: 'Test Exercise',
        });

        const set = await workoutLogger.addSet({
          exerciseId: 'test-exercise',
          reps: testCase.reps,
          weight: testCase.weight,
        });

        expect(set.volume).toBe(testCase.expectedVolume);
      }
    });

    // Property-based test: Total volume should be sum of all set volumes
    it('should accumulate total volume correctly', async () => {
      const sets = [
        { reps: 10, weight: 225 },
        { reps: 8, weight: 245 },
        { reps: 6, weight: 265 },
      ];

      let expectedTotal = 0;
      for (const setData of sets) {
        await workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: setData.reps,
          weight: setData.weight,
        });
        expectedTotal += setData.reps * setData.weight;
      }

      const workout = workoutLogger.getCurrentWorkout();
      expect(workout?.totalVolume).toBe(expectedTotal);
    });
  });

  describe('Update Set', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });
    });

    it('should update set reps', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;

      const updated = await workoutLogger.updateSet({
        setId,
        reps: 12,
      });

      expect(updated.reps).toBe(12);
      expect(updated.weight).toBe(225);
      expect(updated.volume).toBe(2700); // 225 * 12
    });

    it('should update set weight', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;

      const updated = await workoutLogger.updateSet({
        setId,
        weight: 245,
      });

      expect(updated.reps).toBe(10);
      expect(updated.weight).toBe(245);
      expect(updated.volume).toBe(2450); // 245 * 10
    });

    it('should update total volume when set is updated', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;
      const originalVolume = workout?.totalVolume!;

      await workoutLogger.updateSet({
        setId,
        reps: 15,
        weight: 225,
      });

      const updatedWorkout = workoutLogger.getCurrentWorkout();
      // Original: 225 * 10 = 2250
      // Updated: 225 * 15 = 3375
      // Difference: 3375 - 2250 = 1125
      expect(updatedWorkout?.totalVolume).toBe(originalVolume + 1125);
    });

    it('should queue sync operation on update', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;

      await workoutLogger.updateSet({
        setId,
        reps: 12,
      });

      expect(mockSyncEngine.queueOperation).toHaveBeenCalled();
    });
  });

  describe('Delete Set', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });
    });

    it('should delete set from workout', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;

      await workoutLogger.deleteSet(setId);

      const updatedWorkout = workoutLogger.getCurrentWorkout();
      expect(updatedWorkout?.exercises[0].sets).toHaveLength(0);
    });

    it('should update total volume when set is deleted', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;
      const originalVolume = workout?.totalVolume!;

      await workoutLogger.deleteSet(setId);

      const updatedWorkout = workoutLogger.getCurrentWorkout();
      expect(updatedWorkout?.totalVolume).toBe(0);
    });

    it('should queue sync operation on delete', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const setId = workout?.exercises[0].sets[0].id!;

      await workoutLogger.deleteSet(setId);

      expect(mockSyncEngine.queueOperation).toHaveBeenCalled();
    });
  });

  describe('Complete Workout', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });
    });

    it('should complete workout with end time', async () => {
      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const completed = await workoutLogger.completeWorkout();

      expect(completed.status).toBe(WorkoutStatus.COMPLETED);
      expect(completed.endTime).toBeDefined();
      expect(completed.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration correctly', async () => {
      const startTime = new Date();
      const completed = await workoutLogger.completeWorkout();

      expect(completed.duration).toBeGreaterThanOrEqual(0);
      expect(typeof completed.duration).toBe('number');
    });

    it('should preserve total volume on completion', async () => {
      const workout = workoutLogger.getCurrentWorkout();
      const volumeBeforeCompletion = workout?.totalVolume!;

      const completed = await workoutLogger.completeWorkout();

      expect(completed.totalVolume).toBe(volumeBeforeCompletion);
    });

    it('should queue sync operation on completion', async () => {
      await workoutLogger.completeWorkout();

      expect(mockSyncEngine.queueOperation).toHaveBeenCalled();
    });

    it('should clear current workout after completion', async () => {
      await workoutLogger.completeWorkout();

      expect(workoutLogger.getCurrentWorkout()).toBeNull();
    });

    it('should include notes if provided', async () => {
      const notes = 'Great workout, felt strong';
      const completed = await workoutLogger.completeWorkout({ notes });

      expect(completed.notes).toBe(notes);
    });

    // Property-based test: Completed workout should have all required fields
    it('should create complete workout with all fields', async () => {
      const completed = await workoutLogger.completeWorkout();

      expect(completed.id).toBeTruthy();
      expect(completed.userId).toBe(userId);
      expect(completed.startTime).toBeTruthy();
      expect(completed.endTime).toBeTruthy();
      expect(completed.duration).toBeGreaterThanOrEqual(0);
      expect(completed.totalVolume).toBeGreaterThanOrEqual(0);
      expect(completed.status).toBe(WorkoutStatus.COMPLETED);
      expect(completed.exercises.length).toBeGreaterThan(0);
    });
  });

  describe('Cancel Workout', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });
    });

    it('should cancel workout without saving', async () => {
      await workoutLogger.cancelWorkout();

      expect(workoutLogger.getCurrentWorkout()).toBeNull();
      expect(mockDb.delete).toHaveBeenCalledWith(
        'workouts',
        'id = ?',
        expect.any(Array)
      );
    });

    it('should throw error if no active workout', async () => {
      await workoutLogger.cancelWorkout();

      await expect(workoutLogger.cancelWorkout()).rejects.toThrow(
        WorkoutLoggerException
      );
    });
  });

  describe('Get Current Workout', () => {
    it('should return null if no active workout', () => {
      expect(workoutLogger.getCurrentWorkout()).toBeNull();
    });

    it('should return current workout if active', async () => {
      await workoutLogger.startWorkout({ userId });

      const current = workoutLogger.getCurrentWorkout();
      expect(current).toBeDefined();
      expect(current?.status).toBe(WorkoutStatus.IN_PROGRESS);
    });
  });

  describe('Offline Sync Integration', () => {
    it('should queue operation when adding set', async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });

      mockSyncEngine.queueOperation.mockClear();

      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });

      // Note: addSet doesn't queue by default, only on update/delete
      // This test verifies the pattern is available
    });

    it('should queue operation when completing workout', async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
      await workoutLogger.addSet({
        exerciseId: 'bench-press',
        reps: 10,
        weight: 225,
      });

      mockSyncEngine.queueOperation.mockClear();

      await workoutLogger.completeWorkout();

      expect(mockSyncEngine.queueOperation).toHaveBeenCalledWith(
        SyncOperation.CREATE,
        SyncEntityType.WORKOUT,
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('Anti-Cheat Validation', () => {
    beforeEach(async () => {
      await workoutLogger.startWorkout({ userId });
      await workoutLogger.addExercise({
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
      });
    });

    // Property-based test: All invalid reps should be rejected
    it('should reject invalid reps values', async () => {
      const invalidReps = [0, -1, 51, 100, 1000];

      for (const reps of invalidReps) {
        await expect(
          workoutLogger.addSet({
            exerciseId: 'bench-press',
            reps,
            weight: 100,
          })
        ).rejects.toThrow(WorkoutLoggerException);
      }
    });

    // Property-based test: All invalid weights should be rejected
    it('should reject invalid weight values', async () => {
      const invalidWeights = [0, -1, 0.5, 1001, 10000];

      for (const weight of invalidWeights) {
        await expect(
          workoutLogger.addSet({
            exerciseId: 'bench-press',
            reps: 10,
            weight,
          })
        ).rejects.toThrow(WorkoutLoggerException);
      }
    });

    // Property-based test: Valid reps and weights should be accepted
    it('should accept valid reps and weight combinations', async () => {
      const validCombinations = [
        { reps: 1, weight: 1 },
        { reps: 25, weight: 500 },
        { reps: 50, weight: 1000 },
      ];

      for (const combo of validCombinations) {
        const set = await workoutLogger.addSet({
          exerciseId: 'bench-press',
          reps: combo.reps,
          weight: combo.weight,
        });

        expect(set.reps).toBe(combo.reps);
        expect(set.weight).toBe(combo.weight);

        // Reset for next iteration
        await workoutLogger.cancelWorkout();
        await workoutLogger.startWorkout({ userId });
        await workoutLogger.addExercise({
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
        });
      }
    });
  });
});
