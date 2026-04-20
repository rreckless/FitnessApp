import uuid from 'react-native-uuid';
import DatabaseManager from '../database/DatabaseManager';

const uuidv4 = uuid.v4;

export interface RestSession {
  id: string;
  exerciseId: string;
  exerciseType: 'STRENGTH' | 'HYPERTROPHY' | 'ENDURANCE' | 'CARDIO';
  suggestedDuration: number; // seconds
  actualDuration: number | null; // seconds
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  currentSession: RestSession | null;
}

export class RestTimerService {
  private static instance: RestTimerService;
  private timerInterval: NodeJS.Timeout | null = null;
  private state: RestTimerState = {
    isRunning: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    currentSession: null,
  };
  private listeners: Set<(state: RestTimerState) => void> = new Set();

  private constructor() {}

  static getInstance(): RestTimerService {
    if (!RestTimerService.instance) {
      RestTimerService.instance = new RestTimerService();
    }
    return RestTimerService.instance;
  }

  /**
   * Calculate smart rest duration suggestion based on exercise type
   * Strength: 2-3 minutes (120-180 seconds)
   * Hypertrophy: 60-90 seconds
   * Endurance: 30-45 seconds
   * Cardio: 30-60 seconds
   */
  private calculateSuggestedDuration(
    exerciseType: 'STRENGTH' | 'HYPERTROPHY' | 'ENDURANCE' | 'CARDIO',
    userAverageRest: number | null
  ): number {
    let baseDuration: number;
    let variance: number;

    switch (exerciseType) {
      case 'STRENGTH':
        baseDuration = 150; // 2.5 minutes
        variance = 30;
        break;
      case 'HYPERTROPHY':
        baseDuration = 75; // 1.25 minutes
        variance = 15;
        break;
      case 'ENDURANCE':
        baseDuration = 37; // ~40 seconds
        variance = 8;
        break;
      case 'CARDIO':
        baseDuration = 45;
        variance = 15;
        break;
      default:
        baseDuration = 60;
        variance = 10;
    }

    // Adjust based on user's average rest duration (30% weight to user preference)
    if (userAverageRest !== null) {
      const adjustment = (userAverageRest - baseDuration) * 0.3;
      baseDuration = baseDuration + adjustment;
    }

    // Clamp to variance range
    const min = Math.max(30, baseDuration - variance);
    const max = Math.min(300, baseDuration + variance);
    return Math.round(Math.max(min, Math.min(max, baseDuration)));
  }

  /**
   * Calculate average rest duration for a specific exercise
   */
  async calculateAverageRestDuration(exerciseId: string): Promise<number | null> {
    try {
      const sql = `
        SELECT AVG(actualDuration) as avgDuration
        FROM rest_sessions
        WHERE exerciseId = ? AND actualDuration IS NOT NULL
      `;
      const result = await DatabaseManager.executeSql(sql, [exerciseId]);

      if (result.rows.length === 0 || !result.rows.raw()[0].avgDuration) {
        return null;
      }

      return Math.round(result.rows.raw()[0].avgDuration);
    } catch (error) {
      console.error('Failed to calculate average rest duration:', error);
      return null;
    }
  }

  /**
   * Start a rest timer session
   */
  async startRestTimer(
    exerciseId: string,
    exerciseType: 'STRENGTH' | 'HYPERTROPHY' | 'ENDURANCE' | 'CARDIO',
    customDuration?: number
  ): Promise<RestSession> {
    // Stop any existing timer
    this.stopTimer();

    // Calculate suggested duration
    const userAverage = await this.calculateAverageRestDuration(exerciseId);
    const suggestedDuration = customDuration || this.calculateSuggestedDuration(exerciseType, userAverage);

    // Create rest session
    const session: RestSession = {
      id: uuidv4(),
      exerciseId,
      exerciseType,
      suggestedDuration,
      actualDuration: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in database
    await this.saveRestSession(session);

    // Update state
    this.state = {
      isRunning: true,
      remainingSeconds: suggestedDuration,
      totalSeconds: suggestedDuration,
      currentSession: session,
    };

    // Start countdown
    this.startCountdown();
    this.notifyListeners();

    return session;
  }

  /**
   * Adjust rest duration manually (30-300 seconds)
   */
  adjustDuration(newDuration: number): void {
    if (newDuration < 30 || newDuration > 300) {
      throw new Error('Duration must be between 30 and 300 seconds');
    }

    if (this.state.currentSession) {
      this.state.currentSession.suggestedDuration = newDuration;
      this.state.totalSeconds = newDuration;
      this.state.remainingSeconds = newDuration;
      this.notifyListeners();
    }
  }

  /**
   * Skip the rest timer
   */
  async skipTimer(): Promise<void> {
    if (!this.state.currentSession) {
      return;
    }

    const now = new Date().toISOString();
    const startTime = new Date(this.state.currentSession.startedAt).getTime();
    const currentTime = new Date(now).getTime();
    const actualDuration = Math.round((currentTime - startTime) / 1000);

    this.state.currentSession.actualDuration = actualDuration;
    this.state.currentSession.completedAt = now;
    this.state.currentSession.updatedAt = now;

    await this.saveRestSession(this.state.currentSession);

    this.stopTimer();
    this.state = {
      isRunning: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      currentSession: null,
    };
    this.notifyListeners();
  }

  /**
   * Get current timer state
   */
  getState(): RestTimerState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: RestTimerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get rest session history for an exercise
   */
  async getRestSessionHistory(exerciseId: string, limit: number = 50): Promise<RestSession[]> {
    try {
      const sql = `
        SELECT * FROM rest_sessions
        WHERE exerciseId = ?
        ORDER BY startedAt DESC
        LIMIT ?
      `;
      const result = await DatabaseManager.executeSql(sql, [exerciseId, limit]);
      return result.rows.raw() as RestSession[];
    } catch (error) {
      console.error('Failed to get rest session history:', error);
      return [];
    }
  }

  // MARK: - Private Methods

  private startCountdown(): void {
    this.timerInterval = setInterval(() => {
      if (this.state.remainingSeconds > 0) {
        this.state.remainingSeconds--;
        this.notifyListeners();
      } else {
        this.completeTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async completeTimer(): Promise<void> {
    this.stopTimer();

    if (this.state.currentSession) {
      const now = new Date().toISOString();
      this.state.currentSession.actualDuration = this.state.totalSeconds;
      this.state.currentSession.completedAt = now;
      this.state.currentSession.updatedAt = now;

      await this.saveRestSession(this.state.currentSession);

      // Play notification sound (would be implemented with react-native-sound or similar)
      this.playNotificationSound();
    }

    this.state = {
      isRunning: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      currentSession: null,
    };
    this.notifyListeners();
  }

  private async saveRestSession(session: RestSession): Promise<void> {
    try {
      const sql = `
        INSERT OR REPLACE INTO rest_sessions
        (id, exerciseId, exerciseType, suggestedDuration, actualDuration, startedAt, completedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await DatabaseManager.executeSql(sql, [
        session.id,
        session.exerciseId,
        session.exerciseType,
        session.suggestedDuration,
        session.actualDuration,
        session.startedAt,
        session.completedAt,
        session.createdAt,
        session.updatedAt,
      ]);
    } catch (error) {
      console.error('Failed to save rest session:', error);
    }
  }

  private playNotificationSound(): void {
    // This would be implemented with react-native-sound or similar
    // For now, just log it
    console.log('Rest timer completed - play notification sound');
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener({ ...this.state });
    });
  }
}

export default RestTimerService.getInstance();
