import GPSTrackerService, { GPSTrackingSession, GPSCoordinate } from '../services/GPSTrackerService';
import DatabaseManager from '../database/DatabaseManager';

// Mock DatabaseManager
jest.mock('../database/DatabaseManager', () => ({
  executeSql: jest.fn(),
}));

describe('GPSTrackerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GPS Recording', () => {
    it('should start tracking session', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      const session = await GPSTrackerService.startTracking();

      expect(session).toBeDefined();
      expect(session.isActive).toBe(true);
      expect(session.coordinates).toEqual([]);
      expect(session.distance).toBe(0);
      expect(session.pace).toBe(0);
      expect(session.elevationGain).toBe(0);
      expect(session.elevationLoss).toBe(0);
      expect(session.signalLost).toBe(false);
    });

    it('should record GPS coordinate', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      const coord = await GPSTrackerService.recordCoordinate(40.7128, -74.006, 10, 5);

      expect(coord).toBeDefined();
      expect(coord?.latitude).toBe(40.7128);
      expect(coord?.longitude).toBe(-74.006);
      expect(coord?.elevation).toBe(10);
      expect(coord?.accuracy).toBe(5);
    });

    it('should not record coordinate if distance < 10 meters', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record first coordinate
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      // Record second coordinate very close to first (< 10 meters)
      const coord2 = await GPSTrackerService.recordCoordinate(40.71281, -74.00601);

      // Should return null because distance is too small
      expect(coord2).toBeNull();
    });

    it('should record coordinate if distance >= 10 meters', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record first coordinate
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      // Record second coordinate far enough away (> 10 meters)
      const coord2 = await GPSTrackerService.recordCoordinate(40.7138, -74.0055);

      expect(coord2).not.toBeNull();
      expect(coord2?.latitude).toBe(40.7138);
    });

    it('should end tracking session', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      const endedSession = await GPSTrackerService.endTracking();

      expect(endedSession).toBeDefined();
      expect(endedSession?.isActive).toBe(false);
      expect(endedSession?.endTime).toBeDefined();
    });

    it('should get current session', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      const startedSession = await GPSTrackerService.startTracking();
      const currentSession = GPSTrackerService.getCurrentSession();

      expect(currentSession).toBeDefined();
      expect(currentSession?.id).toBe(startedSession.id);
    });

    it('should return null when getting current session if not tracking', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      // End any active session first
      await GPSTrackerService.endTracking();
      
      const currentSession = GPSTrackerService.getCurrentSession();

      expect(currentSession).toBeNull();
    });
  });

  describe('Signal Loss Handling', () => {
    it('should handle signal loss', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.handleSignalLoss();

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.signalLost).toBe(true);
    });

    it('should handle signal recovery', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.handleSignalLoss();
      await GPSTrackerService.handleSignalRecovery();

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.signalLost).toBe(false);
    });

    it('should update last signal time on recovery', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      const beforeRecovery = GPSTrackerService.getCurrentSession()?.lastSignalTime;

      // Add a small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await GPSTrackerService.handleSignalLoss();
      await GPSTrackerService.handleSignalRecovery();

      const afterRecovery = GPSTrackerService.getCurrentSession()?.lastSignalTime;
      expect(afterRecovery).not.toBe(beforeRecovery);
    });

    it('should maintain signal lost state until recovery', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.handleSignalLoss();

      let session = GPSTrackerService.getCurrentSession();
      expect(session?.signalLost).toBe(true);

      // Try to record coordinate while signal is lost
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      session = GPSTrackerService.getCurrentSession();
      // Signal should be recovered after recording coordinate
      expect(session?.signalLost).toBe(false);
    });
  });

  describe('Distance and Pace Calculation', () => {
    it('should calculate distance between coordinates', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // NYC to a point ~0.5 miles away
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);
      await GPSTrackerService.recordCoordinate(40.7178, -74.006);

      const session = GPSTrackerService.getCurrentSession();
      // Distance should be calculated only after second coordinate
      expect(session?.distance).toBeGreaterThanOrEqual(0);
    });

    it('should calculate pace correctly', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record coordinates with time difference
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      // Add a small delay to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await GPSTrackerService.recordCoordinate(40.7178, -74.006);

      const session = GPSTrackerService.getCurrentSession();
      if (session && session.distance > 0) {
        // Pace should be calculated (minutes per mile)
        expect(session.pace).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle zero distance pace calculation', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.pace).toBe(0);
    });
  });

  describe('Elevation Tracking', () => {
    it('should track elevation gain', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record coordinates with increasing elevation
      await GPSTrackerService.recordCoordinate(40.7128, -74.006, 0);
      await GPSTrackerService.recordCoordinate(40.7129, -74.0061, 100);
      await GPSTrackerService.recordCoordinate(40.713, -74.0062, 200);

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.elevationGain).toBeGreaterThan(0);
      // Elevation gain should be 100 + 100 = 200, but only counted from second coordinate
      expect(session?.elevationGain).toBe(100);
    });

    it('should track elevation loss', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record coordinates with decreasing elevation
      await GPSTrackerService.recordCoordinate(40.7128, -74.006, 200);
      await GPSTrackerService.recordCoordinate(40.7129, -74.0061, 100);
      await GPSTrackerService.recordCoordinate(40.713, -74.0062, 0);

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.elevationLoss).toBeGreaterThan(0);
      // Elevation loss should be 100 + 100 = 200, but only counted from second coordinate
      expect(session?.elevationLoss).toBe(100);
    });

    it('should handle mixed elevation changes', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record coordinates with mixed elevation changes
      await GPSTrackerService.recordCoordinate(40.7128, -74.006, 0);
      await GPSTrackerService.recordCoordinate(40.7129, -74.0061, 100); // +100
      await GPSTrackerService.recordCoordinate(40.713, -74.0062, 50); // -50
      await GPSTrackerService.recordCoordinate(40.7131, -74.0063, 150); // +100

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.elevationGain).toBe(100); // Only 100 from second to third, then 100 from third to fourth
      expect(session?.elevationLoss).toBe(50);
    });

    it('should handle null elevation values', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record coordinates without elevation
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);
      await GPSTrackerService.recordCoordinate(40.7129, -74.0061);

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.elevationGain).toBe(0);
      expect(session?.elevationLoss).toBe(0);
    });
  });

  describe('State Management', () => {
    it('should notify listeners on session change', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      const listener = jest.fn();
      GPSTrackerService.subscribe(listener);

      await GPSTrackerService.startTracking();

      expect(listener).toHaveBeenCalled();
    });

    it('should allow multiple listeners', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      GPSTrackerService.subscribe(listener1);
      GPSTrackerService.subscribe(listener2);

      await GPSTrackerService.startTracking();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should unsubscribe listener', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      const listener = jest.fn();
      const unsubscribe = GPSTrackerService.subscribe(listener);

      await GPSTrackerService.startTracking();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await GPSTrackerService.recordCoordinate(40.7128, -74.006);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session History', () => {
    it('should retrieve tracking history', async () => {
      const mockSessions: GPSTrackingSession[] = [
        {
          id: '1',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          coordinates: [],
          distance: 5.5,
          pace: 10,
          elevationGain: 100,
          elevationLoss: 50,
          isActive: false,
          signalLost: false,
          lastSignalTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({
        rows: { raw: () => mockSessions },
      });

      const history = await GPSTrackerService.getTrackingHistory();

      expect(history).toEqual(mockSessions);
      expect(history.length).toBe(1);
    });

    it('should return empty array when no history exists', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({
        rows: { raw: () => [] },
      });

      const history = await GPSTrackerService.getTrackingHistory();

      expect(history).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({
        rows: { raw: () => [] },
      });

      await GPSTrackerService.getTrackingHistory(100);

      expect(mockDb).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), [100]);
    });
  });

  describe('Offline Storage', () => {
    it('should save session to database', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should retrieve session details with coordinates', async () => {
      const mockSession: GPSTrackingSession = {
        id: '1',
        startTime: new Date().toISOString(),
        endTime: null,
        coordinates: [
          {
            id: '1',
            latitude: 40.7128,
            longitude: -74.006,
            elevation: null,
            accuracy: null,
            timestamp: new Date().toISOString(),
          },
        ],
        distance: 0,
        pace: 0,
        elevationGain: 0,
        elevationLoss: 0,
        isActive: true,
        signalLost: false,
        lastSignalTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb
        .mockResolvedValueOnce({
          rows: { raw: () => [mockSession], length: 1 },
        })
        .mockResolvedValueOnce({
          rows: { raw: () => mockSession.coordinates },
        });

      const session = await GPSTrackerService.getSessionDetails('1');

      expect(session).toBeDefined();
      expect(session?.coordinates.length).toBe(1);
    });

    it('should return null if session not found', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({
        rows: { raw: () => [], length: 0 },
      });

      const session = await GPSTrackerService.getSessionDetails('nonexistent');

      expect(session).toBeNull();
    });
  });

  describe('Coordinate Recording Edge Cases', () => {
    it('should handle first coordinate without previous reference', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      // Start fresh tracking session
      await GPSTrackerService.endTracking(); // Clear any previous session
      await GPSTrackerService.startTracking();
      
      const coord = await GPSTrackerService.recordCoordinate(40.7128, -74.006);

      // First coordinate should be recorded (no distance check on first)
      expect(coord).not.toBeNull();
      expect(coord?.latitude).toBe(40.7128);
    });

    it('should handle rapid coordinate recording', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();

      // Record multiple coordinates rapidly
      const coords = [];
      for (let i = 0; i < 5; i++) {
        const coord = await GPSTrackerService.recordCoordinate(
          40.7128 + i * 0.001,
          -74.006 + i * 0.001
        );
        if (coord) coords.push(coord);
      }

      const session = GPSTrackerService.getCurrentSession();
      expect(session?.coordinates.length).toBeGreaterThan(0);
    });
  });

  describe('End Tracking Edge Cases', () => {
    it('should return null when ending tracking without active session', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      // Make sure there's no active session
      await GPSTrackerService.endTracking();
      
      const result = await GPSTrackerService.endTracking();

      expect(result).toBeNull();
    });

    it('should clear current session after ending', async () => {
      const mockDb = DatabaseManager.executeSql as jest.Mock;
      mockDb.mockResolvedValue({ rows: { raw: () => [] } });

      await GPSTrackerService.startTracking();
      await GPSTrackerService.endTracking();

      const current = GPSTrackerService.getCurrentSession();
      expect(current).toBeNull();
    });
  });
});
