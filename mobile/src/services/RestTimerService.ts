import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RestTimerSession {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseType: 'compound' | 'isolation' | 'cardio';
  suggestedDuration: number; // seconds
  actualDuration: number; // seconds
  manuallyAdjusted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  sessionId: string;
}

export interface RestSuggestion {
  exerciseType: 'compound' | 'isolation' | 'cardio';
  minDuration: number;
  maxDuration: number;
  recommended: number;
}

export interface AverageRestData {
  exerciseId: string;
  exerciseName: string;
  averageRestDuration: number;
  sessionCount: number;
  lastUpdated: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class RestTimerService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private userId: string;
  private apiBaseUrl: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private timerInterval: NodeJS.Timeout | null = null;
  private currentSession: RestTimerState | null = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor(apiBaseUrl: string, userId: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.userId = userId;
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    });
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'fitquest.db',
        location: 'default',
      });

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS rest_timer_sessions (
          id TEXT PRIMARY KEY,
          workoutId TEXT NOT NULL,
          exerciseId TEXT NOT NULL,
          exerciseType TEXT NOT NULL,
          suggestedDuration INTEGER NOT NULL,
          actualDuration INTEGER NOT NULL,
          manuallyAdjusted INTEGER NOT NULL,
          completedAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS rest_timer_cache (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to initialize RestTimerService database:', error);
    }
  }

  /**
   * Get smart rest duration suggestion based on exercise type
   * Strength: 2-3 min, Hypertrophy: 60-90 sec, Endurance: 30-45 sec
   */
  getSuggestion(exerciseType: 'compound' | 'isolation' | 'cardio'): RestSuggestion {
    const suggestions: Record<string, RestSuggestion> = {
      compound: {
        exerciseType: 'compound',
        minDuration: 120, // 2 minutes
        maxDuration: 180, // 3 minutes
        recommended: 150, // 2.5 minutes
      },
      isolation: {
        exerciseType: 'isolation',
        minDuration: 60, // 1 minute
        maxDuration: 90, // 1.5 minutes
        recommended: 75, // 1.25 minutes
      },
      cardio: {
        exerciseType: 'cardio',
        minDuration: 30, // 30 seconds
        maxDuration: 45, // 45 seconds
        recommended: 37, // ~37 seconds
      },
    };

    return suggestions[exerciseType] || suggestions.isolation;
  }

  /**
   * Start a rest timer session
   */
  async startTimer(
    workoutId: string,
    exerciseId: string,
    exerciseType: 'compound' | 'isolation' | 'cardio',
    customDuration?: number
  ): Promise<RestTimerState> {
    const suggestion = this.getSuggestion(exerciseType);
    const duration = customDuration || suggestion.recommended;

    // Validate duration is within bounds (30-300 seconds)
    if (duration < 30 || duration > 300) {
      throw new Error('Rest duration must be between 30 and 300 seconds');
    }

    const sessionId = uuid.v4().toString();
    this.currentSession = {
      isRunning: true,
      remainingSeconds: duration,
      totalSeconds: duration,
      sessionId,
    };

    // Store session in database
    const session: RestTimerSession = {
      id: sessionId,
      workoutId,
      exerciseId,
      exerciseType,
      suggestedDuration: suggestion.recommended,
      actualDuration: duration,
      manuallyAdjusted: customDuration !== undefined && customDuration !== suggestion.recommended,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storeSessionLocally(session);
    this.emit('timerStarted', this.currentSession);

    // Start countdown
    this.startCountdown(sessionId);

    return this.currentSession;
  }

  /**
   * Adjust rest duration manually (30-300 seconds)
   */
  adjustDuration(newDuration: number): void {
    if (!this.currentSession) {
      throw new Error('No active timer session');
    }

    if (newDuration < 30 || newDuration > 300) {
      throw new Error('Rest duration must be between 30 and 300 seconds');
    }

    this.currentSession.totalSeconds = newDuration;
    this.currentSession.remainingSeconds = newDuration;
    this.emit('durationAdjusted', this.currentSession);
  }

  /**
   * Skip the timer and record actual rest duration
   */
  async skipTimer(): Promise<RestTimerSession | null> {
    if (!this.timerInterval) {
      return null;
    }

    clearInterval(this.timerInterval);
    this.timerInterval = null;

    if (!this.currentSession) {
      return null;
    }

    const actualDuration = this.currentSession.totalSeconds - this.currentSession.remainingSeconds;
    const session = await this.completeSession(this.currentSession.sessionId, actualDuration);

    this.currentSession = null;
    this.emit('timerSkipped', session);

    return session;
  }

  /**
   * Get average rest duration for a workout
   */
  async getAverageRestDuration(workoutId: string): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT AVG(actualDuration) as avgDuration FROM rest_timer_sessions WHERE workoutId = ?`,
        [workoutId]
      );

      if (result[0].rows.length > 0) {
        return result[0].rows.item(0).avgDuration || 0;
      }

      return 0;
    } catch (error) {
      console.error('Failed to get average rest duration:', error);
      return 0;
    }
  }

  /**
   * Get average rest duration by exercise
   */
  async getAverageRestByExercise(exerciseId: string): Promise<AverageRestData | null> {
    if (!this.db) {
      return null;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT 
          exerciseId,
          AVG(actualDuration) as avgDuration,
          COUNT(*) as sessionCount,
          MAX(updatedAt) as lastUpdated
        FROM rest_timer_sessions 
        WHERE exerciseId = ? AND completedAt IS NOT NULL
        GROUP BY exerciseId`,
        [exerciseId]
      );

      if (result[0].rows.length > 0) {
        const row = result[0].rows.item(0);
        return {
          exerciseId: row.exerciseId,
          exerciseName: exerciseId, // Would be populated from exercise library in real app
          averageRestDuration: Math.round(row.avgDuration),
          sessionCount: row.sessionCount,
          lastUpdated: row.lastUpdated,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get average rest by exercise:', error);
      return null;
    }
  }

  /**
   * Get all rest sessions for a workout
   */
  async getWorkoutRestSessions(workoutId: string): Promise<RestTimerSession[]> {
    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM rest_timer_sessions WHERE workoutId = ? ORDER BY createdAt DESC`,
        [workoutId]
      );

      const sessions: RestTimerSession[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        sessions.push(result[0].rows.item(i));
      }

      return sessions;
    } catch (error) {
      console.error('Failed to get workout rest sessions:', error);
      return [];
    }
  }

  /**
   * Get current timer state
   */
  getCurrentState(): RestTimerState | null {
    return this.currentSession;
  }

  /**
   * Stop the timer without completing
   */
  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.currentSession = null;
    this.emit('timerStopped', null);
  }

  /**
   * Subscribe to timer events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from timer events
   */
  off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      return;
    }
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit timer events
   */
  private emit(event: string, data: any): void {
    if (!this.listeners.has(event)) {
      return;
    }
    this.listeners.get(event)!.forEach((callback) => callback(data));
  }

  /**
   * Start countdown timer
   */
  private startCountdown(sessionId: string): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(async () => {
      if (!this.currentSession) {
        clearInterval(this.timerInterval!);
        this.timerInterval = null;
        return;
      }

      this.currentSession.remainingSeconds--;
      this.emit('timerTick', this.currentSession);

      if (this.currentSession.remainingSeconds <= 0) {
        clearInterval(this.timerInterval!);
        this.timerInterval = null;

        // Play notification sound
        await this.playNotificationSound();

        // Complete session
        const session = await this.completeSession(sessionId, this.currentSession.totalSeconds);
        this.emit('timerCompleted', session);
        this.currentSession = null;
      }
    }, 1000);
  }

  /**
   * Complete a timer session
   */
  private async completeSession(sessionId: string, actualDuration: number): Promise<RestTimerSession | null> {
    if (!this.db) {
      return null;
    }

    try {
      const now = new Date().toISOString();
      await this.db.executeSql(
        `UPDATE rest_timer_sessions 
         SET actualDuration = ?, completedAt = ?, updatedAt = ? 
         WHERE id = ?`,
        [actualDuration, now, now, sessionId]
      );

      // Queue for sync
      await this.queueForSync('update', sessionId);

      // Fetch and return updated session
      const result = await this.db.executeSql(
        `SELECT * FROM rest_timer_sessions WHERE id = ?`,
        [sessionId]
      );

      if (result[0].rows.length > 0) {
        return result[0].rows.item(0);
      }

      return null;
    } catch (error) {
      console.error('Failed to complete session:', error);
      return null;
    }
  }

  /**
   * Store session locally
   */
  private async storeSessionLocally(session: RestTimerSession): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO rest_timer_sessions 
         (id, workoutId, exerciseId, exerciseType, suggestedDuration, actualDuration, manuallyAdjusted, createdAt, updatedAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          session.id,
          session.workoutId,
          session.exerciseId,
          session.exerciseType,
          session.suggestedDuration,
          session.actualDuration,
          session.manuallyAdjusted ? 1 : 0,
          session.createdAt,
          session.updatedAt,
        ]
      );

      // Queue for sync
      await this.queueForSync('create', session.id);
    } catch (error) {
      console.error('Failed to store session locally:', error);
    }
  }

  /**
   * Queue operation for sync
   */
  private async queueForSync(operation: 'create' | 'update' | 'delete', sessionId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const syncItem = {
        id: uuid.v4().toString(),
        userId: this.userId,
        operation,
        entityType: 'REST_TIMER_SESSION',
        entityId: sessionId,
        payload: {},
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      await this.db.executeSql(
        `INSERT INTO sync_queue (id, userId, operation, entityType, entityId, payload, status, retryCount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          syncItem.id,
          syncItem.userId,
          syncItem.operation,
          syncItem.entityType,
          syncItem.entityId,
          JSON.stringify(syncItem.payload),
          syncItem.status,
          syncItem.retryCount,
          syncItem.createdAt,
        ]
      );
    } catch (error) {
      console.error('Failed to queue for sync:', error);
    }
  }

  /**
   * Play notification sound when timer completes
   */
  private async playNotificationSound(): Promise<void> {
    try {
      // Sound would be played here in a real implementation
      // For now, we'll just create a placeholder
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * Sync pending operations
   */
  async syncPendingOperations(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM sync_queue WHERE entityType = 'REST_TIMER_SESSION' AND status = 'PENDING' LIMIT 10`
      );

      for (let i = 0; i < result[0].rows.length; i++) {
        const item = result[0].rows.item(i);
        await this.processSyncItem(item);
      }
    } catch (error) {
      console.error('Failed to sync pending operations:', error);
    }
  }

  /**
   * Process a single sync item
   */
  private async processSyncItem(item: any): Promise<void> {
    try {
      if (item.operation === 'create' || item.operation === 'update') {
        const session = await this.getSessionById(item.entityId);
        if (session) {
          await this.apiClient.post('/rest-timer/sync', session);
        }
      } else if (item.operation === 'delete') {
        await this.apiClient.delete(`/rest-timer/${item.entityId}`);
      }

      // Mark as synced
      if (this.db) {
        await this.db.executeSql(
          `UPDATE sync_queue SET status = 'SYNCED' WHERE id = ?`,
          [item.id]
        );
      }
    } catch (error) {
      console.error('Failed to process sync item:', error);
      // Retry logic would be implemented here
    }
  }

  /**
   * Get session by ID
   */
  private async getSessionById(sessionId: string): Promise<RestTimerSession | null> {
    if (!this.db) {
      return null;
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM rest_timer_sessions WHERE id = ?`,
        [sessionId]
      );

      if (result[0].rows.length > 0) {
        return result[0].rows.item(0);
      }

      return null;
    } catch (error) {
      console.error('Failed to get session by ID:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(`DELETE FROM rest_timer_cache`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
