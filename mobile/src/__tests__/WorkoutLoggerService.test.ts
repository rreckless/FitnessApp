import WorkoutLoggerService from '@services/WorkoutLoggerService';
import { WorkoutLoggerErrorType } from '@types/index';

describe('WorkoutLoggerService', () => {
  const userId = 'test-user-123';

  describe('startWorkout', () => {
    it('should create a new workout session', () => {
      const workout = WorkoutLoggerService.startWorkout(userId);

      expect(workout.userId).toBe(userId);
      expect(workout.exercises).toEqual([]);
      expect(workout.isOfflineCreated).toBe(true);
      expect(workout.startTime).toBeInstanceOf(Date);
    });

    it('should have unique ID for each workout', () => {
      const workout1 = WorkoutLoggerService.startWorkout(userId);
      const workout2 = WorkoutLoggerService.startWorkout(userId);

      expect(workout1.id).not.toBe(workout2.id);
    });
  });

  describe('addExercise', () => {
    it('should add an exercise to the workout', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(
        workout,
        'exercise-1',
        'Bench Press',
        'CHEST',
        'COMPOUND'
      );

      expect(workout.exercises).toHaveLength(1);
      expect(workout.exercises[0].exerciseName).toBe('Bench Press');
      expect(workout.exercises[0].primaryMuscleGroup).toBe('CHEST');
      expect(workout.exercises[0].difficulty).toBe('COMPOUND');
    });

    it('should add multiple exercises', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      workout = WorkoutLoggerService.addExercise(workout, 'ex-2', 'Squats', 'LEGS', 'COMPOUND');

      expect(workout.exercises).toHaveLength(2);
      expect(workout.exercises[1].exerciseName).toBe('Squats');
    });

    it('should initialize empty sets array for new exercise', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(workout.exercises[0].sets).toEqual([]);
    });
  });

  describe('addSet', () => {
    it('should add a set to an exercise', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      workout = WorkoutLoggerService.addSet(workout, 0, 10, 225);

      expect(workout.exercises[0].sets).toHaveLength(1);
      expect(workout.exercises[0].sets[0].reps).toBe(10);
      expect(workout.exercises[0].sets[0].weight).toBe(225);
    });

    it('should add multiple sets to same exercise', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      workout = WorkoutLoggerService.addSet(workout, 0, 10, 225);
      workout = WorkoutLoggerService.addSet(workout, 0, 8, 225);
      workout = WorkoutLoggerService.addSet(workout, 0, 6, 225);

      expect(workout.exercises[0].sets).toHaveLength(3);
    });

    it('should throw error for invalid exercise index', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(() => WorkoutLoggerService.addSet(workout, 5, 10, 225)).toThrow();
    });

    it('should throw error for reps > 50 (anti-cheat)', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(() => WorkoutLoggerService.addSet(workout, 0, 51, 225)).toThrow();
    });

    it('should throw error for reps < 1', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(() => WorkoutLoggerService.addSet(workout, 0, 0, 225)).toThrow();
    });

    it('should throw error for weight < 1 (anti-cheat)', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(() => WorkoutLoggerService.addSet(workout, 0, 10, 0)).toThrow();
    });

    it('should throw error for weight > 1000 (anti-cheat)', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      expect(() => WorkoutLoggerService.addSet(workout, 0, 10, 1001)).toThrow();
    });

    it('should accept valid boundary values', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      
      // Min valid values
      workout = WorkoutLoggerService.addSet(workout, 0, 1, 1);
      // Max valid values
      workout = WorkoutLoggerService.addSet(workout, 0, 50, 1000);

      expect(workout.exercises[0].sets).toHaveLength(2);
    });
  });

  describe('calculateTotalVolume', () => {
    it('should calculate total volume correctly', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      workout = WorkoutLoggerService.addSet(workout, 0, 10, 225); // 2250
      workout = WorkoutLoggerService.addSet(workout, 0, 8, 225); // 1800
      // Total: 4050

      const volume = WorkoutLoggerService.calculateTotalVolume(workout);
      expect(volume).toBe(4050);
    });

    it('should calculate volume for multiple exercises', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
      workout = WorkoutLoggerService.addSet(workout, 0, 10, 225); // 2250
      workout = WorkoutLoggerService.addExercise(workout, 'ex-2', 'Squats', 'LEGS', 'COMPOUND');
      workout = WorkoutLoggerService.addSet(workout, 1, 10, 315); // 3150
      // Total: 5400

      const volume = WorkoutLoggerService.calculateTotalVolume(workout);
      expect(volume).toBe(5400);
    });

    it('should return 0 for empty workout', () => {
      const workout = WorkoutLoggerService.startWorkout(userId);
      const volume = WorkoutLoggerService.calculateTotalVolume(workout);

      expect(volume).toBe(0);
    });

    it('should return 0 for workout with exercises but no sets', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

      const volume = WorkoutLoggerService.calculateTotalVolume(workout);
      expect(volume).toBe(0);
    });
  });

  describe('calculateDuration', () => {
    it('should return undefined if workout not completed', () => {
      const workout = WorkoutLoggerService.startWorkout(userId);
      const duration = WorkoutLoggerService.calculateDuration(workout);

      expect(duration).toBeUndefined();
    });

    it('should calculate duration in seconds', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');

      workout = { ...workout, startTime, endTime };
      const duration = WorkoutLoggerService.calculateDuration(workout);

      expect(duration).toBe(1800); // 30 minutes
    });

    it('should calculate duration for 1 hour workout', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T11:00:00Z');

      workout = { ...workout, startTime, endTime };
      const duration = WorkoutLoggerService.calculateDuration(workout);

      expect(duration).toBe(3600);
    });

    it('should calculate duration for short workout', () => {
      let workout = WorkoutLoggerService.startWorkout(userId);
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:05:00Z');

      workout = { ...workout, startTime, endTime };
      const duration = WorkoutLoggerService.calculateDuration(workout);

      expect(duration).toBe(300); // 5 minutes
    });
  });

  // TODO: These tests call methods that don't exist in WorkoutLoggerService
  // describe('removeExercise', () => {
  //   it('should remove exercise from workout', () => {
  //     let workout = WorkoutLoggerService.startWorkout(userId);
  //     workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
  //     workout = WorkoutLoggerService.addExercise(workout, 'ex-2', 'Squats', 'LEGS', 'COMPOUND');

  //     workout = WorkoutLoggerService.removeExercise(workout, 0);

  //     expect(workout.exercises).toHaveLength(1);
  //     expect(workout.exercises[0].exerciseName).toBe('Squats');
  //   });

  //   it('should throw error for invalid exercise index', () => {
  //     let workout = WorkoutLoggerService.startWorkout(userId);
  //     workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');

  //     expect(() => WorkoutLoggerService.removeExercise(workout, 5)).toThrow();
  //   });
  // });

  // describe('removeSet', () => {
  //   it('should remove set from exercise', () => {
  //     let workout = WorkoutLoggerService.startWorkout(userId);
  //     workout = WorkoutLoggerService.addExercise(workout, 'ex-1', 'Bench Press', 'CHEST', 'COMPOUND');
  //     workout = WorkoutLoggerService.addSet(workout, 0, 10, 225);
  //     workout = WorkoutLoggerService.addSet(workout, 0, 8, 225);

  //     workout = WorkoutLoggerService.removeSet(workout, 0, 0);

  //     expect(workout.exercises[0].sets).toHaveLength(1);
  //     expect(workout.exercises[0].sets[0].reps).toBe(8);
  //   });
  // });
});
