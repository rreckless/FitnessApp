import * as workoutService from '../workoutService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Unit Tests for Workout Service
 * 
 * **Validates: Requirements 5.0**
 */
describe('Workout Service', () => {
  const userId = 'user-123';
  const exerciseId = 'exercise-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Workout Creation Tests

  describe('Workout Creation', () => {
    it('should create a new workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: null,
            duration: null,
            total_volume: 0,
            total_xp: 0,
            notes: null,
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:00:00Z',
            deleted_at: null,
          },
        ],
      });

      const workout = await workoutService.createWorkout({
        userId,
        startTime: '2024-01-01T10:00:00Z',
      });

      expect(workout.id).toBe('workout-1');
      expect(workout.userId).toBe(userId);
      expect(workout.totalVolume).toBe(0);
      expect(workout.totalXP).toBe(0);
    });

    it('should create a workout with offline flag', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-2',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: null,
            duration: null,
            total_volume: 0,
            total_xp: 0,
            notes: null,
            is_offline_created: true,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:00:00Z',
            deleted_at: null,
          },
        ],
      });

      const workout = await workoutService.createWorkout({
        userId,
        startTime: '2024-01-01T10:00:00Z',
        isOfflineCreated: true,
      });

      expect(workout.isOfflineCreated).toBe(true);
    });
  });

  // MARK: - Workout Retrieval Tests

  describe('Workout Retrieval', () => {
    it('should get a workout by ID', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            duration: 3600,
            total_volume: 5000,
            total_xp: 50,
            notes: 'Great workout',
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            deleted_at: null,
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'we-1',
            exercise_id: exerciseId,
            name: 'Bench Press',
            primary_muscle_group: 'CHEST',
            difficulty: 'INTERMEDIATE',
            sets: JSON.stringify([
              { reps: 10, weight: 225, rpe: 8 },
              { reps: 8, weight: 235, rpe: 9 },
            ]),
            total_volume: 3610,
          },
        ],
      });

      const workout = await workoutService.getWorkout('workout-1', userId);

      expect(workout).not.toBeNull();
      expect(workout?.id).toBe('workout-1');
      expect(workout?.totalVolume).toBe(5000);
      expect(workout?.exercises).toHaveLength(1);
    });

    it('should return null for non-existent workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const workout = await workoutService.getWorkout('non-existent', userId);

      expect(workout).toBeNull();
    });

    it('should get all workouts for a user with pagination', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock count query
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      // Mock workouts query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            duration: 3600,
            total_volume: 5000,
            total_xp: 50,
            notes: null,
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            deleted_at: null,
          },
        ],
      });

      // Mock exercises query
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await workoutService.getWorkouts(userId, 1, 50);

      expect(result.total).toBe(2);
      expect(result.workouts).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });
  });

  // MARK: - Workout Update Tests

  describe('Workout Update', () => {
    it('should update a workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            duration: 3600,
            total_volume: 5000,
            total_xp: 50,
            notes: 'Updated notes',
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            deleted_at: null,
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const workout = await workoutService.updateWorkout('workout-1', userId, {
        notes: 'Updated notes',
      });

      expect(workout.notes).toBe('Updated notes');
    });
  });

  // MARK: - Workout Deletion Tests

  describe('Workout Deletion', () => {
    it('should soft delete a workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'workout-1' }],
      });

      await workoutService.deleteWorkout('workout-1', userId);

      expect(mockQuery).toHaveBeenCalled();
    });
  });

  // MARK: - Exercise Addition Tests

  describe('Exercise Addition', () => {
    it('should add an exercise to a workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock workout existence check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'workout-1' }],
      });

      // Mock exercise fetch
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: exerciseId,
            name: 'Bench Press',
            primary_muscle_group: 'CHEST',
            difficulty: 'INTERMEDIATE',
          },
        ],
      });

      // Mock order check
      mockQuery.mockResolvedValueOnce({
        rows: [{ max_order: 0 }],
      });

      // Mock insert
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'we-1',
            exercise_id: exerciseId,
            total_volume: 4500,
          },
        ],
      });

      // Mock volume update
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const sets = [
        { reps: 10, weight: 225, rpe: 8 },
        { reps: 8, weight: 235, rpe: 9 },
      ];

      const exercise = await workoutService.addExerciseToWorkout('workout-1', userId, {
        exerciseId,
        sets,
      });

      expect(exercise.exerciseName).toBe('Bench Press');
      expect(exercise.totalVolume).toBe(4500);
    });
  });

  // MARK: - Workout Completion Tests

  describe('Workout Completion', () => {
    it('should complete a workout and calculate XP', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock workout fetch
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            total_volume: 5000,
          },
        ],
      });

      // Mock workout update
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            duration: 3600,
            total_volume: 5000,
            total_xp: 50,
            notes: null,
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            deleted_at: null,
          },
        ],
      });

      // Mock exercises fetch
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const workout = await workoutService.completeWorkout('workout-1', userId);

      expect(workout.totalXP).toBe(50);
      expect(workout.endTime).not.toBeNull();
    });

    it('should calculate minimum XP of 10', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock workout fetch with low volume
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            total_volume: 500, // Will result in 5 XP, but minimum is 10
          },
        ],
      });

      // Mock workout update
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workout-1',
            user_id: userId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            duration: 3600,
            total_volume: 500,
            total_xp: 10,
            notes: null,
            is_offline_created: false,
            synced_at: null,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            deleted_at: null,
          },
        ],
      });

      // Mock exercises fetch
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const workout = await workoutService.completeWorkout('workout-1', userId);

      expect(workout.totalXP).toBe(10);
    });
  });

  // MARK: - Validation Tests

  describe('Set Data Validation', () => {
    it('should reject reps > 50', () => {
      expect(() => {
        workoutService.validateSetData({
          reps: 51,
          weight: 100,
        });
      }).toThrow('Max 50 reps per set');
    });

    it('should reject weight < 1', () => {
      expect(() => {
        workoutService.validateSetData({
          reps: 10,
          weight: 0,
        });
      }).toThrow('Weight must be between 1-1000 lbs');
    });

    it('should reject weight > 1000', () => {
      expect(() => {
        workoutService.validateSetData({
          reps: 10,
          weight: 1001,
        });
      }).toThrow('Weight must be between 1-1000 lbs');
    });

    it('should reject invalid RPE', () => {
      expect(() => {
        workoutService.validateSetData({
          reps: 10,
          weight: 100,
          rpe: 11,
        });
      }).toThrow('RPE must be between 1-10');
    });

    it('should accept valid set data', () => {
      expect(() => {
        workoutService.validateSetData({
          reps: 10,
          weight: 225,
          rpe: 8,
        });
      }).not.toThrow();
    });
  });

  describe('Exercise Sets Validation', () => {
    it('should reject total reps > 100', () => {
      const sets = [
        { reps: 50, weight: 100 },
        { reps: 51, weight: 100 },
      ];

      expect(() => {
        workoutService.validateExerciseSets(sets);
      }).toThrow('Max 100 reps per exercise');
    });

    it('should accept valid exercise sets', () => {
      const sets = [
        { reps: 10, weight: 225 },
        { reps: 8, weight: 235 },
        { reps: 6, weight: 245 },
      ];

      expect(() => {
        workoutService.validateExerciseSets(sets);
      }).not.toThrow();
    });
  });
});
