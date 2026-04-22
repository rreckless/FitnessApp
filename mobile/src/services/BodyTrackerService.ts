import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export interface WeightEntry {
  id: string;
  userId: string;
  weight: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementEntry {
  id: string;
  userId: string;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  notes?: string;
  recordedAt: string;
  createdAt: string;
}

export interface WeightTrendData {
  date: string;
  weight: number;
  trendValue?: number;
}

export interface MeasurementChange {
  measurement: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface PhotoComparison {
  beforePhoto: ProgressPhoto;
  afterPhoto: ProgressPhoto;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const DB_NAME = 'fitquest.db';
const WEIGHT_TABLE = 'body_weight';
const MEASUREMENT_TABLE = 'body_measurements';
const PHOTO_TABLE = 'progress_photos';
const SYNC_QUEUE_TABLE = 'body_tracker_sync_queue';
const EDIT_WINDOW_DAYS = 7;

export class BodyTrackerService {
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

      // Create weight table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${WEIGHT_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          weight REAL NOT NULL,
          notes TEXT,
          recordedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      // Create measurement table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${MEASUREMENT_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          chest REAL,
          waist REAL,
          hips REAL,
          arms REAL,
          thighs REAL,
          notes TEXT,
          recordedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      // Create photo table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${PHOTO_TABLE} (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          imageUrl TEXT NOT NULL,
          thumbnailUrl TEXT,
          notes TEXT,
          recordedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      // Create sync queue table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${SYNC_QUEUE_TABLE} (
          id TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          entityType TEXT NOT NULL,
          entityId TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          createdAt TEXT NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to initialize body tracker database:', error);
    }
  }

  /**
   * Log a weight entry
   */
  async logWeight(weight: number, notes?: string): Promise<WeightEntry> {
    const entry: WeightEntry = {
      id: uuid.v4() as string,
      userId: this.currentUserId,
      weight,
      notes,
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store locally first
    await this.storeWeightLocally(entry);

    // Try to sync to backend
    try {
      const response = await this.apiClient.post<WeightEntry>('/body/weight', entry);
      await this.markWeightAsSynced(entry.id);
      return response.data;
    } catch (error) {
      console.warn('Failed to sync weight entry, queued for later:', error);
      await this.queueForSync('CREATE', 'WEIGHT', entry.id, entry);
      return entry;
    }
  }

  /**
   * Get weight history
   */
  async getWeightHistory(startDate?: string, endDate?: string): Promise<WeightEntry[]> {
    try {
      const cacheKey = `weight_history_${startDate}_${endDate}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as WeightEntry[];
      }

      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await this.apiClient.get<WeightEntry[]>('/body/weight', { params });
      const data = response.data;

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      await this.cacheWeightLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch weight history, using cached data:', error);
      return this.getWeightFromCache(startDate, endDate);
    }
  }

  /**
   * Get weight trend data with trend line
   */
  async getWeightTrend(days: number = 30): Promise<WeightTrendData[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const entries = await this.getWeightHistory(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const trendData = entries.map(entry => ({
      date: entry.recordedAt.split('T')[0],
      weight: entry.weight,
    }));

    // Calculate trend line using simple moving average
    const trendLine = this.calculateTrendLine(trendData);

    return trendLine;
  }

  /**
   * Edit weight entry (within 7 days)
   */
  async editWeight(id: string, weight: number, notes?: string): Promise<WeightEntry> {
    const entry = await this.getWeightById(id);
    if (!entry) throw new Error('Weight entry not found');

    const createdDate = new Date(entry.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > EDIT_WINDOW_DAYS) {
      throw new Error(`Cannot edit weight entry older than ${EDIT_WINDOW_DAYS} days`);
    }

    const updated: WeightEntry = {
      ...entry,
      weight,
      notes,
      updatedAt: new Date().toISOString(),
    };

    await this.updateWeightLocally(updated);

    try {
      const response = await this.apiClient.put<WeightEntry>(`/body/weight/${id}`, updated);
      await this.markWeightAsSynced(id);
      return response.data;
    } catch (error) {
      console.warn('Failed to sync weight update, queued for later:', error);
      await this.queueForSync('UPDATE', 'WEIGHT', id, updated);
      return updated;
    }
  }

  /**
   * Delete weight entry (within 7 days)
   */
  async deleteWeight(id: string): Promise<void> {
    const entry = await this.getWeightById(id);
    if (!entry) throw new Error('Weight entry not found');

    const createdDate = new Date(entry.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > EDIT_WINDOW_DAYS) {
      throw new Error(`Cannot delete weight entry older than ${EDIT_WINDOW_DAYS} days`);
    }

    await this.deleteWeightLocally(id);

    try {
      await this.apiClient.delete(`/body/weight/${id}`);
    } catch (error) {
      console.warn('Failed to sync weight deletion, queued for later:', error);
      await this.queueForSync('DELETE', 'WEIGHT', id, {});
    }
  }

  private async getWeightById(id: string): Promise<WeightEntry | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${WEIGHT_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );

      if (result[0].rows.length === 0) return null;
      return result[0].rows.item(0);
    } catch (error) {
      console.error('Failed to get weight by id:', error);
      return null;
    }
  }

  private async storeWeightLocally(entry: WeightEntry): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT INTO ${WEIGHT_TABLE} 
         (id, userId, weight, notes, recordedAt, createdAt, updatedAt, synced) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          entry.id,
          entry.userId,
          entry.weight,
          entry.notes || null,
          entry.recordedAt,
          entry.createdAt,
          entry.updatedAt,
        ]
      );
    } catch (error) {
      console.error('Failed to store weight locally:', error);
    }
  }

  private async updateWeightLocally(entry: WeightEntry): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `UPDATE ${WEIGHT_TABLE} SET weight = ?, notes = ?, updatedAt = ?, synced = 0 WHERE id = ?`,
        [entry.weight, entry.notes || null, entry.updatedAt, entry.id]
      );
    } catch (error) {
      console.error('Failed to update weight locally:', error);
    }
  }

  private async deleteWeightLocally(id: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${WEIGHT_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );
    } catch (error) {
      console.error('Failed to delete weight locally:', error);
    }
  }

  private async cacheWeightLocally(entries: WeightEntry[]): Promise<void> {
    if (!this.db) return;

    try {
      for (const entry of entries) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${WEIGHT_TABLE} 
           (id, userId, weight, notes, recordedAt, createdAt, updatedAt, synced) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            entry.id,
            entry.userId,
            entry.weight,
            entry.notes || null,
            entry.recordedAt,
            entry.createdAt,
            entry.updatedAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache weight locally:', error);
    }
  }

  private async getWeightFromCache(startDate?: string, endDate?: string): Promise<WeightEntry[]> {
    if (!this.db) return [];

    try {
      let query = `SELECT * FROM ${WEIGHT_TABLE} WHERE userId = ?`;
      const params: any[] = [this.currentUserId];

      if (startDate) {
        query += ` AND recordedAt >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND recordedAt <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY recordedAt DESC`;

      const result = await this.db.executeSql(query, params);

      const entries: WeightEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        entries.push(result[0].rows.item(i));
      }

      return entries;
    } catch (error) {
      console.error('Failed to get weight from cache:', error);
      return [];
    }
  }

  private async markWeightAsSynced(id: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `UPDATE ${WEIGHT_TABLE} SET synced = 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Failed to mark weight as synced:', error);
    }
  }

  /**
   * Log a measurement entry
   */
  async logMeasurement(
    chest?: number,
    waist?: number,
    hips?: number,
    arms?: number,
    thighs?: number,
    notes?: string
  ): Promise<MeasurementEntry> {
    const entry: MeasurementEntry = {
      id: uuid.v4() as string,
      userId: this.currentUserId,
      chest,
      waist,
      hips,
      arms,
      thighs,
      notes,
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storeMeasurementLocally(entry);

    try {
      const response = await this.apiClient.post<MeasurementEntry>('/body/measurements', entry);
      await this.markMeasurementAsSynced(entry.id);
      return response.data;
    } catch (error) {
      console.warn('Failed to sync measurement entry, queued for later:', error);
      await this.queueForSync('CREATE', 'MEASUREMENT', entry.id, entry);
      return entry;
    }
  }

  /**
   * Get measurement history
   */
  async getMeasurementHistory(startDate?: string, endDate?: string): Promise<MeasurementEntry[]> {
    try {
      const cacheKey = `measurement_history_${startDate}_${endDate}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as MeasurementEntry[];
      }

      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await this.apiClient.get<MeasurementEntry[]>('/body/measurements', { params });
      const data = response.data;

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      await this.cacheMeasurementLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch measurement history, using cached data:', error);
      return this.getMeasurementFromCache(startDate, endDate);
    }
  }

  /**
   * Get measurement changes (current vs previous)
   */
  async getMeasurementChanges(): Promise<MeasurementChange[]> {
    const entries = await this.getMeasurementHistory();
    if (entries.length < 2) return [];

    const latest = entries[0];
    const previous = entries[1];

    const changes: MeasurementChange[] = [];

    const measurements = [
      { key: 'chest', label: 'Chest' },
      { key: 'waist', label: 'Waist' },
      { key: 'hips', label: 'Hips' },
      { key: 'arms', label: 'Arms' },
      { key: 'thighs', label: 'Thighs' },
    ];

    for (const m of measurements) {
      const currentVal = latest[m.key as keyof MeasurementEntry] as number | undefined;
      const previousVal = previous[m.key as keyof MeasurementEntry] as number | undefined;

      if (currentVal !== undefined && previousVal !== undefined) {
        const change = currentVal - previousVal;
        const changePercent = (change / previousVal) * 100;

        changes.push({
          measurement: m.label,
          current: currentVal,
          previous: previousVal,
          change,
          changePercent,
        });
      }
    }

    return changes;
  }

  /**
   * Edit measurement entry (within 7 days)
   */
  async editMeasurement(
    id: string,
    chest?: number,
    waist?: number,
    hips?: number,
    arms?: number,
    thighs?: number,
    notes?: string
  ): Promise<MeasurementEntry> {
    const entry = await this.getMeasurementById(id);
    if (!entry) throw new Error('Measurement entry not found');

    const createdDate = new Date(entry.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > EDIT_WINDOW_DAYS) {
      throw new Error(`Cannot edit measurement entry older than ${EDIT_WINDOW_DAYS} days`);
    }

    const updated: MeasurementEntry = {
      ...entry,
      chest: chest !== undefined ? chest : entry.chest,
      waist: waist !== undefined ? waist : entry.waist,
      hips: hips !== undefined ? hips : entry.hips,
      arms: arms !== undefined ? arms : entry.arms,
      thighs: thighs !== undefined ? thighs : entry.thighs,
      notes,
      updatedAt: new Date().toISOString(),
    };

    await this.updateMeasurementLocally(updated);

    try {
      const response = await this.apiClient.put<MeasurementEntry>(`/body/measurements/${id}`, updated);
      await this.markMeasurementAsSynced(id);
      return response.data;
    } catch (error) {
      console.warn('Failed to sync measurement update, queued for later:', error);
      await this.queueForSync('UPDATE', 'MEASUREMENT', id, updated);
      return updated;
    }
  }

  /**
   * Delete measurement entry (within 7 days)
   */
  async deleteMeasurement(id: string): Promise<void> {
    const entry = await this.getMeasurementById(id);
    if (!entry) throw new Error('Measurement entry not found');

    const createdDate = new Date(entry.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > EDIT_WINDOW_DAYS) {
      throw new Error(`Cannot delete measurement entry older than ${EDIT_WINDOW_DAYS} days`);
    }

    await this.deleteMeasurementLocally(id);

    try {
      await this.apiClient.delete(`/body/measurements/${id}`);
    } catch (error) {
      console.warn('Failed to sync measurement deletion, queued for later:', error);
      await this.queueForSync('DELETE', 'MEASUREMENT', id, {});
    }
  }

  private async getMeasurementById(id: string): Promise<MeasurementEntry | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${MEASUREMENT_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );

      if (result[0].rows.length === 0) return null;
      return result[0].rows.item(0);
    } catch (error) {
      console.error('Failed to get measurement by id:', error);
      return null;
    }
  }

  private async storeMeasurementLocally(entry: MeasurementEntry): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT INTO ${MEASUREMENT_TABLE} 
         (id, userId, chest, waist, hips, arms, thighs, notes, recordedAt, createdAt, updatedAt, synced) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          entry.id,
          entry.userId,
          entry.chest || null,
          entry.waist || null,
          entry.hips || null,
          entry.arms || null,
          entry.thighs || null,
          entry.notes || null,
          entry.recordedAt,
          entry.createdAt,
          entry.updatedAt,
        ]
      );
    } catch (error) {
      console.error('Failed to store measurement locally:', error);
    }
  }

  private async updateMeasurementLocally(entry: MeasurementEntry): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `UPDATE ${MEASUREMENT_TABLE} 
         SET chest = ?, waist = ?, hips = ?, arms = ?, thighs = ?, notes = ?, updatedAt = ?, synced = 0 
         WHERE id = ?`,
        [
          entry.chest || null,
          entry.waist || null,
          entry.hips || null,
          entry.arms || null,
          entry.thighs || null,
          entry.notes || null,
          entry.updatedAt,
          entry.id,
        ]
      );
    } catch (error) {
      console.error('Failed to update measurement locally:', error);
    }
  }

  private async deleteMeasurementLocally(id: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${MEASUREMENT_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );
    } catch (error) {
      console.error('Failed to delete measurement locally:', error);
    }
  }

  private async cacheMeasurementLocally(entries: MeasurementEntry[]): Promise<void> {
    if (!this.db) return;

    try {
      for (const entry of entries) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${MEASUREMENT_TABLE} 
           (id, userId, chest, waist, hips, arms, thighs, notes, recordedAt, createdAt, updatedAt, synced) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            entry.id,
            entry.userId,
            entry.chest || null,
            entry.waist || null,
            entry.hips || null,
            entry.arms || null,
            entry.thighs || null,
            entry.notes || null,
            entry.recordedAt,
            entry.createdAt,
            entry.updatedAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache measurement locally:', error);
    }
  }

  private async getMeasurementFromCache(startDate?: string, endDate?: string): Promise<MeasurementEntry[]> {
    if (!this.db) return [];

    try {
      let query = `SELECT * FROM ${MEASUREMENT_TABLE} WHERE userId = ?`;
      const params: any[] = [this.currentUserId];

      if (startDate) {
        query += ` AND recordedAt >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND recordedAt <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY recordedAt DESC`;

      const result = await this.db.executeSql(query, params);

      const entries: MeasurementEntry[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        entries.push(result[0].rows.item(i));
      }

      return entries;
    } catch (error) {
      console.error('Failed to get measurement from cache:', error);
      return [];
    }
  }

  private async markMeasurementAsSynced(id: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `UPDATE ${MEASUREMENT_TABLE} SET synced = 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Failed to mark measurement as synced:', error);
    }
  }

  /**
   * Upload a progress photo
   */
  async uploadPhoto(imageUri: string, notes?: string): Promise<ProgressPhoto> {
    try {
      // Compress image before upload
      const compressedUri = await this.compressImage(imageUri);

      const formData = new FormData();
      formData.append('file', {
        uri: compressedUri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      } as any);
      formData.append('notes', notes || '');

      const response = await this.apiClient.post<ProgressPhoto>(
        '/body/photos',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const photo = response.data;
      await this.storePhotoLocally(photo);
      return photo;
    } catch (error) {
      console.warn('Failed to upload photo, queued for later:', error);
      // Store locally for later sync
      const photo: ProgressPhoto = {
        id: uuid.v4() as string,
        userId: this.currentUserId,
        imageUrl: imageUri,
        notes,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await this.storePhotoLocally(photo);
      await this.queueForSync('CREATE', 'PHOTO', photo.id, photo);
      return photo;
    }
  }

  /**
   * Get photo gallery
   */
  async getPhotoGallery(limit: number = 50, offset: number = 0): Promise<ProgressPhoto[]> {
    try {
      const cacheKey = `photo_gallery_${limit}_${offset}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as ProgressPhoto[];
      }

      const response = await this.apiClient.get<ProgressPhoto[]>('/body/photos', {
        params: { limit, offset },
      });

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      await this.cachePhotoLocally(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch photo gallery, using cached data:', error);
      return this.getPhotoFromCache(limit, offset);
    }
  }

  /**
   * Compare two photos side-by-side
   */
  async comparePhotos(beforePhotoId: string, afterPhotoId: string): Promise<PhotoComparison> {
    const beforePhoto = await this.getPhotoById(beforePhotoId);
    const afterPhoto = await this.getPhotoById(afterPhotoId);

    if (!beforePhoto || !afterPhoto) {
      throw new Error('One or both photos not found');
    }

    return {
      beforePhoto,
      afterPhoto,
    };
  }

  /**
   * Delete a progress photo
   */
  async deletePhoto(id: string): Promise<void> {
    await this.deletePhotoLocally(id);

    try {
      await this.apiClient.delete(`/body/photos/${id}`);
    } catch (error) {
      console.warn('Failed to sync photo deletion, queued for later:', error);
      await this.queueForSync('DELETE', 'PHOTO', id, {});
    }
  }

  private async getPhotoById(id: string): Promise<ProgressPhoto | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${PHOTO_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );

      if (result[0].rows.length === 0) return null;
      return result[0].rows.item(0);
    } catch (error) {
      console.error('Failed to get photo by id:', error);
      return null;
    }
  }

  private async storePhotoLocally(photo: ProgressPhoto): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${PHOTO_TABLE} 
         (id, userId, imageUrl, thumbnailUrl, notes, recordedAt, createdAt, synced) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          photo.id,
          photo.userId,
          photo.imageUrl,
          photo.thumbnailUrl || null,
          photo.notes || null,
          photo.recordedAt,
          photo.createdAt,
        ]
      );
    } catch (error) {
      console.error('Failed to store photo locally:', error);
    }
  }

  private async deletePhotoLocally(id: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `DELETE FROM ${PHOTO_TABLE} WHERE id = ? AND userId = ?`,
        [id, this.currentUserId]
      );
    } catch (error) {
      console.error('Failed to delete photo locally:', error);
    }
  }

  private async cachePhotoLocally(photos: ProgressPhoto[]): Promise<void> {
    if (!this.db) return;

    try {
      for (const photo of photos) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${PHOTO_TABLE} 
           (id, userId, imageUrl, thumbnailUrl, notes, recordedAt, createdAt, synced) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            photo.id,
            photo.userId,
            photo.imageUrl,
            photo.thumbnailUrl || null,
            photo.notes || null,
            photo.recordedAt,
            photo.createdAt,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache photos locally:', error);
    }
  }

  private async getPhotoFromCache(limit: number, offset: number): Promise<ProgressPhoto[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${PHOTO_TABLE} 
         WHERE userId = ? 
         ORDER BY recordedAt DESC 
         LIMIT ? OFFSET ?`,
        [this.currentUserId, limit, offset]
      );

      const photos: ProgressPhoto[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        photos.push(result[0].rows.item(i));
      }

      return photos;
    } catch (error) {
      console.error('Failed to get photos from cache:', error);
      return [];
    }
  }

  private async compressImage(imageUri: string): Promise<string> {
    // In a real implementation, this would use react-native-image-resizer or similar
    // For now, we'll just return the original URI
    // The backend will handle compression to max 5MB
    return imageUri;
  }

  /**
   * Queue an operation for sync
   */
  private async queueForSync(
    operation: string,
    entityType: string,
    entityId: string,
    payload: any
  ): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        `INSERT INTO ${SYNC_QUEUE_TABLE} 
         (id, operation, entityType, entityId, payload, status, createdAt) 
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
        [
          uuid.v4(),
          operation,
          entityType,
          entityId,
          JSON.stringify(payload),
          new Date().toISOString(),
        ]
      );
    } catch (error) {
      console.error('Failed to queue operation for sync:', error);
    }
  }

  /**
   * Sync pending operations with backend
   */
  async syncPendingOperations(): Promise<void> {
    if (!this.db) return;

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM ${SYNC_QUEUE_TABLE} WHERE status = 'PENDING' ORDER BY createdAt ASC`
      );

      for (let i = 0; i < result[0].rows.length; i++) {
        const item = result[0].rows.item(i);
        await this.processSyncItem(item);
      }
    } catch (error) {
      console.error('Failed to sync pending operations:', error);
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    if (!this.db) return;

    try {
      const payload = JSON.parse(item.payload);

      if (item.operation === 'CREATE') {
        if (item.entityType === 'WEIGHT') {
          await this.apiClient.post('/body/weight', payload);
          await this.markWeightAsSynced(item.entityId);
        } else if (item.entityType === 'MEASUREMENT') {
          await this.apiClient.post('/body/measurements', payload);
          await this.markMeasurementAsSynced(item.entityId);
        } else if (item.entityType === 'PHOTO') {
          // Photos are handled separately due to file upload
          console.warn('Photo sync not implemented in processSyncItem');
        }
      } else if (item.operation === 'UPDATE') {
        if (item.entityType === 'WEIGHT') {
          await this.apiClient.put(`/body/weight/${item.entityId}`, payload);
          await this.markWeightAsSynced(item.entityId);
        } else if (item.entityType === 'MEASUREMENT') {
          await this.apiClient.put(`/body/measurements/${item.entityId}`, payload);
          await this.markMeasurementAsSynced(item.entityId);
        }
      } else if (item.operation === 'DELETE') {
        if (item.entityType === 'WEIGHT') {
          await this.apiClient.delete(`/body/weight/${item.entityId}`);
        } else if (item.entityType === 'MEASUREMENT') {
          await this.apiClient.delete(`/body/measurements/${item.entityId}`);
        } else if (item.entityType === 'PHOTO') {
          await this.apiClient.delete(`/body/photos/${item.entityId}`);
        }
      }

      // Mark as synced
      await this.db.executeSql(
        `UPDATE ${SYNC_QUEUE_TABLE} SET status = 'SYNCED' WHERE id = ?`,
        [item.id]
      );
    } catch (error) {
      console.error('Failed to process sync item:', error);
      // Increment retry count or mark as failed
      await this.db.executeSql(
        `UPDATE ${SYNC_QUEUE_TABLE} SET status = 'FAILED' WHERE id = ?`,
        [item.id]
      );
    }
  }

  /**
   * Calculate trend line using simple moving average
   */
  private calculateTrendLine(data: Array<{ date: string; weight: number }>): WeightTrendData[] {
    if (data.length === 0) return [];

    const windowSize = Math.min(7, Math.floor(data.length / 3)); // 7-day moving average
    const result: WeightTrendData[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const average = window.reduce((sum, d) => sum + d.weight, 0) / window.length;

      result.push({
        date: data[i].date,
        weight: data[i].weight,
        trendValue: average,
      });
    }

    return result;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${WEIGHT_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${MEASUREMENT_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${PHOTO_TABLE}`);
    } catch (error) {
      console.error('Failed to clear body tracker cache:', error);
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
        console.error('Failed to close body tracker database:', error);
      }
    }
  }
}
