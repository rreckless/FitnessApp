import fc from 'fast-check';
import WorkoutLoggerService from '@services/WorkoutLoggerService';

/**
 * Property-Based Tests for WorkoutLoggerService
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
 */

describe('WorkoutLoggerService - Property-Based Tests', () => {
  const userId = 'test-user-123';

  /**
   * Property 1: Volume Calculation Correctness
   * For any set of exercises with sets, the total volume should equal
   * the sum of (weight × reps) for all sets across all exercises
   */
  describe('Property 1: Volume Calculation Correctness', () => {
    it('should calculate volume as sum of weight × reps for all sets', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              exerciseId: fc.string(),
              exerciseName: fc.string(),
              primaryMuscleGroup: fc.constantFrom('CHEST', 'BACK', 'LEGS', 'SHOULDERS'),
              difficulty: fc.constantFrom('COMPOUND', 'ISOLATION', 'CARDIO'),
              sets: fc.array(
                fc.record({
                  reps: fc.integer({ min: 1, max: 50 }),
                  weight: fc.integer({ min: 1, max: 1000 }),
                }),
                { minLength: 1, maxLength: 10 }
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (exercisesData: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);

            // Add exercises and sets
            for (const exerciseData of exercisesData) {
              workout = WorkoutLoggerService.addExercise(
                workout,
                exerciseData.exerciseId,
                exerciseData.exerciseName,
                exerciseData.primaryMuscleGroup,
                exerciseData.difficulty
              );

              const exerciseIndex = workout.exercises.length - 1;
              for (const set of exerciseData.sets) {
                workout = WorkoutLoggerService.addSet(
                  workout,
                  exerciseIndex,
                  set.reps,
                  set.weight
                );
              }
            }

            // Calculate expected volume
            let expectedVolume = 0;
            for (const exerciseData of exercisesData) {
              for (const set of exerciseData.sets) {
                expectedVolume += set.weight * set.reps;
              }
            }

            const actualVolume = WorkoutLoggerService.calculateTotalVolume(workout);
            expect(actualVolume).toBe(expectedVolume);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty workout', () => {
      const workout = WorkoutLoggerService.startWorkout(userId);
      const volume = WorkoutLoggerService.calculateTotalVolume(workout);
      expect(volume).toBe(0);
    });

    it('should return 0 for workout with exercises but no sets', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              exerciseId: fc.string(),
              exerciseName: fc.string(),
              primaryMuscleGroup: fc.constantFrom('CHEST', 'BACK', 'LEGS'),
              difficulty: fc.constantFrom('COMPOUND', 'ISOLATION'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (exercisesData: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);

            for (const exerciseData of exercisesData) {
              workout = WorkoutLoggerService.addExercise(
                workout,
                exerciseData.exerciseId,
                exerciseData.exerciseName,
                exerciseData.primaryMuscleGroup,
                exerciseData.difficulty
              );
            }

            const volume = WorkoutLoggerService.calculateTotalVolume(workout);
            expect(volume).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: XP Calculation Correctness
   * XP should be calculated as: max(volume / 100, 10) × difficulty multiplier × (1 + streak bonus)
   * where streak bonus = min(currentStreak * 0.05, 0.50)
   */
  describe('Property 2: XP Calculation Correctness', () => {
    it('should calculate XP with correct formula', () => {
      fc.assert(
        fc.property(
          fc.record({
            volume: fc.integer({ min: 0, max: 100000 }),
            difficultyMultiplier: fc.oneof(
              fc.constant(1.2), // compound
              fc.constant(1.0), // isolation
              fc.constant(0.8)  // cardio
            ),
            currentStreak: fc.integer({ min: 0, max: 100 }),
          }),
          (data: any) => {
            const { volume, difficultyMultiplier, currentStreak } = data;
            const baseXP = Math.max(volume / 100, 10);
            const streakBonus = Math.min(currentStreak * 0.05, 0.50);
            const calculatedXP = baseXP * difficultyMultiplier * (1 + streakBonus);
            const expectedXP = Math.max(Math.round(calculatedXP), 10); // Ensure minimum 10

            const actualXP = WorkoutLoggerService.calculateWorkoutXP(
              volume,
              difficultyMultiplier,
              currentStreak
            );

            expect(actualXP).toBe(expectedXP);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply minimum XP of 10', () => {
      fc.assert(
        fc.property(
          fc.record({
            volume: fc.integer({ min: 0, max: 500 }), // Low volume
            difficultyMultiplier: fc.oneof(
              fc.constant(1.2),
              fc.constant(1.0),
              fc.constant(0.8)
            ),
            currentStreak: fc.integer({ min: 0, max: 100 }),
          }),
          (data: any) => {
            const { volume, difficultyMultiplier, currentStreak } = data;
            const actualXP = WorkoutLoggerService.calculateWorkoutXP(
              volume,
              difficultyMultiplier,
              currentStreak
            );

            expect(actualXP).toBeGreaterThanOrEqual(10);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should apply streak bonus correctly (max 50%)', () => {
      fc.assert(
        fc.property(
          fc.record({
            volume: fc.integer({ min: 1000, max: 100000 }),
            difficultyMultiplier: fc.constant(1.0),
            currentStreak: fc.integer({ min: 0, max: 100 }),
          }),
          (data: any) => {
            const { volume, difficultyMultiplier, currentStreak } = data;
            const baseXP = Math.max(volume / 100, 10);
            const streakBonus = Math.min(currentStreak * 0.05, 0.50);
            const expectedXP = Math.round(baseXP * difficultyMultiplier * (1 + streakBonus));

            const actualXP = WorkoutLoggerService.calculateWorkoutXP(
              volume,
              difficultyMultiplier,
              currentStreak
            );

            expect(actualXP).toBe(expectedXP);
            // Verify streak bonus never exceeds 50%
            const maxPossibleXP = Math.round(baseXP * difficultyMultiplier * 1.5);
            expect(actualXP).toBeLessThanOrEqual(maxPossibleXP);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Anti-Cheat Validation
   * The service should reject sets with:
   * - reps < 1 or reps > 50
   * - weight < 1 or weight > 1000
   */
  describe('Property 3: Anti-Cheat Validation', () => {
    it('should reject invalid reps (< 1 or > 50)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 51, max: 1000 })
          ),
          (invalidReps: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);
            workout = WorkoutLoggerService.addExercise(
              workout,
              'ex-1',
              'Bench Press',
              'CHEST',
              'COMPOUND'
            );

            expect(() => WorkoutLoggerService.addSet(workout, 0, invalidReps, 225)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid weight (< 1 or > 1000)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 1001, max: 10000 })
          ),
          (invalidWeight: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);
            workout = WorkoutLoggerService.addExercise(
              workout,
              'ex-1',
              'Bench Press',
              'CHEST',
              'COMPOUND'
            );

            expect(() => WorkoutLoggerService.addSet(workout, 0, 10, invalidWeight)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept valid reps (1-50) and weight (1-1000)', () => {
      fc.assert(
        fc.property(
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          (data: any) => {
            const { reps, weight } = data;
            let workout = WorkoutLoggerService.startWorkout(userId);
            workout = WorkoutLoggerService.addExercise(
              workout,
              'ex-1',
              'Bench Press',
              'CHEST',
              'COMPOUND'
            );

            expect(() => WorkoutLoggerService.addSet(workout, 0, reps, weight)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Workout Duration Calculation
   * Duration should be calculated as (endTime - startTime) in seconds
   */
  describe('Property 4: Workout Duration Calculation', () => {
    it('should calculate duration correctly for any time range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 14400 }), // 0 to 4 hours in seconds
          (durationSeconds: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

            workout = { ...workout, startTime, endTime };
            const calculatedDuration = WorkoutLoggerService.calculateDuration(workout);

            expect(calculatedDuration).toBe(durationSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return undefined for incomplete workouts', () => {
      fc.assert(
        fc.property(fc.anything(), () => {
          const workout = WorkoutLoggerService.startWorkout(userId);
          const duration = WorkoutLoggerService.calculateDuration(workout);

          expect(duration).toBeUndefined();
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: Workout Immutability
   * Adding exercises or sets should return a new workout object
   */
  describe('Property 5: Workout Immutability', () => {
    it('should return a new workout object when adding exercises', () => {
      fc.assert(
        fc.property(
          fc.record({
            exerciseId: fc.string(),
            exerciseName: fc.string(),
            primaryMuscleGroup: fc.constantFrom('CHEST', 'BACK', 'LEGS'),
            difficulty: fc.constantFrom('COMPOUND', 'ISOLATION'),
          }),
          (exerciseData: any) => {
            const workout = WorkoutLoggerService.startWorkout(userId);
            const newWorkout = WorkoutLoggerService.addExercise(
              workout,
              exerciseData.exerciseId,
              exerciseData.exerciseName,
              exerciseData.primaryMuscleGroup,
              exerciseData.difficulty
            );

            // Should return a different object
            expect(newWorkout).not.toBe(workout);
            // New should have one more exercise
            expect(newWorkout.exercises.length).toBe(workout.exercises.length + 1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return a new workout object when adding sets', () => {
      fc.assert(
        fc.property(
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          (setData: any) => {
            let workout = WorkoutLoggerService.startWorkout(userId);
            workout = WorkoutLoggerService.addExercise(
              workout,
              'ex-1',
              'Bench Press',
              'CHEST',
              'COMPOUND'
            );

            const workoutBefore = workout;
            const newWorkout = WorkoutLoggerService.addSet(
              workout,
              0,
              setData.reps,
              setData.weight
            );

            // Should return a different object
            expect(newWorkout).not.toBe(workoutBefore);
            // New should have one more set
            expect(newWorkout.exercises[0].sets.length).toBe(workoutBefore.exercises[0].sets.length + 1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
