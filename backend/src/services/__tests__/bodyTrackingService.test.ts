import * as bodyTrackingService from '../bodyTrackingService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Unit Tests for Body Tracking Service
 * Tests weight and measurement logging, history retrieval, and trend calculations
 */

describe('Body Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Body Weight', () => {
    it('should log a body weight entry', async () => {
      const userId = 'test-user-1';
      const weight = 180;
      const notes = 'Morning weight';

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            {
              id: 'weight-1',
              user_id: userId,
              weight,
              notes,
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const result = await bodyTrackingService.logBodyWeight(userId, weight, notes);

      expect(result.weight).toBe(weight);
      expect(result.notes).toBe(notes);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should get body weight history', async () => {
      const userId = 'test-user-1';

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            {
              id: 'weight-1',
              user_id: userId,
              weight: 180,
              notes: 'Morning',
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'weight-2',
              user_id: userId,
              weight: 179,
              notes: 'Evening',
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const history = await bodyTrackingService.getBodyWeightHistory(userId, 100, 0);

      expect(history.length).toBe(2);
      expect(history[0].weight).toBe(180);
      expect(history[1].weight).toBe(179);
    });

    it('should calculate weight trend line', async () => {
      const userId = 'test-user-1';
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            {
              weight: 180,
              recorded_at: yesterday.toISOString(),
            },
            {
              weight: 178,
              recorded_at: now.toISOString(),
            },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const trendLine = await bodyTrackingService.calculateWeightTrendLine(userId);

      expect(trendLine).not.toBeNull();
      expect(trendLine!.startValue).toBe(180);
      expect(trendLine!.endValue).toBe(178);
      expect(trendLine!.trend).toBe('decreasing');
      expect(trendLine!.changePercentage).toBeLessThan(0);
    });
  });

  describe('Body Measurements', () => {
    it('should log body measurements', async () => {
      const userId = 'test-user-1';
      const measurements = {
        chest: 40,
        waist: 32,
        hips: 38,
      };

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            {
              id: 'measurement-1',
              user_id: userId,
              ...measurements,
              arms: null,
              thighs: null,
              notes: null,
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const result = await bodyTrackingService.logBodyMeasurement(userId, measurements);

      expect(result.chest).toBe(40);
      expect(result.waist).toBe(32);
      expect(result.hips).toBe(38);
    });

    it('should get body measurement history', async () => {
      const userId = 'test-user-1';

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            {
              id: 'measurement-1',
              user_id: userId,
              chest: 40,
              waist: 32,
              hips: 38,
              arms: null,
              thighs: null,
              notes: null,
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const history = await bodyTrackingService.getBodyMeasurementHistory(userId, 100, 0);

      expect(history.length).toBe(1);
      expect(history[0].chest).toBe(40);
    });

    it('should calculate measurement change', async () => {
      const userId = 'test-user-1';

      const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;
      const mockPool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [
            { chest: 40 },
            { chest: 42 },
          ],
        }),
      };

      mockGetPool.mockReturnValue(mockPool as any);

      const change = await bodyTrackingService.calculateMeasurementChange(userId, 'chest');

      expect(change).not.toBeNull();
      expect(change!.current).toBe(40);
      expect(change!.previous).toBe(42);
      expect(change!.change).toBe(-2);
    });
  });
});
