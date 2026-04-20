import fc from 'fast-check';
import * as progressTrackingService from '../progressTrackingService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Property-Based Tests for Progress Tracking Service
 *
 * **Property 14: Personal Record Tracking**
 * **Validates: Requirements 13.1, 13.2, 13.3**
 *
 * **Property 15: Volume Calculation and Trending**
 * **Validates: Requirements 13.4, 13.5, 13.6**
 */
describe('Progress Tracking Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Property 14: Personal Record Tracking

  /**
   * Property: For any exercise, when a user logs a weight that exceeds their previous PR,
   * the PR should be updated to the new weight, and the PR history should include the date, weight, and reps.
   */
  it('Property 14.1: PR update only occurs when weight exceeds previous', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // exerciseId
        fc.integer({ min: 1, max: 1000 }), // initial weight
        fc.integer({ min: 1, max: 100 }), // initial reps
        fc.integer({ min: 1, max: 1000 }), // new weight
        fc.integer({ min: 1, max: 100 }), // new reps
        async (userId, exerciseId, initialWeight, initialReps, newWeight, newReps) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          // Mock existing PR
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: fc.sample(fc.uuid(), 1)[0],
                user_id: userId,
                exercise_id: exerciseId,
                exercise_name: 'Test Exercise',
                weight: initialWeight,
                reps: initialReps,
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          });

          // Mock update if needed
          if (newWeight > initialWeight || (newWeight === initialWeight && newReps > initialReps)) {
            mockQuery.mockResolvedValueOnce({ rows: [] }); // Update query
            mockQuery.mockResolvedValueOnce({
              rows: [
                {
                  id: fc.sample(fc.uuid(), 1)[0],
                  user_id: userId,
                  exercise_id: exerciseId,
                  exercise_name: 'Test Exercise',
                  weight: newWeight,
                  reps: newReps,
                  recorded_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                },
              ],
            });
          }

          const result = await progressTrackingService.updatePersonalRecordIfNeeded(
            userId,
            exerciseId,
            newWeight,
            newReps
          );

          // Verify update flag is correct
          const shouldUpdate = newWeight > initialWeight || (newWeight === initialWeight && newReps > initialReps);
          expect(result.updated).toBe(shouldUpdate);

          // Verify PR has correct weight and reps
          if (shouldUpdate) {
            expect(result.pr.weight).toBe(newWeight);
            expect(result.pr.reps).toBe(newReps);
          } else {
            expect(result.pr.weight).toBe(initialWeight);
            expect(result.pr.reps).toBe(initialReps);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: PR history should contain all recorded PRs with date, weight, and reps
   */
  it('Property 14.2: PR history contains complete records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // exerciseId
        fc.array(
          fc.record({
            weight: fc.integer({ min: 1, max: 1000 }),
            reps: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userId, exerciseId, records) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          const prRecords = records.map((r, i) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            exercise_id: exerciseId,
            exercise_name: 'Test Exercise',
            weight: r.weight,
            reps: r.reps,
            recorded_at: new Date(Date.now() - i * 86400000).toISOString(),
            created_at: new Date(Date.now() - i * 86400000).toISOString(),
          }));

          mockQuery.mockResolvedValueOnce({ rows: prRecords });

          const history = await progressTrackingService.getExercisePRHistory(userId, exerciseId);

          // Verify all records are present
          expect(history.length).toBe(records.length);

          // Verify each record has required fields
          history.forEach((pr) => {
            expect(pr.id).toBeDefined();
            expect(pr.userId).toBe(userId);
            expect(pr.exerciseId).toBe(exerciseId);
            expect(pr.weight).toBeGreaterThan(0);
            expect(pr.reps).toBeGreaterThan(0);
            expect(pr.recordedAt).toBeDefined();
            expect(pr.createdAt).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 15: Volume Calculation and Trending

  /**
   * Property: For any time period, total volume should equal sum of (weight × reps × sets)
   */
  it('Property 15.1: Volume calculation is sum of exercise volumes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.record({
            exerciseId: fc.uuid(),
            exerciseName: fc.string(),
            volume: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userId, exercises) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          mockQuery.mockResolvedValueOnce({
            rows: exercises,
          });

          const startDate = new Date().toISOString();
          const volumeData = await progressTrackingService.calculateWeeklyVolume(userId, startDate);

          // Verify total volume is sum of exercise volumes
          const expectedTotal = exercises.reduce((sum, e) => sum + e.volume, 0);
          expect(volumeData.totalVolume).toBe(expectedTotal);

          // Verify exercise breakdown matches
          expect(volumeData.exerciseBreakdown.length).toBe(exercises.length);
          volumeData.exerciseBreakdown.forEach((breakdown, i) => {
            expect(breakdown.volume).toBe(exercises[i].volume);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume trends should show correct progression over time
   */
  it('Property 15.2: Volume trends maintain chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.record({
            date: fc.date(),
            volume: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        async (userId, trends) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          // Sort trends by date for mock
          const sortedTrends = trends.sort((a, b) => a.date.getTime() - b.date.getTime());

          mockQuery.mockResolvedValueOnce({
            rows: sortedTrends.map((t) => ({
              date: t.date.toISOString().split('T')[0],
              volume: t.volume,
            })),
          });

          const startDate = new Date(sortedTrends[0].date);
          const endDate = new Date(sortedTrends[sortedTrends.length - 1].date);

          const volumeTrends = await progressTrackingService.getVolumeTrends(
            userId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Verify trends are in chronological order
          for (let i = 1; i < volumeTrends.length; i++) {
            expect(new Date(volumeTrends[i].date).getTime()).toBeGreaterThanOrEqual(
              new Date(volumeTrends[i - 1].date).getTime()
            );
          }

          // Verify all volumes are non-negative
          volumeTrends.forEach((trend) => {
            expect(trend.volume).toBeGreaterThanOrEqual(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume by muscle group should sum to total volume
   */
  it('Property 15.3: Volume by muscle group sums to total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.record({
            muscleGroup: fc.constantFrom('CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS', 'CORE'),
            volume: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 1, maxLength: 6 }
        ),
        async (userId, muscleGroups) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          mockQuery.mockResolvedValueOnce({
            rows: muscleGroups,
          });

          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);

          const volumeByMuscleGroup = await progressTrackingService.getVolumeByMuscleGroup(
            userId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Verify sum of muscle group volumes
          const totalVolume = volumeByMuscleGroup.reduce((sum, mg) => sum + mg.volume, 0);
          const expectedTotal = muscleGroups.reduce((sum, mg) => sum + mg.volume, 0);
          expect(totalVolume).toBe(expectedTotal);

          // Verify all volumes are non-negative
          volumeByMuscleGroup.forEach((mg) => {
            expect(mg.volume).toBeGreaterThanOrEqual(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
