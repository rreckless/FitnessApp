import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export interface GPSPoint {
  id: string;
  workoutId: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  accuracy: number;
  timestamp: string;
  createdAt: string;
}

export interface GPSTrackingSession {
  id: string;
  workoutId: string;
  startTime: string;
  endTime?: string;
  totalDistance: number; // meters
  averagePace: number; // seconds per km
  elevationGain: number; // meters
  elevationLoss: number; // meters
  pointCount: number;
  signalLossCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RealTimeMetrics {
  currentDistance: number; // meters
  currentPace: number; // seconds per km
  elapsedTime: number; // seconds
  currentElevation?: number;
  averageElevation?: number;
  lastUpdateTime: string;
}

export interface SignalLossEvent {
  id: string;
  sessionId: string;
  lossStartTime: string;
  recoveryTime?: string;
  durationSeconds: number;
  createdAt: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class GPSTrackerService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private userId: string;
  private apiBaseUrl: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private currentSession: GPSTrackingSession | null = null;
  private lastPoint: GPSPoint | null = null;
  private trackingInterval: NodeJS.Timeout | null = null;
  private signalLossTimeout: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private signalLossThreshold = 30000; // 30 seconds
  private minDistanceChange = 10; // meters
  private recordingInterval = 10000; // 10 seconds

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
        CREATE TABLE IF NOT EXISTS gps_points (
          id TEXT PRIMARY KEY,
          workoutId TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          elevation REAL,
          accuracy REAL NOT NULL,
          timestamp TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS gps_sessions (
          id TEXT PRIMARY KEY,
          workoutId TEXT NOT NULL,
          startTime TEXT NOT NULL,
          endTime TEXT,
          totalDistance REAL NOT NULL,
          averagePace REAL NOT NULL,
          elevationGain REAL NOT NULL,
          elevationLoss REAL NOT NULL,
          pointCount INTEGER NOT NULL,
          signalLossCount INTEGER NOT NULL,
          isActive INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS signal_loss_events (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          lossStartTime TEXT NOT NULL,
          recoveryTime TEXT,
          durationSeconds INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);
    } catch (error) {
      console.error('Failed to initialize GPSTrackerService database:', error);
    }
  }

  /**
   * Request location permissions
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'FitQuest Location Permission',
            message: 'FitQuest needs access to your location to track your workout.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS permissions are handled via Info.plist
      return true;
    } catch (error) {
      console.error('Failed to request location permission:', error);
      return false;
    }
  }

  /**
   * Start GPS tracking for a workout
   */
  async startTracking(workoutId: string): Promise<GPSTrackingSession> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    const sessionId = uuid.v4().toString();
    const now = new Date().toISOString();

    this.currentSession = {
      id: sessionId,
      workoutId,
      startTime: now,
      totalDistance: 0,
      averagePace: 0,
      elevationGain: 0,
      elevationLoss: 0,
      pointCount: 0,
      signalLossCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.storeSessionLocally(this.currentSession);
    this.emit('trackingStarted', this.currentSession);

    // Start recording GPS points
    this.startRecording();

    return this.currentSession;
  }

  /**
   * Stop GPS tracking
   */
  async stopTracking(): Promise<GPSTrackingSession | null> {
    if (!this.currentSession) {
      return null;
    }

    this.stopRecording();

    const now = new Date().toISOString();
    this.currentSession.endTime = now;
    this.currentSession.isActive = false;
    this.currentSession.updatedAt = now;

    await this.updateSessionLocally(this.currentSession);
    this.emit('trackingStopped', this.currentSession);

    const session = this.currentSession;
    this.currentSession = null;
    this.lastPoint = null;

    return session;
  }

  /**
   * Get real-time metrics during tracking
   */
  getRealTimeMetrics(): RealTimeMetrics | null {
    if (!this.currentSession) {
      return null;
    }

    const elapsedTime = Math.floor(
      (new Date().getTime() - new Date(this.currentSession.startTime).getTime()) / 1000
    );

    return {
      currentDistance: this.currentSession.totalDistance,
      currentPace: this.currentSession.averagePace,
      elapsedTime,
      lastUpdateTime: new Date().toISOString(),
    };
  }

  /**
   * Get GPS points for a session
   */
  async getSessionPoints(sessionId: string): Promise<GPSPoint[]> {
    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM gps_points WHERE workoutId = ? ORDER BY timestamp ASC`,
        [sessionId]
      );

      const points: GPSPoint[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        points.push(result[0].rows.item(i));
      }

      return points;
    } catch (error) {
      console.error('Failed to get session points:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two GPS points (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Record a GPS point
   */
  private async recordPoint(latitude: number, longitude: number, elevation?: number, accuracy?: number): Promise<void> {
    if (!this.currentSession || !this.db) {
      return;
    }

    const now = new Date().toISOString();
    const pointId = uuid.v4().toString();

    // Check if distance change is significant
    if (this.lastPoint) {
      const distance = this.calculateDistance(
        this.lastPoint.latitude,
        this.lastPoint.longitude,
        latitude,
        longitude
      );

      if (distance < this.minDistanceChange) {
        return; // Skip if distance change is less than threshold
      }

      // Update session metrics
      this.currentSession.totalDistance += distance;

      // Calculate elevation changes
      if (elevation && this.lastPoint.elevation) {
        const elevationChange = elevation - this.lastPoint.elevation;
        if (elevationChange > 0) {
          this.currentSession.elevationGain += elevationChange;
        } else {
          this.currentSession.elevationLoss += Math.abs(elevationChange);
        }
      }
    }

    const point: GPSPoint = {
      id: pointId,
      workoutId: this.currentSession.workoutId,
      latitude,
      longitude,
      elevation,
      accuracy: accuracy || 0,
      timestamp: now,
      createdAt: now,
    };

    this.lastPoint = point;
    this.currentSession.pointCount++;

    // Calculate average pace (seconds per km)
    const elapsedSeconds = Math.floor(
      (new Date().getTime() - new Date(this.currentSession.startTime).getTime()) / 1000
    );
    const distanceKm = this.currentSession.totalDistance / 1000;
    if (distanceKm > 0) {
      this.currentSession.averagePace = elapsedSeconds / distanceKm;
    }

    await this.storePointLocally(point);
    this.emit('pointRecorded', point);
    this.emit('metricsUpdated', this.getRealTimeMetrics());
  }

  /**
   * Start recording GPS points
   */
  private startRecording(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }

    this.trackingInterval = setInterval(async () => {
      try {
        Geolocation.getCurrentPosition(
          (position) => {
            this.recordPoint(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.altitude || undefined,
              position.coords.accuracy || undefined
            );

            // Clear signal loss timeout on successful location
            if (this.signalLossTimeout) {
              clearTimeout(this.signalLossTimeout);
            }

            // Set new signal loss timeout
            this.signalLossTimeout = setTimeout(() => {
              this.handleSignalLoss();
            }, this.signalLossThreshold);
          },
          (error) => {
            console.error('GPS error:', error);
            this.handleSignalLoss();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
      } catch (error) {
        console.error('Failed to get current position:', error);
      }
    }, this.recordingInterval);
  }

  /**
   * Stop recording GPS points
   */
  private stopRecording(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.signalLossTimeout) {
      clearTimeout(this.signalLossTimeout);
      this.signalLossTimeout = null;
    }
  }

  /**
   * Handle GPS signal loss
   */
  private async handleSignalLoss(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.signalLossCount++;
    this.emit('signalLost', this.currentSession);

    const event: SignalLossEvent = {
      id: uuid.v4().toString(),
      sessionId: this.currentSession.id,
      lossStartTime: new Date().toISOString(),
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
    };

    await this.storeSignalLossEventLocally(event);
  }

  /**
   * Store GPS point locally
   */
  private async storePointLocally(point: GPSPoint): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO gps_points (id, workoutId, latitude, longitude, elevation, accuracy, timestamp, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          point.id,
          point.workoutId,
          point.latitude,
          point.longitude,
          point.elevation || null,
          point.accuracy,
          point.timestamp,
          point.createdAt,
        ]
      );

      await this.queueForSync('create', point.id, 'GPS_POINT');
    } catch (error) {
      console.error('Failed to store point locally:', error);
    }
  }

  /**
   * Store session locally
   */
  private async storeSessionLocally(session: GPSTrackingSession): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO gps_sessions 
         (id, workoutId, startTime, endTime, totalDistance, averagePace, elevationGain, elevationLoss, pointCount, signalLossCount, isActive, createdAt, updatedAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          session.id,
          session.workoutId,
          session.startTime,
          session.endTime || null,
          session.totalDistance,
          session.averagePace,
          session.elevationGain,
          session.elevationLoss,
          session.pointCount,
          session.signalLossCount,
          session.isActive ? 1 : 0,
          session.createdAt,
          session.updatedAt,
        ]
      );

      await this.queueForSync('create', session.id, 'GPS_SESSION');
    } catch (error) {
      console.error('Failed to store session locally:', error);
    }
  }

  /**
   * Update session locally
   */
  private async updateSessionLocally(session: GPSTrackingSession): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `UPDATE gps_sessions 
         SET endTime = ?, totalDistance = ?, averagePace = ?, elevationGain = ?, elevationLoss = ?, 
             pointCount = ?, signalLossCount = ?, isActive = ?, updatedAt = ?
         WHERE id = ?`,
        [
          session.endTime || null,
          session.totalDistance,
          session.averagePace,
          session.elevationGain,
          session.elevationLoss,
          session.pointCount,
          session.signalLossCount,
          session.isActive ? 1 : 0,
          session.updatedAt,
          session.id,
        ]
      );

      await this.queueForSync('update', session.id, 'GPS_SESSION');
    } catch (error) {
      console.error('Failed to update session locally:', error);
    }
  }

  /**
   * Store signal loss event locally
   */
  private async storeSignalLossEventLocally(event: SignalLossEvent): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT INTO signal_loss_events (id, sessionId, lossStartTime, recoveryTime, durationSeconds, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          event.id,
          event.sessionId,
          event.lossStartTime,
          event.recoveryTime || null,
          event.durationSeconds,
          event.createdAt,
        ]
      );

      await this.queueForSync('create', event.id, 'SIGNAL_LOSS_EVENT');
    } catch (error) {
      console.error('Failed to store signal loss event locally:', error);
    }
  }

  /**
   * Queue operation for sync
   */
  private async queueForSync(operation: 'create' | 'update' | 'delete', entityId: string, entityType: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const syncItem = {
        id: uuid.v4().toString(),
        userId: this.userId,
        operation,
        entityType,
        entityId,
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
   * Subscribe to GPS events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from GPS events
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
   * Emit GPS events
   */
  private emit(event: string, data: any): void {
    if (!this.listeners.has(event)) {
      return;
    }
    this.listeners.get(event)!.forEach((callback) => callback(data));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.stopRecording();

    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
