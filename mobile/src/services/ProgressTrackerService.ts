import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  recordedAt: string;
  createdAt: string;
}

export interface VolumeData {
  id: string;
  userId: string;
  date: string;
  dailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
  createdAt: string;
}

export interface PRNotification {
  exerciseId: string;
  exerciseName: string;
  previousWeight: number;
  newWeight: number;
  reps: number;
  timestamp: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }>;
}

export interface FilterOptions {
  muscleGroup?: string;
  exerciseId?: string;
  startDate?: string;
  endDate?: string;
}

interface CacheEntry {
  data: PersonalRecord[] | VolumeData[];
  timestamp: number;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const DB_NAME = 'fitquest.db';
const PR_TABLE = 'personal_records';
const VOLUME_TABLE = 'volume_data';
const PR_NOTIFICATIONS_TABLE = 'pr_notifications';

export class ProgressTrackerService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string = '';
  private cache: Map<string, CacheEntry> = new Map();

  constructor(apiBaseUrl: string, userId: string) {
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
    });
    this.currentUserId = userId;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });

      // Create PR table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${PR_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          exerciseId TEXT NOT NULL,
          exerciseName TEXT NOT NULL,
          muscleGroup TEXT NOT NULL,
          weight INTEGER NOT NULL,
          reps INTEGER NOT NULL,
          recordedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          UNIQUE(userId, exerciseId)
        )
      `);

      // Create volume table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${VOLUME_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          date TEXT NOT NULL,
          dailyVolume INTEGER NOT NULL,
          weeklyVolume INTEGER NOT NULL,
          monthlyVolume INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          UNIQUE(userId, date)
        )
      `);

      // Create PR notifications table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${PR_NOTIFICATIONS_TABLE} (
          id TEXT PRIMARY KEY,
          exerciseId TEXT NOT NULL,
          exerciseName TEXT NOT NULL,
          previousWeight INTEGER NOT NULL,
          newWeight INTEGER NOT NULL,
          reps INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          read INTEGER DEFAULT 0
        )
      `);
    } catch (error) {
      console.error('Failed to initialize progress tracker database:', error);
    }
  }

  /**
   * Fetch personal records from backend API
   */
  async getPersonalRecords(filters?: FilterOptions): Promise<PersonalRecord[]> {
    try {
      const cacheKey = `prs_${JSON.stringify(filters || {})}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as PersonalRecord[];
      }

      const params: any = {};
      if (filters?.muscleGroup) params.muscleGroup = filters.muscleGroup;
      if (filters?.exerciseId) params.exerciseId = filters.exerciseId;

      const response = await this.apiClient.get<PersonalRecord[]>(
        `/progress/prs`,
        { params }
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cachePRsLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch personal records, using cached data:', error);
      return this.getPRsFromCache(filters);
    }
  }

  /**
   * Get PR for a specific exercise
   */
  async getExercisePR(exerciseId: string): Promise<PersonalRecord | null> {
    try {
      const response = await this.apiClient.get<PersonalRecord>(
        `/progress/prs/${exerciseId}`
      );
      return response.data;
    } catch (error) {
      console.warn(`Failed to fetch PR for exercise ${exerciseId}:`, error);
      return this.getExercisePRFromCache(exerciseId);
    }
  }

  /**
   * Detect new PRs and create notifications
   */
  async detectNewPRs(workoutData: {
    exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      muscleGroup: string;
      weight: number;
      reps: number;
    }>;
  }): Promise<PRNotification[]> {
    const newPRs: PRNotification[] = [];

    for (const exercise of workoutData.exercises) {
      const existingPR = await this.getExercisePR(exercise.exerciseId);

      if (!existingPR || exercise.weight > existingPR.weight) {
        const notification: PRNotification = {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          previousWeight: existingPR?.weight || 0,
          newWeight: exercise.weight,
          reps: exercise.reps,
          timestamp: new Date().toISOString(),
        };

        newPRs.push(notification);
        await this.storePRNotification(notification);
      }
    }

    return newPRs;
  }

  /**
   * Get pending PR notifications
   */
  async getPRNotifications(): Promise<PRNotification[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT exerciseId, exerciseName, previousWeight, newWeight, reps, timestamp 
         FROM ${PR_NOTIFICATIONS_TABLE} 
         WHERE read = 0 
         ORDER BY timestamp DESC`
      );

      const notifications: PRNotification[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        notifications.push(result[0].rows.item(i));
      }

      return notifications;
    } catch (error) {
      console.error('Failed to get PR notifications:', error);
      return [];
    }
  }

  /**
   * Mark PR notification as read
   */
  async markPRNotificationAsRead(exerciseId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `UPDATE ${PR_NOTIFICATIONS_TABLE} SET read = 1 WHERE exerciseId = ?`,
        [exerciseId]
      );
    } catch (error) {
      console.error('Failed to mark PR notification as read:', error);
    }
  }

  /**
   * Get volume data for date range
   */
  async getVolumeData(startDate: string, endDate: string): Promise<VolumeData[]> {
    try {
      const cacheKey = `volume_${startDate}_${endDate}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as VolumeData[];
      }

      const response = await this.apiClient.get<VolumeData[]>(
        `/progress/volume`,
        {
          params: {
            startDate,
            endDate,
          },
        }
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheVolumeLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch volume data, using cached data:', error);
      return this.getVolumeFromCache(startDate, endDate);
    }
  }

  /**
   * Get chart data for visualization
   */
  async getChartData(
    chartType: 'line' | 'bar' | 'pie',
    startDate: string,
    endDate: string,
    muscleGroup?: string
  ): Promise<ChartData> {
    try {
      const params: any = {
        startDate,
        endDate,
      };
      if (muscleGroup) params.muscleGroup = muscleGroup;

      const response = await this.apiClient.get<ChartData>(
        `/progress/charts/${chartType}`,
        { params }
      );

      return response.data;
    } catch (error) {
      console.warn(`Failed to fetch ${chartType} chart data:`, error);
      return this.generateChartDataLocally(chartType, startDate, endDate, muscleGroup);
    }
  }

  /**
   * Export chart as image
   */
  async exportChart(
    chartType: 'line' | 'bar' | 'pie',
    startDate: string,
    endDate: string,
    muscleGroup?: string
  ): Promise<string> {
    try {
      const params: any = {
        startDate,
        endDate,
        format: 'image',
      };
      if (muscleGroup) params.muscleGroup = muscleGroup;

      const response = await this.apiClient.get<{ imageUrl: string }>(
        `/progress/charts/${chartType}/export`,
        { params }
      );

      return response.data.imageUrl;
    } catch (error) {
      console.warn(`Failed to export ${chartType} chart:`, error);
      throw error;
    }
  }

  /**
   * Get PR history with filtering
   */
  async getPRHistory(filters?: FilterOptions): Promise<PersonalRecord[]> {
    const prs = await this.getPersonalRecords(filters);
    return prs.sort((a, b) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }

  /**
   * Cache PRs locally
   */
  private async cachePRsLocally(prs: PersonalRecord[]): Promise<void> {
    if (!this.db) return;

    try {
      // Clear old PRs for this user
      await this.db.executeSql(
        `DELETE FROM ${PR_TABLE} WHERE userId = ?`,
        [this.currentUserId]
      );

      // Insert new PRs
      for (const pr of prs) {
        await this.db.executeSql(
          `INSERT INTO ${PR_TABLE} 
           (id, userId, exerciseId, exerciseName, muscleGroup, weight, reps, recordedAt, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pr.id,
            pr.userId,
            pr.exerciseId,
            pr.exerciseName,
            pr.muscleGroup,
            pr.weight,
            pr.reps,
            pr.recordedAt,
            pr.createdAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache PRs locally:', error);
    }
  }

  /**
   * Get PRs from local cache
   */
  private async getPRsFromCache(filters?: FilterOptions): Promise<PersonalRecord[]> {
    if (!this.db) return [];

    try {
      let query = `SELECT * FROM ${PR_TABLE} WHERE userId = ?`;
      const params: any[] = [this.currentUserId];

      if (filters?.muscleGroup) {
        query += ` AND muscleGroup = ?`;
        params.push(filters.muscleGroup);
      }

      if (filters?.exerciseId) {
        query += ` AND exerciseId = ?`;
        params.push(filters.exerciseId);
      }

      query += ` ORDER BY recordedAt DESC`;

      const result = await this.db.executeSql(query, params);

      const prs: PersonalRecord[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        prs.push(result[0].rows.item(i));
      }

      return prs;
    } catch (error) {
      console.error('Failed to get PRs from cache:', error);
      return [];
    }
  }

  /**
   * Get specific exercise PR from cache
   */
  private async getExercisePRFromCache(exerciseId: string): Promise<PersonalRecord | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${PR_TABLE} WHERE userId = ? AND exerciseId = ?`,
        [this.currentUserId, exerciseId]
      );

      if (result[0].rows.length === 0) return null;
      return result[0].rows.item(0);
    } catch (error) {
      console.error('Failed to get exercise PR from cache:', error);
      return null;
    }
  }

  /**
   * Cache volume data locally
   */
  private async cacheVolumeLocally(volumeData: VolumeData[]): Promise<void> {
    if (!this.db) return;

    try {
      for (const volume of volumeData) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${VOLUME_TABLE} 
           (id, userId, date, dailyVolume, weeklyVolume, monthlyVolume, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            volume.id,
            volume.userId,
            volume.date,
            volume.dailyVolume,
            volume.weeklyVolume,
            volume.monthlyVolume,
            volume.createdAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache volume data locally:', error);
    }
  }

  /**
   * Get volume data from local cache
   */
  private async getVolumeFromCache(startDate: string, endDate: string): Promise<VolumeData[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${VOLUME_TABLE} 
         WHERE userId = ? AND date >= ? AND date <= ? 
         ORDER BY date ASC`,
        [this.currentUserId, startDate, endDate]
      );

      const volumes: VolumeData[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        volumes.push(result[0].rows.item(i));
      }

      return volumes;
    } catch (error) {
      console.error('Failed to get volume data from cache:', error);
      return [];
    }
  }

  /**
   * Store PR notification locally
   */
  private async storePRNotification(notification: PRNotification): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT INTO ${PR_NOTIFICATIONS_TABLE} 
         (id, exerciseId, exerciseName, previousWeight, newWeight, reps, timestamp, read) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          uuid.v4(),
          notification.exerciseId,
          notification.exerciseName,
          notification.previousWeight,
          notification.newWeight,
          notification.reps,
          notification.timestamp,
        ]
      );
    } catch (error) {
      console.error('Failed to store PR notification:', error);
    }
  }

  /**
   * Generate chart data from local cache
   */
  private async generateChartDataLocally(
    chartType: 'line' | 'bar' | 'pie',
    startDate: string,
    endDate: string,
    muscleGroup?: string
  ): Promise<ChartData> {
    const volumeData = await this.getVolumeFromCache(startDate, endDate);
    const prs = await this.getPRsFromCache({ muscleGroup });

    if (chartType === 'line') {
      return {
        type: 'line',
        labels: volumeData.map(v => v.date),
        datasets: [
          {
            label: 'Daily Volume',
            data: volumeData.map(v => v.dailyVolume),
            borderColor: '#3B82F6',
          },
        ],
      };
    } else if (chartType === 'bar') {
      const muscleGroupVolume: { [key: string]: number } = {};
      prs.forEach(pr => {
        muscleGroupVolume[pr.muscleGroup] = (muscleGroupVolume[pr.muscleGroup] || 0) + pr.weight;
      });

      return {
        type: 'bar',
        labels: Object.keys(muscleGroupVolume),
        datasets: [
          {
            label: 'Volume by Muscle Group',
            data: Object.values(muscleGroupVolume),
            backgroundColor: '#10B981',
          },
        ],
      };
    } else {
      const muscleGroupVolume: { [key: string]: number } = {};
      prs.forEach(pr => {
        muscleGroupVolume[pr.muscleGroup] = (muscleGroupVolume[pr.muscleGroup] || 0) + pr.weight;
      });

      return {
        type: 'pie',
        labels: Object.keys(muscleGroupVolume),
        datasets: [
          {
            label: 'Exercise Distribution',
            data: Object.values(muscleGroupVolume),
            backgroundColor: ['#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
          },
        ],
      };
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${PR_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${VOLUME_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${PR_NOTIFICATIONS_TABLE}`);
    } catch (error) {
      console.error('Failed to clear progress tracker cache:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
      } catch (error) {
        console.error('Failed to close progress tracker database:', error);
      }
    }
  }
}
