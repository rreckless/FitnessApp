import * as exerciseService from '../exerciseService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Unit Tests for Exercise Service
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Exercise Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Exercise Search Tests

  describe('Exercise Search', () => {
    it('should search exercises by name', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Upper body pressing movement',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS', 'TRICEPS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: ['Keep chest up', 'Full range of motion'],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const results = await exerciseService.searchExercises('Bench Press');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bench Press');
      expect(results[0].primaryMuscleGroup).toBe('CHEST');
    });

    it('should perform fuzzy search on exercise names', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Upper body pressing movement',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'exercise-2',
            name: 'Dumbbell Bench Press',
            description: 'Dumbbell variation',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['DUMBBELLS'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const results = await exerciseService.searchExercises('bench');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((e) => e.name.includes('Bench'))).toBe(true);
    });

    it('should return empty array when no matches found', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await exerciseService.searchExercises('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  // MARK: - Filter by Muscle Group Tests

  describe('Filter by Muscle Group', () => {
    it('should filter exercises by primary muscle group', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'exercise-2',
            name: 'Incline Bench Press',
            description: 'Upper chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const results = await exerciseService.getExercisesByMuscleGroup('CHEST');

      expect(results).toHaveLength(2);
      expect(results.every((e) => e.primaryMuscleGroup === 'CHEST')).toBe(true);
    });

    it('should filter exercises by secondary muscle group', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS', 'TRICEPS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const results = await exerciseService.getExercisesByMuscleGroup('SHOULDERS', true);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return all muscle groups', async () => {
      const muscleGroups = exerciseService.getAllMuscleGroups();

      expect(muscleGroups).toContain('CHEST');
      expect(muscleGroups).toContain('BACK');
      expect(muscleGroups).toContain('SHOULDERS');
      expect(muscleGroups).toContain('ARMS');
      expect(muscleGroups).toContain('LEGS');
      expect(muscleGroups).toContain('CORE');
      expect(muscleGroups).toContain('CARDIO');
    });
  });

  // MARK: - Exercise Retrieval Tests

  describe('Exercise Retrieval', () => {
    it('should get exercise by ID', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Upper body pressing movement',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: ['SHOULDERS'],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: ['Keep chest up'],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const exercise = await exerciseService.getExerciseById('exercise-1');

      expect(exercise.id).toBe('exercise-1');
      expect(exercise.name).toBe('Bench Press');
    });

    it('should throw error when exercise not found', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(exerciseService.getExerciseById('nonexistent')).rejects.toThrow(
        'Exercise not found'
      );
    });

    it('should get all exercises with pagination', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: Array.from({ length: 50 }, (_, i) => ({
          id: `exercise-${i}`,
          name: `Exercise ${i}`,
          description: 'Test exercise',
          primary_muscle_group: 'CHEST',
          secondary_muscle_groups: [],
          difficulty: 'BEGINNER',
          equipment: [],
          form_tips: [],
          created_at: '2024-01-01T00:00:00Z',
        })),
      });

      const result = await exerciseService.getAllExercises(1, 50);

      expect(result.exercises).toHaveLength(50);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  // MARK: - Exercise Library Size Tests

  describe('Exercise Library Size', () => {
    it('should have at least 200 exercises', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '250' }],
      });

      const count = await exerciseService.getExerciseCount();

      expect(count).toBeGreaterThanOrEqual(200);
    });
  });

  // MARK: - Exercise Caching Tests

  describe('Exercise Caching', () => {
    it('should cache exercise library', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: [],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // First call - should query database
      const result1 = await exerciseService.getExercisesByMuscleGroup('CHEST');

      // Second call - should use cache
      const result2 = await exerciseService.getExercisesByMuscleGroup('CHEST');

      expect(result1).toEqual(result2);
      // Query should only be called once due to caching
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache after TTL', async () => {
      jest.useFakeTimers();

      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: [],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // First call
      await exerciseService.getExercisesByMuscleGroup('CHEST');

      // Advance time by 7 days (cache TTL)
      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'exercise-1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primary_muscle_group: 'CHEST',
            secondary_muscle_groups: [],
            difficulty: 'INTERMEDIATE',
            equipment: ['BARBELL'],
            form_tips: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Second call - should query database again
      await exerciseService.getExercisesByMuscleGroup('CHEST');

      // Query should be called twice
      expect(mockQuery).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  // MARK: - Exercise Validation Tests

  describe('Exercise Validation', () => {
    it('should validate exercise name', () => {
      expect(() => exerciseService.validateExerciseName('')).toThrow();
      expect(() => exerciseService.validateExerciseName('a')).toThrow();
      expect(() => exerciseService.validateExerciseName('Valid Exercise Name')).not.toThrow();
    });

    it('should validate muscle group', () => {
      expect(() => exerciseService.validateMuscleGroup('CHEST')).not.toThrow();
      expect(() => exerciseService.validateMuscleGroup('INVALID')).toThrow();
    });

    it('should validate difficulty level', () => {
      expect(() => exerciseService.validateDifficulty('BEGINNER')).not.toThrow();
      expect(() => exerciseService.validateDifficulty('INVALID')).toThrow();
    });
  });
});
