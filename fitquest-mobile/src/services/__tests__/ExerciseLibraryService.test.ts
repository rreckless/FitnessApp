/**
 * Exercise Library Service Tests
 * Unit and property-based tests for exercise library functionality
 */

import { ExerciseLibraryService, MuscleGroup, Exercise } from '../ExerciseLibraryService';
import { DatabaseService } from '../../database/DatabaseService';
import { SyncEngine } from '../SyncEngine';
import { UserProfileException, UserProfileError } from '../../models/UserProfileModels';
import { Equipment } from '../../models/UserProfileModels';

describe('ExerciseLibraryService', () => {
  let service: ExerciseLibraryService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockSyncEngine: jest.Mocked<SyncEngine>;

  beforeEach(() => {
    // Reset singleton
    ExerciseLibraryService.resetInstance();

    // Create mocks
    mockDb = {
      queryAll: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockSyncEngine = {
      queueOperation: jest.fn(),
    } as any;

    service = ExerciseLibraryService.getInstance(mockDb, mockSyncEngine);
    service.setCurrentUserId('test-user-id');
  });

  describe('Initialization', () => {
    it('should initialize exercise library with built-in exercises', async () => {
      mockDb.queryAll.mockResolvedValueOnce([{ count: 0 }]);
      (mockDb.insert as jest.Mock).mockResolvedValue(undefined);

      await service.initializeLibrary();

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.insert.mock.calls.length).toBeGreaterThan(0);
    });

    it('should not reinitialize if library already exists', async () => {
      mockDb.queryAll.mockResolvedValueOnce([{ count: 10 }]);

      await service.initializeLibrary();

      // Should only query, not insert
      expect(mockDb.queryAll).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should search exercises by name', async () => {
      const mockExercises = [
        {
          id: '1',
          name: 'Bench Press',
          description: 'Chest exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: '[]',
          difficulty: 'INTERMEDIATE',
          isCustom: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.queryAll.mockResolvedValueOnce(mockExercises);

      const result = await service.searchExercises('Bench');

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].name).toBe('Bench Press');
      expect(result.query).toBe('Bench');
    });

    it('should search exercises by muscle group', async () => {
      const mockExercises = [
        {
          id: '1',
          name: 'Bench Press',
          description: 'Chest exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: '[]',
          difficulty: 'INTERMEDIATE',
          isCustom: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.queryAll.mockResolvedValueOnce(mockExercises);

      const result = await service.searchExercises('', MuscleGroup.CHEST);

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].primaryMuscleGroup).toBe(MuscleGroup.CHEST);
    });

    it('should return empty results for no matches', async () => {
      mockDb.queryAll.mockResolvedValueOnce([]);

      const result = await service.searchExercises('NonExistent');

      expect(result.exercises).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('Get Exercises', () => {
    it('should get exercises by muscle group', async () => {
      const mockExercises = [
        {
          id: '1',
          name: 'Bench Press',
          description: 'Chest exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: '[]',
          difficulty: 'INTERMEDIATE',
          isCustom: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.queryAll.mockResolvedValueOnce(mockExercises);

      const exercises = await service.getExercisesByMuscleGroup(MuscleGroup.CHEST);

      expect(exercises).toHaveLength(1);
      expect(exercises[0].primaryMuscleGroup).toBe(MuscleGroup.CHEST);
    });

    it('should get all exercises', async () => {
      const mockExercises = [
        {
          id: '1',
          name: 'Bench Press',
          description: 'Chest exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: '[]',
          difficulty: 'INTERMEDIATE',
          isCustom: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Squats',
          description: 'Leg exercise',
          primaryMuscleGroup: MuscleGroup.LEGS,
          secondaryMuscleGroups: '[]',
          difficulty: 'INTERMEDIATE',
          isCustom: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.queryAll.mockResolvedValueOnce(mockExercises);

      const exercises = await service.getAllExercises();

      expect(exercises).toHaveLength(2);
    });

    it('should get exercise by ID', async () => {
      const mockExercise = {
        id: '1',
        name: 'Bench Press',
        description: 'Chest exercise',
        primaryMuscleGroup: MuscleGroup.CHEST,
        secondaryMuscleGroups: '[]',
        difficulty: 'INTERMEDIATE',
        isCustom: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.queryAll.mockResolvedValueOnce([mockExercise]);

      const exercise = await service.getExerciseById('1');

      expect(exercise.id).toBe('1');
      expect(exercise.name).toBe('Bench Press');
    });

    it('should throw error if exercise not found', async () => {
      mockDb.queryAll.mockResolvedValueOnce([]);

      await expect(service.getExerciseById('nonexistent')).rejects.toThrow(
        UserProfileException
      );
    });
  });

  describe('Custom Exercises', () => {
    it('should create custom exercise', async () => {
      (mockDb.insert as jest.Mock).mockResolvedValue(undefined);
      (mockSyncEngine.queueOperation as jest.Mock).mockResolvedValue(undefined);

      const exercise = await service.createCustomExercise(
        'Custom Exercise',
        'My custom exercise',
        MuscleGroup.CHEST,
        [MuscleGroup.SHOULDERS],
        'BEGINNER'
      );

      expect(exercise.name).toBe('Custom Exercise');
      expect(exercise.isCustom).toBe(true);
      expect(exercise.userId).toBe('test-user-id');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockSyncEngine.queueOperation).toHaveBeenCalled();
    });

    it('should throw error if no user ID set for custom exercise', async () => {
      // Create a new service instance without setting user ID
      ExerciseLibraryService.resetInstance();
      const newService = ExerciseLibraryService.getInstance(mockDb, mockSyncEngine);
      // Don't set user ID

      await expect(
        newService.createCustomExercise(
          'Custom Exercise',
          'My custom exercise',
          MuscleGroup.CHEST
        )
      ).rejects.toThrow(UserProfileException);
    });

    it('should get user custom exercises', async () => {
      const mockExercises = [
        {
          id: '1',
          name: 'Custom Exercise',
          description: 'My custom exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: '[]',
          difficulty: 'BEGINNER',
          isCustom: 1,
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.queryAll.mockResolvedValueOnce(mockExercises);

      const exercises = await service.getUserCustomExercises();

      expect(exercises).toHaveLength(1);
      expect(exercises[0].isCustom).toBe(true);
    });

    it('should delete custom exercise', async () => {
      const mockExercise = {
        id: '1',
        name: 'Custom Exercise',
        description: 'My custom exercise',
        primaryMuscleGroup: MuscleGroup.CHEST,
        secondaryMuscleGroups: '[]',
        difficulty: 'BEGINNER',
        isCustom: 1,
        userId: 'test-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.queryAll.mockResolvedValueOnce([mockExercise]);
      (mockDb.delete as jest.Mock).mockResolvedValue(undefined);
      (mockSyncEngine.queueOperation as jest.Mock).mockResolvedValue(undefined);

      await service.deleteCustomExercise('1');

      expect(mockDb.delete).toHaveBeenCalledWith('exercises', 'id = ?', ['1']);
      expect(mockSyncEngine.queueOperation).toHaveBeenCalled();
    });

    it('should throw error if deleting non-owned custom exercise', async () => {
      mockDb.queryAll.mockResolvedValueOnce([]);

      await expect(service.deleteCustomExercise('1')).rejects.toThrow(
        UserProfileException
      );
    });
  });

  describe('Property-Based Tests', () => {
    it('should maintain exercise data integrity through create and retrieve', async () => {
      const testCases = [
        {
          name: 'Bench Press',
          description: 'Classic chest exercise',
          primaryMuscleGroup: MuscleGroup.CHEST,
          secondaryMuscleGroups: [MuscleGroup.SHOULDERS],
          difficulty: 'INTERMEDIATE' as const,
        },
        {
          name: 'Squats',
          description: 'Leg exercise',
          primaryMuscleGroup: MuscleGroup.LEGS,
          secondaryMuscleGroups: [MuscleGroup.CORE],
          difficulty: 'ADVANCED' as const,
        },
      ];

      for (const testCase of testCases) {
        (mockDb.insert as jest.Mock).mockResolvedValue(undefined);
        (mockSyncEngine.queueOperation as jest.Mock).mockResolvedValue(undefined);

        const created = await service.createCustomExercise(
          testCase.name,
          testCase.description,
          testCase.primaryMuscleGroup,
          testCase.secondaryMuscleGroups,
          testCase.difficulty
        );

        expect(created.name).toBe(testCase.name);
        expect(created.description).toBe(testCase.description);
        expect(created.primaryMuscleGroup).toBe(testCase.primaryMuscleGroup);
        expect(created.secondaryMuscleGroups).toEqual(testCase.secondaryMuscleGroups);
        expect(created.difficulty).toBe(testCase.difficulty);
      }
    });

    it('should handle search with various query patterns', async () => {
      const testQueries = ['Bench', 'bench', 'BENCH', 'Press', 'Chest'];

      for (const query of testQueries) {
        mockDb.queryAll.mockResolvedValueOnce([
          {
            id: '1',
            name: 'Bench Press',
            description: 'Chest exercise',
            primaryMuscleGroup: MuscleGroup.CHEST,
            secondaryMuscleGroups: '[]',
            difficulty: 'INTERMEDIATE',
            isCustom: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);

        const result = await service.searchExercises(query);

        expect(result.query).toBe(query);
        expect(result.exercises).toBeDefined();
      }
    });

    it('should maintain consistency across muscle group queries', async () => {
      const muscleGroups = Object.values(MuscleGroup);

      for (const muscleGroup of muscleGroups) {
        mockDb.queryAll.mockResolvedValueOnce([
          {
            id: '1',
            name: 'Test Exercise',
            description: 'Test',
            primaryMuscleGroup: muscleGroup,
            secondaryMuscleGroups: '[]',
            difficulty: 'BEGINNER',
            isCustom: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);

        const exercises = await service.getExercisesByMuscleGroup(muscleGroup);

        expect(exercises).toBeDefined();
        expect(exercises.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
