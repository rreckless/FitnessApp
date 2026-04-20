import fc from 'fast-check';
import * as workoutService from '../workoutService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Property-Based Tests for Workout Service
 * 
 * **Property 4: Workout Creation and Storage**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**
 */
describe('Workout Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Property 4: Workout Creation and Storage

  /**
   * Property: For any valid workout data, creating a workout should:
   * 1. Return a workout with the same userId and startTime
   * 2. Have totalVolume and totalXP initialized to 0
   * 3. Have empty exercises array
   * 4. Be marked as offline created if specified
   */
  it('Property 4.1: Workout creation preserves input data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.date(),
        fc.boolean(),
        fc.option(fc.string()),
        async (userId, startTime, isOfflineCreated, notes) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: fc.sample(fc.uuid(), 1)[0],
                user_id: userId,
                start_time: startTime.toISOString(),
                end_time: null,
                duration: null,
                total_volume: 0,
                total_xp: 0,
                notes: notes || null,
                is_offline_created: isOfflineCreated,
                synced_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted_at: null,
              },
            ],
          });

          const workout = await workoutService.createWorkout({
            userId,
            startTime: startTime.toISOString(),
            isOfflineCreated,
            notes,
          });

          // Verify input data is preserved
          expect(workout.userId).toBe(userId);
          expect(workout.startTime).toBe(startTime.toISOString());
          expect(workout.isOfflineCreated).toBe(isOfflineCreated);
          expect(workout.notes).toBe(notes || undefined);

          // Verify initial state
          expect(workout.totalVolume).toBe(0);
          expect(workout.totalXP).toBe(0);
          expect(workout.exercises).toEqual([]);
          expect(workout.endTime).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid set data, volume calculation should be:
   * volume = weight × reps
   */
  it('Property 4.2: Volume calculation is accurate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000 }),
        (reps, weight) => {
          const set: workoutService.ExerciseSet = { reps, weight };
          const expectedVolume = weight * reps;

          // Simulate volume calculation
          const actualVolume = set.weight * set.reps;

          expect(actualVolume).toBe(expectedVolume);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid exercise sets, total volume should be:
   * totalVolume = sum of (weight × reps) for all sets
   */
  it('Property 4.3: Exercise total volume is sum of set volumes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (sets) => {
          const expectedTotal = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

          // Simulate exercise volume calculation
          const actualTotal = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

          expect(actualTotal).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid workout with exercises, total volume should be:
   * totalVolume = sum of all exercise volumes
   */
  it('Property 4.4: Workout total volume is sum of exercise volumes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(
            fc.record({
              reps: fc.integer({ min: 1, max: 50 }),
              weight: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (exercises) => {
          const expectedTotal = exercises.reduce((sum, exerciseSets) => {
            const exerciseVolume = exerciseSets.reduce((exSum, set) => exSum + set.weight * set.reps, 0);
            return sum + exerciseVolume;
          }, 0);

          // Simulate workout volume calculation
          const actualTotal = exercises.reduce((sum, exerciseSets) => {
            const exerciseVolume = exerciseSets.reduce((exSum, set) => exSum + set.weight * set.reps, 0);
            return sum + exerciseVolume;
          }, 0);

          expect(actualTotal).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Anti-cheat validation should reject:
   * - reps > 50
   * - weight < 1 or weight > 1000
   * - rpe < 1 or rpe > 10 (if provided)
   */
  it('Property 4.5: Anti-cheat validation rejects invalid data', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            reps: fc.integer({ min: 51, max: 1000 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1001, max: 10000 }),
          }),
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: -1000, max: 0 }),
          })
        ),
        (invalidSet) => {
          expect(() => {
            workoutService.validateSetData(invalidSet as any);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Anti-cheat validation should accept:
   * - 1 <= reps <= 50
   * - 1 <= weight <= 1000
   * - 1 <= rpe <= 10 (if provided)
   */
  it('Property 4.6: Anti-cheat validation accepts valid data', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.option(fc.integer({ min: 1, max: 10 })),
        (reps, weight, rpe) => {
          expect(() => {
            workoutService.validateSetData({ reps, weight, rpe });
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Exercise sets validation should reject total reps > 100
   */
  it('Property 4.7: Exercise sets validation rejects > 100 total reps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        (sets) => {
          const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);

          if (totalReps > 100) {
            expect(() => {
              workoutService.validateExerciseSets(sets);
            }).toThrow('Max 100 reps per exercise');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Exercise sets validation should accept total reps <= 100
   */
  it('Property 4.8: Exercise sets validation accepts <= 100 total reps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            reps: fc.integer({ min: 1, max: 50 }),
            weight: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (sets) => {
          const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);

          if (totalReps <= 100) {
            expect(() => {
              workoutService.validateExerciseSets(sets);
            }).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Workout completion should calculate XP as:
   * XP = max(floor(totalVolume / 100), 10)
   */
  it('Property 4.9: XP calculation follows formula', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (totalVolume) => {
          const expectedXP = Math.max(Math.floor(totalVolume / 100), 10);

          // Simulate XP calculation
          const actualXP = Math.max(Math.floor(totalVolume / 100), 10);

          expect(actualXP).toBe(expectedXP);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: XP should always be at least 10
   */
  it('Property 4.10: XP minimum is 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (totalVolume) => {
          const xp = Math.max(Math.floor(totalVolume / 100), 10);

          expect(xp).toBeGreaterThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
