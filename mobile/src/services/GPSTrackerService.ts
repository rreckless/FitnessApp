import uuid from 'react-native-uuid';
import DatabaseManager from '../database/DatabaseManager';

const uuidv4 = uuid.v4;

export interface GPSCoordinate {
  id: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  accuracy: number | null;
  timestamp: string;
}

export interface GPSTrackingSession {
  id: string;
  startTime: string;
  endTime: string | null;
  coordinates: GPSCoordinate[];
  distance: number; // miles
  pace: number; // minutes per mile
  elevationGain: number; // feet
  elevationLoss: number; // feet
  isActive: boolean;
  signalLost: boolean;
  lastSignalTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GPSStats {
  totalDistance: number;
  averagePace: number;
  elevationGain: number;
  elevationLoss: number;
  duration: number; // seconds
}

export class GPSTrackerService {
  private static instance: GPSTrackerService;
  private currentSession: GPSTrackingSession | null = null;
  private listeners: Set<(session: GPSTrackingSession | null) => void> = new Set();
  private lastCoordinate: GPSCoordinate | null = null;

  private constructor() {}

  static getInstance(): GPSTrackerService {
    if (!GPSTrackerService.instance) {
      GPSTrackerService.instance = new GPSTrackerService();
    }
    return GPSTrackerService.instance;
  }

  /**
   * Start GPS tracking session
   */
  async startTracking(): Promise<GPSTrackingSession> {
    const now = new Date().toISOString();
    const session: GPSTrackingSession = {
      id: uuidv4() as string,
      startTime: now,
      endTime: null,
      coordinates: [],
      distance: 0,
      pace: 0,
      elevationGain: 0,
      elevationLoss: 0,
      isActive: true,
      signalLost: false,
      lastSignalTime: now,
      createdAt: now,
      updatedAt: now,
    };

    this.currentSession = session;
    await this.saveSession(session);
    this.notifyListeners();

    return session;
  }

  /**
   * Record GPS coordinate
   * Records every 10 seconds or when distance changes by 10 meters
   */
  async recordCoordinate(
    latitude: number,
    longitude: number,
    elevation?: number,
    accuracy?: number
  ): Promise<GPSCoordinate | null> {
    if (!this.currentSession) {
      return null;
    }

    // Check if we should record this coordinate
    if (this.lastCoordinate) {
      const distance = this.calculateDistance(
        this.lastCoordinate.latitude,
        this.lastCoordinate.longitude,
        latitude,
        longitude
      );

      // Only record if distance > 10 meters (0.0062 miles)
      if (distance < 0.0062) {
        return null;
      }
    }

    const coordinate: GPSCoordinate = {
      id: uuidv4() as string,
      latitude,
      longitude,
      elevation: elevation || null,
      accuracy: accuracy || null,
      timestamp: new Date().toISOString(),
    };

    this.currentSession.coordinates.push(coordinate);
    this.lastCoordinate = coordinate;
    this.currentSession.lastSignalTime = coordinate.timestamp;
    this.currentSession.signalLost = false;

    // Recalculate stats
    await this.recalculateStats();
    await this.saveSession(this.currentSession);
    this.notifyListeners();

    return coordinate;
  }

  /**
   * Handle GPS signal loss
   */
  async handleSignalLoss(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.signalLost = true;
    await this.saveSession(this.currentSession);
    this.notifyListeners();
  }

  /**
   * Handle GPS signal recovery
   */
  async handleSignalRecovery(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.signalLost = false;
    this.currentSession.lastSignalTime = new Date().toISOString();
    await this.saveSession(this.currentSession);
    this.notifyListeners();
  }

  /**
   * End GPS tracking session
   */
  async endTracking(): Promise<GPSTrackingSession | null> {
    if (!this.currentSession) {
      return null;
    }

    const now = new Date().toISOString();
    this.currentSession.endTime = now;
    this.currentSession.isActive = false;
    this.currentSession.updatedAt = now;

    await this.saveSession(this.currentSession);
    const session = this.currentSession;
    this.currentSession = null;
    this.lastCoordinate = null;
    this.notifyListeners();

    return session;
  }

  /**
   * Get current tracking session
   */
  getCurrentSession(): GPSTrackingSession | null {
    return this.currentSession;
  }

  /**
   * Subscribe to session changes
   */
  subscribe(listener: (session: GPSTrackingSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get tracking history
   */
  async getTrackingHistory(limit: number = 50): Promise<GPSTrackingSession[]> {
    try {
      const sql = `
        SELECT * FROM gps_sessions
        ORDER BY startTime DESC
        LIMIT ?
      `;
      const result = await DatabaseManager.executeSql(sql, [limit]);
      return result.rows.raw() as GPSTrackingSession[];
    } catch (error) {
      console.error('Failed to get tracking history:', error);
      return [];
    }
  }

  /**
   * Get session details with coordinates
   */
  async getSessionDetails(sessionId: string): Promise<GPSTrackingSession | null> {
    try {
      const sql = `
        SELECT * FROM gps_sessions
        WHERE id = ?
      `;
      const result = await DatabaseManager.executeSql(sql, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows.raw()[0] as GPSTrackingSession;

      // Get coordinates
      const coordSql = `
        SELECT * FROM gps_coordinates
        WHERE sessionId = ?
        ORDER BY timestamp ASC
      `;
      const coordResult = await DatabaseManager.executeSql(coordSql, [sessionId]);
      session.coordinates = coordResult.rows.raw() as GPSCoordinate[];

      return session;
    } catch (error) {
      console.error('Failed to get session details:', error);
      return null;
    }
  }

  // MARK: - Private Methods

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private async recalculateStats(): Promise<void> {
    if (!this.currentSession || this.currentSession.coordinates.length < 2) {
      return;
    }

    const coords = this.currentSession.coordinates;
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;

    // Calculate distance and elevation
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];

      totalDistance += this.calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);

      if (prev.elevation && curr.elevation) {
        const elevationChange = curr.elevation - prev.elevation;
        if (elevationChange > 0) {
          elevationGain += elevationChange;
        } else {
          elevationLoss += Math.abs(elevationChange);
        }
      }
    }

    // Calculate pace
    const startTime = new Date(this.currentSession.startTime).getTime();
    const endTime = new Date(coords[coords.length - 1].timestamp).getTime();
    const durationMinutes = (endTime - startTime) / 60000;
    const pace = totalDistance > 0 ? durationMinutes / totalDistance : 0;

    this.currentSession.distance = totalDistance;
    this.currentSession.pace = pace;
    this.currentSession.elevationGain = elevationGain;
    this.currentSession.elevationLoss = elevationLoss;
  }

  private async saveSession(session: GPSTrackingSession): Promise<void> {
    try {
      const sql = `
        INSERT OR REPLACE INTO gps_sessions
        (id, startTime, endTime, distance, pace, elevationGain, elevationLoss, isActive, signalLost, lastSignalTime, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await DatabaseManager.executeSql(sql, [
        session.id,
        session.startTime,
        session.endTime,
        session.distance,
        session.pace,
        session.elevationGain,
        session.elevationLoss,
        session.isActive ? 1 : 0,
        session.signalLost ? 1 : 0,
        session.lastSignalTime,
        session.createdAt,
        session.updatedAt,
      ]);

      // Save coordinates
      for (const coord of session.coordinates) {
        const coordSql = `
          INSERT OR REPLACE INTO gps_coordinates
          (id, sessionId, latitude, longitude, elevation, accuracy, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await DatabaseManager.executeSql(coordSql, [
          coord.id,
          session.id,
          coord.latitude,
          coord.longitude,
          coord.elevation,
          coord.accuracy,
          coord.timestamp,
        ]);
      }
    } catch (error) {
      console.error('Failed to save GPS session:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.currentSession);
    });
  }
}

export default GPSTrackerService.getInstance();
