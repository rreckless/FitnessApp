import * as fraudService from '../fraudDetectionService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

describe('Fraud Detection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateWorkoutData', () => {
    it('should validate correct workout data', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10], // reps per set
        100, // weight
        1800, // duration (30 minutes)
        30 // total reps
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isSuspicious).toBe(false);
    });

    it('should reject reps per set > 50', () => {
      const result = fraudService.validateWorkoutData(
        [60, 10, 10],
        100,
        1800,
        80
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Maximum 50 reps per set');
    });

    it('should reject total reps > 100', () => {
      const result = fraudService.validateWorkoutData(
        [40, 40, 40],
        100,
        1800,
        120
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Maximum 100 total reps');
    });

    it('should reject weight < 1', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10],
        0,
        1800,
        30
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Weight must be between 1 and 1000');
    });

    it('should reject weight > 1000', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10],
        1500,
        1800,
        30
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Weight must be between 1 and 1000');
    });

    it('should reject duration < 5 minutes', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10],
        100,
        200, // 3.3 minutes
        30
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Exercise duration must be between 5 minutes and 4 hours');
    });

    it('should reject duration > 4 hours', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10],
        100,
        20000, // 5.5 hours
        30
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Exercise duration must be between 5 minutes and 4 hours');
    });

    it('should flag suspicious high rep count', () => {
      const result = fraudService.validateWorkoutData(
        [30, 30, 30],
        100,
        1800,
        90
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.suspiciousReasons[0]).toContain('Unusually high rep count');
    });

    it('should flag suspicious heavy weight', () => {
      const result = fraudService.validateWorkoutData(
        [10, 10, 10],
        600,
        1800,
        30
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.suspiciousReasons[0]).toContain('Very heavy weight');
    });

    it('should flag suspicious high reps in single set', () => {
      const result = fraudService.validateWorkoutData(
        [45, 10, 10],
        100,
        1800,
        65
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.suspiciousReasons[0]).toContain('Very high reps in single set');
    });

    it('should flag unrealistic rep/weight combination', () => {
      const result = fraudService.validateWorkoutData(
        [20, 20, 20],
        400,
        1800,
        60
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.suspiciousReasons[0]).toContain('Unusually high reps with very heavy weight');
    });
  });

  describe('detectFraudPatterns', () => {
    it('should return no fraud for new user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 5000,
        totalXP: 50,
        duration: 1800,
      });

      expect(result.isFraudulent).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should detect volume outlier (3x average)', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
        ],
      });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 3500, // 3.5x average
        totalXP: 35,
        duration: 1800,
      });

      expect(result.isFraudulent).toBe(true);
      expect(result.reasons[0]).toContain('Volume is 3x higher');
    });

    it('should detect XP outlier (3x average)', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
        ],
      });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 1000,
        totalXP: 35, // 3.5x average
        duration: 1800,
      });

      expect(result.isFraudulent).toBe(true);
      expect(result.reasons[0]).toContain('XP is 3x higher');
    });

    it('should detect duration outlier (2x average)', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
        ],
      });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 1000,
        totalXP: 10,
        duration: 3700, // 2x average
      });

      expect(result.isFraudulent).toBe(true);
      expect(result.reasons[0]).toContain('Duration is 2x longer');
    });

    it('should detect rapid consecutive workouts', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      mockQuery.mockResolvedValueOnce({
        rows: [
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: recentTime.toISOString() },
        ],
      });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 1000,
        totalXP: 10,
        duration: 1800,
      });

      expect(result.reasons[0]).toContain('Multiple workouts logged within 1 hour');
    });

    it('should detect unrealistic volume per minute', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
          { total_volume: 1000, total_xp: 10, duration: 1800, created_at: new Date().toISOString() },
        ],
      });

      const result = await fraudService.detectFraudPatterns('user-123', {
        totalVolume: 4000, // Very high volume
        totalXP: 40,
        duration: 600, // Very short duration
      });

      expect(result.reasons[0]).toContain('Unusually high volume per minute');
    });
  });

  describe('flagWorkout', () => {
    it('should flag workout for review', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fraudService.flagWorkout('workout-123', 'user-123', 'Suspicious volume', 'HIGH');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO flagged_workouts'),
        expect.arrayContaining(['workout-123', 'user-123', 'Suspicious volume', 'HIGH'])
      );
    });
  });

  describe('getFlaggedWorkouts', () => {
    it('should get flagged workouts', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'flag-123',
            workout_id: 'workout-123',
            user_id: 'user-123',
            reason: 'Suspicious volume',
            severity: 'HIGH',
            flagged_at: new Date().toISOString(),
            reviewed: false,
          },
        ],
      });

      const result = await fraudService.getFlaggedWorkouts(50, 0);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('Suspicious volume');
    });

    it('should filter by reviewed status', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fraudService.getFlaggedWorkouts(50, 0, true);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE reviewed = $1'),
        expect.arrayContaining([true])
      );
    });
  });

  describe('reviewFlaggedWorkout', () => {
    it('should review flagged workout', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fraudService.reviewFlaggedWorkout('flag-123', true, 'Approved', 'admin-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE flagged_workouts'),
        expect.arrayContaining(['admin-123', 'Approved', 'APPROVED', 'flag-123'])
      );
    });
  });

  describe('rollbackWorkoutXP', () => {
    it('should rollback XP for fraudulent workout', async () => {
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_xp: 100 }],
      });

      mockClient.query.mockResolvedValue({ rows: [] });

      await fraudService.rollbackWorkoutXP('workout-123', 'user-123');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_xp: 100 }],
      });

      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(fraudService.rollbackWorkoutXP('workout-123', 'user-123')).rejects.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getFraudStatistics', () => {
    it('should get fraud statistics', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // total flagged
        .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // reviewed
        .mockResolvedValueOnce({ rows: [{ count: '6' }] }) // approved
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // rejected
        .mockResolvedValueOnce({ rows: [{ total: '500' }] }); // total XP rolled back

      const result = await fraudService.getFraudStatistics();

      expect(result.totalFlaggedWorkouts).toBe(10);
      expect(result.reviewedWorkouts).toBe(8);
      expect(result.approvedWorkouts).toBe(6);
      expect(result.rejectedWorkouts).toBe(2);
      expect(result.totalXPRolledBack).toBe(500);
    });
  });
});
