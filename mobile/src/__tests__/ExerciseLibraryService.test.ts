import ExerciseLibraryService from '@services/ExerciseLibraryService';
import AuthenticationService from '@services/AuthenticationService';
import { mockAxiosInstance, mockDatabaseManager, mockAsyncStorage, createMockExerciseRow } from './setup';

const mockedAxios = mockAxiosInstance;
const mockedDbManager = mockDatabaseManager;
const mockedAsyncStorageObj = mockAsyncStorage;
const mockedAuthService = AuthenticationService as jest.Mocked<typeof AuthenticationService>;

describe('ExerciseLibraryService', () => {
  const mockExercises = [
    {
      id: 'ex-1',
      name: 'Bench Press',
      description: 'Upper body compound exercise',
      primaryMuscleGroup: 'CHEST',
      secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'],
      difficulty: 'INTERMEDIATE',
      equipment: ['BARBELL', 'BENCH'],
      formTips: ['Keep chest up', 'Full range of motion'],
      videoUrl: 'https://example.com/bench-press.mp4',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'ex-2',
      name: 'Squats',
      description: 'Lower body compound exercise',
      primaryMuscleGroup: 'LEGS',
      secondaryMuscleGroups: ['GLUTES'],
      difficulty: 'INTERMEDIATE',
      equipment: ['BARBELL'],
      formTips: ['Knees over toes', 'Chest up'],
      videoUrl: 'https://example.com/squats.mp4',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset axios instance methods
    mockedAxios.get = jest.fn();
    mockedAxios.post = jest.fn();
    
    mockedAuthService.getAccessToken = jest.fn().mockResolvedValue('access-token-123');
    mockedAsyncStorageObj.getItem = jest.fn().mockResolvedValue(null);
    mockedAsyncStorageObj.setItem = jest.fn().mockResolvedValue(undefined);
  });

  describe('searchExercises', () => {
    it('should search exercises online', async () => {
      const mockResponse = {
        data: {
          exercises: mockExercises,
          total: 2,
          page: 1,
          pageSize: 50,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      const result = await ExerciseLibraryService.searchExercises('bench');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bench Press');
      expect(mockedAxios.get).toHaveBeenCalledWith('/exercises?search=bench');
    });

    it('should fall back to local search on network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const mockRows = {
        length: 1,
        item: (index: number) => createMockExerciseRow(mockExercises[index]),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({
        rows: mockRows,
      });

      const result = await ExerciseLibraryService.searchExercises('bench');

      expect(result).toHaveLength(1);
      expect(mockedDbManager.executeSql).toHaveBeenCalled();
    });

    it('should throw error if both online and offline search fail', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      mockedDbManager.executeSql = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(ExerciseLibraryService.searchExercises('bench')).rejects.toThrow();
    });
  });

  describe('getExercisesByMuscleGroup', () => {
    it('should get exercises by muscle group online', async () => {
      const mockResponse = {
        data: {
          exercises: [mockExercises[0]],
          total: 1,
          page: 1,
          pageSize: 50,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      const result = await ExerciseLibraryService.getExercisesByMuscleGroup('CHEST');

      expect(result).toHaveLength(1);
      expect(result[0].primaryMuscleGroup).toBe('CHEST');
      expect(mockedAxios.get).toHaveBeenCalledWith('/exercises/muscle-groups/CHEST');
    });

    it('should fall back to local search on network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const mockRows = {
        length: 1,
        item: () => createMockExerciseRow(mockExercises[0]),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({
        rows: mockRows,
      });

      const result = await ExerciseLibraryService.getExercisesByMuscleGroup('CHEST');

      expect(result).toHaveLength(1);
      expect(mockedDbManager.executeSql).toHaveBeenCalled();
    });
  });

  describe('getExercise', () => {
    it('should get exercise by ID online', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockExercises[0],
      });

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      const result = await ExerciseLibraryService.getExercise('ex-1');

      expect(result.id).toBe('ex-1');
      expect(result.name).toBe('Bench Press');
      expect(mockedAxios.get).toHaveBeenCalledWith('/exercises/ex-1');
    });

    it('should fall back to local search on network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const mockRows = {
        length: 1,
        item: () => createMockExerciseRow(mockExercises[0]),
      };

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({
        rows: mockRows,
      });

      const result = await ExerciseLibraryService.getExercise('ex-1');

      expect(result.id).toBe('ex-1');
    });

    it('should throw error if exercise not found', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      mockedDbManager.executeSql = jest.fn().mockResolvedValue({
        rows: { length: 0 },
      });

      await expect(ExerciseLibraryService.getExercise('invalid-id')).rejects.toThrow();
    });
  });

  describe('getAllExercises', () => {
    it('should get all exercises with pagination online', async () => {
      const mockResponse = {
        data: {
          exercises: mockExercises,
          total: 100,
          page: 1,
          pageSize: 50,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      const result = await ExerciseLibraryService.getAllExercises(1, 50);

      expect(result.exercises).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledWith('/exercises?page=1&pageSize=50');
    });

    it('should get exercises with custom pagination', async () => {
      const mockResponse = {
        data: {
          exercises: mockExercises,
          total: 100,
          page: 2,
          pageSize: 25,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      const result = await ExerciseLibraryService.getAllExercises(2, 25);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
    });
  });

  describe('syncExerciseLibrary', () => {
    it('should sync exercise library from cloud', async () => {
      const mockResponse = {
        data: {
          exercises: mockExercises,
          total: 2,
          page: 1,
          pageSize: 1000,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({ rows: { length: 0 } });

      await ExerciseLibraryService.syncExerciseLibrary();

      expect(mockedAxios.get).toHaveBeenCalledWith('/exercises?pageSize=1000');
      expect(mockedAsyncStorageObj.setItem).toHaveBeenCalledWith(
        'exerciseLibrarySyncTime',
        expect.any(String)
      );
    });

    it('should throw error on sync failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(ExerciseLibraryService.syncExerciseLibrary()).rejects.toThrow();
    });
  });

  describe('getLastSyncTime', () => {
    it('should return last sync time', async () => {
      const syncTime = new Date().toISOString();
      mockedAsyncStorageObj.getItem.mockResolvedValueOnce(syncTime);

      const result = await ExerciseLibraryService.getLastSyncTime();

      expect(result).toEqual(new Date(syncTime));
    });

    it('should return null if no sync time stored', async () => {
      mockedAsyncStorageObj.getItem.mockResolvedValueOnce(null);

      const result = await ExerciseLibraryService.getLastSyncTime();

      expect(result).toBeNull();
    });

    it('should return null on storage error', async () => {
      mockedAsyncStorageObj.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await ExerciseLibraryService.getLastSyncTime();

      expect(result).toBeNull();
    });
  });

  describe('shouldRefreshCache', () => {
    it('should return true if no sync time', async () => {
      mockedAsyncStorageObj.getItem.mockResolvedValueOnce(null);

      const result = await ExerciseLibraryService.shouldRefreshCache();

      expect(result).toBe(true);
    });

    it('should return true if cache older than 7 days', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      mockedAsyncStorageObj.getItem.mockResolvedValueOnce(eightDaysAgo);

      const result = await ExerciseLibraryService.shouldRefreshCache();

      expect(result).toBe(true);
    });

    it('should return false if cache newer than 7 days', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      mockedAsyncStorageObj.getItem.mockResolvedValueOnce(twoDaysAgo);

      const result = await ExerciseLibraryService.shouldRefreshCache();

      expect(result).toBe(false);
    });
  });

  describe('getOfflineExerciseCount', () => {
    it('should return exercise count', async () => {
      mockedDbManager.executeSql = jest.fn().mockResolvedValue({
        rows: {
          item: () => ({ count: 150 }),
        },
      });

      const result = await ExerciseLibraryService.getOfflineExerciseCount();

      expect(result).toBe(150);
    });

    it('should return 0 on error', async () => {
      mockedDbManager.executeSql = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await ExerciseLibraryService.getOfflineExerciseCount();

      expect(result).toBe(0);
    });
  });
});
