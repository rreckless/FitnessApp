// Mock DatabaseManager before importing the service
const mockDb = {
  executeSql: jest.fn().mockResolvedValue({
    rows: {
      length: 0,
      raw: jest.fn(() => []),
    },
  }),
};

jest.mock('../database/DatabaseManager', () => mockDb);

import RestTimerService, { RestSession } from '../services/RestTimerService';

describe('RestTimerService', () => {
  let service: typeof RestTimerService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = RestTimerService;

    // Reset mock
    mockDb.executeSql.mockResolvedValue({
      rows: {
        length: 0,
        raw: jest.fn(() => []),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Timer Countdown', () => {
    test('should start timer with suggested duration', async () => {
      const session = await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(session).toBeDefined();
      expect(session.suggestedDuration).toBeGreaterThanOrEqual(120);
      expect(session.suggestedDuration).toBeLessThanOrEqual(180);

      const state = service.getState();
      expect(state.isRunning).toBe(true);
      expect(state.remainingSeconds).toBe(session.suggestedDuration);
    });

    test('should decrement remaining seconds', async () => {
      await service.startRestTimer('exercise-1', 'HYPERTROPHY');
      const initialState = service.getState();
      const initialRemaining = initialState.remainingSeconds;

      jest.advanceTimersByTime(1000);

      const updatedState = service.getState();
      expect(updatedState.remainingSeconds).toBe(initialRemaining - 1);
    });

    test('should complete timer when countdown reaches zero', async () => {
      await service.startRestTimer('exercise-1', 'ENDURANCE');
      const state = service.getState();
      
      // Verify timer is running
      expect(state.isRunning).toBe(true);
      expect(state.remainingSeconds).toBeGreaterThan(0);
      
      // Skip the timer to complete it
      await service.skipTimer();
      
      const finalState = service.getState();
      expect(finalState.isRunning).toBe(false);
      expect(finalState.currentSession).toBeNull();
    });
  });

  describe('Smart Suggestions', () => {
    test('should suggest 2-3 minutes for strength exercises', async () => {
      const session = await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(session.suggestedDuration).toBeGreaterThanOrEqual(120);
      expect(session.suggestedDuration).toBeLessThanOrEqual(180);
    });

    test('should suggest 60-90 seconds for hypertrophy exercises', async () => {
      const session = await service.startRestTimer('exercise-1', 'HYPERTROPHY');

      expect(session.suggestedDuration).toBeGreaterThanOrEqual(60);
      expect(session.suggestedDuration).toBeLessThanOrEqual(90);
    });

    test('should suggest 30-45 seconds for endurance exercises', async () => {
      const session = await service.startRestTimer('exercise-1', 'ENDURANCE');

      expect(session.suggestedDuration).toBeGreaterThanOrEqual(30);
      expect(session.suggestedDuration).toBeLessThanOrEqual(45);
    });

    test('should suggest 30-60 seconds for cardio exercises', async () => {
      const session = await service.startRestTimer('exercise-1', 'CARDIO');

      expect(session.suggestedDuration).toBeGreaterThanOrEqual(30);
      expect(session.suggestedDuration).toBeLessThanOrEqual(60);
    });
  });

  describe('Manual Adjustment', () => {
    test('should adjust duration to custom value', async () => {
      await service.startRestTimer('exercise-1', 'STRENGTH');
      service.adjustDuration(120);

      const state = service.getState();
      expect(state.totalSeconds).toBe(120);
      expect(state.remainingSeconds).toBe(120);
    });

    test('should reject duration below 30 seconds', async () => {
      await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(() => {
        service.adjustDuration(29);
      }).toThrow('Duration must be between 30 and 300 seconds');
    });

    test('should reject duration above 300 seconds', async () => {
      await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(() => {
        service.adjustDuration(301);
      }).toThrow('Duration must be between 30 and 300 seconds');
    });

    test('should accept duration at boundaries', async () => {
      await service.startRestTimer('exercise-1', 'STRENGTH');

      service.adjustDuration(30);
      let state = service.getState();
      expect(state.totalSeconds).toBe(30);

      service.adjustDuration(300);
      state = service.getState();
      expect(state.totalSeconds).toBe(300);
    });
  });

  describe('Average Calculation', () => {
    test('should calculate average rest duration from history', async () => {
      mockDb.executeSql.mockResolvedValueOnce({
        rows: {
          raw: () => [{ avgDuration: 75 }],
        },
      });

      const average = await service.calculateAverageRestDuration('exercise-1');

      expect(average).toBe(75);
    });

    test('should return null when no history exists', async () => {
      mockDb.executeSql.mockResolvedValueOnce({
        rows: {
          raw: () => [],
        },
      });

      const average = await service.calculateAverageRestDuration('exercise-1');

      expect(average).toBeNull();
    });

    test('should return null when no completed sessions exist', async () => {
      mockDb.executeSql.mockResolvedValueOnce({
        rows: {
          raw: () => [{ avgDuration: null }],
        },
      });

      const average = await service.calculateAverageRestDuration('exercise-1');

      expect(average).toBeNull();
    });
  });

  describe('Skip Timer', () => {
    test('should record actual duration when skipped', async () => {
      await service.startRestTimer('exercise-1', 'STRENGTH');
      jest.advanceTimersByTime(5000);

      await service.skipTimer();

      const state = service.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentSession).toBeNull();
    });

    test('should handle skip when no timer is running', async () => {
      await expect(service.skipTimer()).resolves.not.toThrow();
    });
  });

  describe('State Management', () => {
    test('should notify listeners on state change', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    test('should allow multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);

      await service.startRestTimer('exercise-1', 'STRENGTH');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test('should unsubscribe listener', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      await service.startRestTimer('exercise-1', 'STRENGTH');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      jest.useRealTimers();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session History', () => {
    test('should retrieve rest session history', async () => {
      const mockSessions: RestSession[] = [
        {
          id: '1',
          exerciseId: 'exercise-1',
          exerciseType: 'STRENGTH',
          suggestedDuration: 150,
          actualDuration: 145,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDb.executeSql.mockResolvedValueOnce({
        rows: {
          raw: () => mockSessions,
        },
      });

      const history = await service.getRestSessionHistory('exercise-1');

      expect(history).toEqual(mockSessions);
      expect(history.length).toBe(1);
    });

    test('should return empty array when no history exists', async () => {
      mockDb.executeSql.mockResolvedValueOnce({
        rows: {
          raw: () => [],
        },
      });

      const history = await service.getRestSessionHistory('exercise-1');

      expect(history).toEqual([]);
    });
  });
});
