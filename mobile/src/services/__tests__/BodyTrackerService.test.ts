import { BodyTrackerService, WeightEntry, MeasurementEntry, ProgressPhoto } from '../BodyTrackerService';
import axios from 'axios';
import SQLite from 'react-native-sqlite-storage';

jest.mock('axios');
jest.mock('react-native-sqlite-storage');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockDb = {
  executeSql: jest.fn(),
  close: jest.fn(),
};

describe('BodyTrackerService', () => {
  let service: BodyTrackerService;
  const apiBaseUrl = 'https://api.fitquest.com';
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

    service = new BodyTrackerService(apiBaseUrl, userId);
  });

  describe('Weight Logging', () => {
    it('should log a weight entry', async () => {
      const mockApiClient = mockAxios.create();
      const weightEntry: WeightEntry = {
        id: 'weight-1',
        userId,
        weight: 185.5,
        notes: 'Morning weight',
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (mockApiClient.post as jest.Mock).mockResolvedValue({ data: weightEntry });

      const result = await service.logWeight(185.5, 'Morning weight');

      expect(result.weight).toBe(185.5);
      expect(result.notes).toBe('Morning weight');
      expect(mockDb.executeSql).toHaveBeenCalled();
    });

    it('should get weight history', async () => {
      const mockApiClient = mockAxios.create();
      const weightEntries: WeightEntry[] = [
        {
          id: 'weight-1',
          userId,
          weight: 185.5,
          recordedAt: '2024-01-15T08:00:00Z',
          createdAt: '2024-01-15T08:00:00Z',
          updatedAt: '2024-01-15T08:00:00Z',
        },
        {
          id: 'weight-2',
          userId,
          weight: 185.0,
          recordedAt: '2024-01-14T08:00:00Z',
          createdAt: '2024-01-14T08:00:00Z',
          updatedAt: '2024-01-14T08:00:00Z',
        },
      ];

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: weightEntries });

      const result = await service.getWeightHistory('2024-01-01', '2024-01-31');

      expect(result).toHaveLength(2);
      expect(result[0].weight).toBe(185.5);
    });

    it('should calculate weight trend with trend line', async () => {
      const mockApiClient = mockAxios.create();
      const weightEntries: WeightEntry[] = [
        {
          id: 'weight-1',
          userId,
          weight: 185.0,
          recordedAt: '2024-01-10T08:00:00Z',
          createdAt: '2024-01-10T08:00:00Z',
          updatedAt: '2024-01-10T08:00:00Z',
        },
        {
          id: 'weight-2',
          userId,
          weight: 185.5,
          recordedAt: '2024-01-11T08:00:00Z',
          createdAt: '2024-01-11T08:00:00Z',
          updatedAt: '2024-01-11T08:00:00Z',
        },
        {
          id: 'weight-3',
          userId,
          weight: 184.8,
          recordedAt: '2024-01-12T08:00:00Z',
          createdAt: '2024-01-12T08:00:00Z',
          updatedAt: '2024-01-12T08:00:00Z',
        },
      ];

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: weightEntries });

      const result = await service.getWeightTrend(30);

      expect(result).toHaveLength(3);
      expect(result[0].weight).toBe(185.0);
      expect(result[0].trendValue).toBeDefined();
    });

    it('should edit weight entry within 7 days', async () => {
      const mockApiClient = mockAxios.create();
      const now = new Date();
      const createdDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const existingEntry: WeightEntry = {
        id: 'weight-1',
        userId,
        weight: 185.0,
        recordedAt: createdDate.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => existingEntry } },
      ]);

      (mockApiClient.put as jest.Mock).mockResolvedValue({ data: { ...existingEntry, weight: 186.0 } });

      const result = await service.editWeight('weight-1', 186.0, 'Updated');

      expect(result.weight).toBe(186.0);
    });

    it('should reject edit weight entry older than 7 days', async () => {
      const mockApiClient = mockAxios.create();
      const now = new Date();
      const createdDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const existingEntry: WeightEntry = {
        id: 'weight-1',
        userId,
        weight: 185.0,
        recordedAt: createdDate.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => existingEntry } },
      ]);

      await expect(service.editWeight('weight-1', 186.0)).rejects.toThrow(
        'Cannot edit weight entry older than 7 days'
      );
    });

    it('should delete weight entry within 7 days', async () => {
      const mockApiClient = mockAxios.create();
      const now = new Date();
      const createdDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const existingEntry: WeightEntry = {
        id: 'weight-1',
        userId,
        weight: 185.0,
        recordedAt: createdDate.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => existingEntry } },
      ]);

      (mockApiClient.delete as jest.Mock).mockResolvedValue({});

      await service.deleteWeight('weight-1');

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM body_weight'),
        expect.any(Array)
      );
    });
  });

  describe('Measurement Logging', () => {
    it('should log a measurement entry', async () => {
      const mockApiClient = mockAxios.create();
      const measurementEntry: MeasurementEntry = {
        id: 'measurement-1',
        userId,
        chest: 40,
        waist: 32,
        hips: 38,
        arms: 14,
        thighs: 24,
        notes: 'Morning measurements',
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (mockApiClient.post as jest.Mock).mockResolvedValue({ data: measurementEntry });

      const result = await service.logMeasurement(40, 32, 38, 14, 24, 'Morning measurements');

      expect(result.chest).toBe(40);
      expect(result.waist).toBe(32);
      expect(mockDb.executeSql).toHaveBeenCalled();
    });

    it('should get measurement history', async () => {
      const mockApiClient = mockAxios.create();
      const measurementEntries: MeasurementEntry[] = [
        {
          id: 'measurement-1',
          userId,
          chest: 40,
          waist: 32,
          hips: 38,
          arms: 14,
          thighs: 24,
          recordedAt: '2024-01-15T08:00:00Z',
          createdAt: '2024-01-15T08:00:00Z',
          updatedAt: '2024-01-15T08:00:00Z',
        },
        {
          id: 'measurement-2',
          userId,
          chest: 39.5,
          waist: 31.8,
          hips: 37.5,
          arms: 13.8,
          thighs: 23.5,
          recordedAt: '2024-01-08T08:00:00Z',
          createdAt: '2024-01-08T08:00:00Z',
          updatedAt: '2024-01-08T08:00:00Z',
        },
      ];

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: measurementEntries });

      const result = await service.getMeasurementHistory('2024-01-01', '2024-01-31');

      expect(result).toHaveLength(2);
      expect(result[0].chest).toBe(40);
    });

    it('should calculate measurement changes', async () => {
      const mockApiClient = mockAxios.create();
      const measurementEntries: MeasurementEntry[] = [
        {
          id: 'measurement-1',
          userId,
          chest: 40,
          waist: 32,
          hips: 38,
          arms: 14,
          thighs: 24,
          recordedAt: '2024-01-15T08:00:00Z',
          createdAt: '2024-01-15T08:00:00Z',
          updatedAt: '2024-01-15T08:00:00Z',
        },
        {
          id: 'measurement-2',
          userId,
          chest: 39,
          waist: 31,
          hips: 37,
          arms: 13,
          thighs: 23,
          recordedAt: '2024-01-08T08:00:00Z',
          createdAt: '2024-01-08T08:00:00Z',
          updatedAt: '2024-01-08T08:00:00Z',
        },
      ];

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: measurementEntries });

      const result = await service.getMeasurementChanges();

      expect(result).toHaveLength(5);
      expect(result[0].measurement).toBe('Chest');
      expect(result[0].current).toBe(40);
      expect(result[0].previous).toBe(39);
      expect(result[0].change).toBe(1);
    });

    it('should edit measurement entry within 7 days', async () => {
      const mockApiClient = mockAxios.create();
      const now = new Date();
      const createdDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const existingEntry: MeasurementEntry = {
        id: 'measurement-1',
        userId,
        chest: 40,
        waist: 32,
        hips: 38,
        arms: 14,
        thighs: 24,
        recordedAt: createdDate.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => existingEntry } },
      ]);

      (mockApiClient.put as jest.Mock).mockResolvedValue({
        data: { ...existingEntry, chest: 40.5 },
      });

      const result = await service.editMeasurement('measurement-1', 40.5);

      expect(result.chest).toBe(40.5);
    });

    it('should delete measurement entry within 7 days', async () => {
      const mockApiClient = mockAxios.create();
      const now = new Date();
      const createdDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const existingEntry: MeasurementEntry = {
        id: 'measurement-1',
        userId,
        chest: 40,
        waist: 32,
        hips: 38,
        arms: 14,
        thighs: 24,
        recordedAt: createdDate.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => existingEntry } },
      ]);

      (mockApiClient.delete as jest.Mock).mockResolvedValue({});

      await service.deleteMeasurement('measurement-1');

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM body_measurements'),
        expect.any(Array)
      );
    });
  });

  describe('Photo Management', () => {
    it('should upload a progress photo', async () => {
      const mockApiClient = mockAxios.create();
      const photo: ProgressPhoto = {
        id: 'photo-1',
        userId,
        imageUrl: 'https://s3.amazonaws.com/fitquest/photo-1.jpg',
        thumbnailUrl: 'https://s3.amazonaws.com/fitquest/photo-1-thumb.jpg',
        notes: 'Front view',
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      (mockApiClient.post as jest.Mock).mockResolvedValue({ data: photo });

      const result = await service.uploadPhoto('file:///path/to/image.jpg', 'Front view');

      expect(result.imageUrl).toBe('https://s3.amazonaws.com/fitquest/photo-1.jpg');
      expect(result.notes).toBe('Front view');
    });

    it('should get photo gallery', async () => {
      const mockApiClient = mockAxios.create();
      const photos: ProgressPhoto[] = [
        {
          id: 'photo-1',
          userId,
          imageUrl: 'https://s3.amazonaws.com/fitquest/photo-1.jpg',
          recordedAt: '2024-01-15T08:00:00Z',
          createdAt: '2024-01-15T08:00:00Z',
        },
        {
          id: 'photo-2',
          userId,
          imageUrl: 'https://s3.amazonaws.com/fitquest/photo-2.jpg',
          recordedAt: '2024-01-08T08:00:00Z',
          createdAt: '2024-01-08T08:00:00Z',
        },
      ];

      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: photos });

      const result = await service.getPhotoGallery(50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].imageUrl).toContain('photo-1');
    });

    it('should compare two photos', async () => {
      const mockApiClient = mockAxios.create();
      const beforePhoto: ProgressPhoto = {
        id: 'photo-1',
        userId,
        imageUrl: 'https://s3.amazonaws.com/fitquest/photo-1.jpg',
        recordedAt: '2024-01-01T08:00:00Z',
        createdAt: '2024-01-01T08:00:00Z',
      };

      const afterPhoto: ProgressPhoto = {
        id: 'photo-2',
        userId,
        imageUrl: 'https://s3.amazonaws.com/fitquest/photo-2.jpg',
        recordedAt: '2024-01-15T08:00:00Z',
        createdAt: '2024-01-15T08:00:00Z',
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => beforePhoto } },
      ]);

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => afterPhoto } },
      ]);

      const result = await service.comparePhotos('photo-1', 'photo-2');

      expect(result.beforePhoto.id).toBe('photo-1');
      expect(result.afterPhoto.id).toBe('photo-2');
    });

    it('should delete a progress photo', async () => {
      const mockApiClient = mockAxios.create();

      (mockApiClient.delete as jest.Mock).mockResolvedValue({});

      await service.deletePhoto('photo-1');

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM progress_photos'),
        expect.any(Array)
      );
    });
  });

  describe('Offline Sync', () => {
    it('should queue operations when offline', async () => {
      const mockApiClient = mockAxios.create();
      (mockApiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await service.logWeight(185.5, 'Morning weight');

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO body_tracker_sync_queue'),
        expect.any(Array)
      );
    });

    it('should sync pending operations', async () => {
      const mockApiClient = mockAxios.create();
      const syncItem = {
        id: 'sync-1',
        operation: 'CREATE',
        entityType: 'WEIGHT',
        entityId: 'weight-1',
        payload: JSON.stringify({ weight: 185.5 }),
        status: 'PENDING',
      };

      mockDb.executeSql.mockResolvedValueOnce([
        { rows: { length: 1, item: () => syncItem } },
      ]);

      (mockApiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      await service.syncPendingOperations();

      expect(mockApiClient.post).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should clear all cached data', async () => {
      // Reset mock to clear initialization calls
      mockDb.executeSql.mockClear();
      mockDb.executeSql.mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]);

      await service.clearCache();

      // Check that DELETE queries were called
      const calls = mockDb.executeSql.mock.calls;
      const deleteWeightCalled = calls.some(call => 
        typeof call[0] === 'string' && call[0].includes('DELETE FROM body_weight')
      );
      const deleteMeasurementCalled = calls.some(call => 
        typeof call[0] === 'string' && call[0].includes('DELETE FROM body_measurements')
      );
      const deletePhotoCalled = calls.some(call => 
        typeof call[0] === 'string' && call[0].includes('DELETE FROM progress_photos')
      );

      expect(deleteWeightCalled).toBe(true);
      expect(deleteMeasurementCalled).toBe(true);
      expect(deletePhotoCalled).toBe(true);
    });

    it('should close database connection', async () => {
      await service.close();

      expect(mockDb.close).toHaveBeenCalled();
    });
  });
});
