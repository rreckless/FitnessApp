import axios from 'axios';
import { AuthenticationService } from './AuthenticationService';
import { SyncEngine } from './SyncEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import Config from '../config/Config';

// MARK: - Types

export interface BodyWeight {
  id: string;
  weight: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurement {
  id: string;
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

export interface TrendLine {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

export interface MeasurementChange {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
}

export interface ProgressPhoto {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

// MARK: - BodyTrackerService

export class BodyTrackerService {
  private static instance: BodyTrackerService;
  private authService: AuthenticationService;
  private syncEngine: SyncEngine;
  private dbManager: DatabaseManager;
  private apiClient: any;

  private constructor() {
    this.authService = AuthenticationService.getInstance();
    this.syncEngine = SyncEngine.getInstance();
    this.dbManager = DatabaseManager.getInstance();
    this.apiClient = axios.create({
      baseURL: Config.apiBaseURL,
      timeout: 10000,
    });
  }

  static getInstance(): BodyTrackerService {
    if (!BodyTrackerService.instance) {
      BodyTrackerService.instance = new BodyTrackerService();
    }
    return BodyTrackerService.instance;
  }

  // MARK: - Body Weight

  /**
   * Log a new body weight entry
   */
  async logWeight(weight: number, notes?: string, recordedAt?: string): Promise<BodyWeight> {
    try {
      const now = new Date().toISOString();
      const recordedAtValue = recordedAt || now;
      const userId = await this.authService.getUserId();

      // Create local entry
      const localEntry: BodyWeight = {
        id: `weight_${Date.now()}`,
        weight,
        notes,
        recordedAt: recordedAtValue,
        createdAt: now,
        updatedAt: now,
      };

      // Store locally
      await this.dbManager.insertBodyWeight(localEntry);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'CREATE', 'WEIGHT', localEntry.id, JSON.stringify(localEntry));

      // Try to sync immediately
      try {
        const response = await this.apiClient.post('/body/weight', {
          weight,
          notes,
          recordedAt: recordedAtValue,
        });

        // Update with server ID
        const serverEntry = response.data;
        await this.dbManager.updateBodyWeight(localEntry.id, serverEntry);

        return serverEntry;
      } catch (error) {
        // Offline - return local entry
        console.warn('Failed to sync weight entry, will retry later', error);
        return localEntry;
      }
    } catch (error) {
      console.error('Failed to log weight', error);
      throw error;
    }
  }

  /**
   * Get weight history
   */
  async getWeightHistory(limit: number = 100, offset: number = 0): Promise<{ history: BodyWeight[]; trendLine: TrendLine | null }> {
    try {
      // Try to fetch from server
      try {
        const response = await this.apiClient.get('/body/weight', {
          params: { limit, offset },
        });

        // Cache locally
        for (const entry of response.data.history) {
          await this.dbManager.insertBodyWeight(entry);
        }

        return {
          history: response.data.history,
          trendLine: response.data.trendLine,
        };
      } catch (error) {
        // Offline - return local data
        console.warn('Failed to fetch weight history from server, using local cache', error);
        const localHistory = await this.dbManager.getBodyWeightHistory(limit, offset);
        const trendLine = this.calculateLocalWeightTrendLine(localHistory);

        return {
          history: localHistory,
          trendLine,
        };
      }
    } catch (error) {
      console.error('Failed to get weight history', error);
      throw error;
    }
  }

  /**
   * Update a weight entry (within 7 days)
   */
  async updateWeight(weightId: string, weight: number, notes?: string): Promise<BodyWeight> {
    try {
      const now = new Date().toISOString();
      const userId = await this.authService.getUserId();

      // Update locally
      const updated: BodyWeight = {
        id: weightId,
        weight,
        notes,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: now,
      };

      await this.dbManager.updateBodyWeight(weightId, updated);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'UPDATE', 'WEIGHT', weightId, JSON.stringify(updated));

      // Try to sync
      try {
        const response = await this.apiClient.put(`/body/weight/${weightId}`, {
          weight,
          notes,
        });

        return response.data;
      } catch (error) {
        console.warn('Failed to sync weight update, will retry later', error);
        return updated;
      }
    } catch (error) {
      console.error('Failed to update weight', error);
      throw error;
    }
  }

  /**
   * Delete a weight entry (within 7 days)
   */
  async deleteWeight(weightId: string): Promise<void> {
    try {
      const userId = await this.authService.getUserId();

      // Delete locally
      await this.dbManager.deleteBodyWeight(weightId);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'DELETE', 'WEIGHT', weightId, '{}');

      // Try to sync
      try {
        await this.apiClient.delete(`/body/weight/${weightId}`);
      } catch (error) {
        console.warn('Failed to sync weight deletion, will retry later', error);
      }
    } catch (error) {
      console.error('Failed to delete weight', error);
      throw error;
    }
  }

  // MARK: - Body Measurements

  /**
   * Log a new body measurement entry
   */
  async logMeasurement(
    measurements: {
      chest?: number;
      waist?: number;
      hips?: number;
      arms?: number;
      thighs?: number;
    },
    notes?: string,
    recordedAt?: string
  ): Promise<BodyMeasurement> {
    try {
      const now = new Date().toISOString();
      const recordedAtValue = recordedAt || now;
      const userId = await this.authService.getUserId();

      // Create local entry
      const localEntry: BodyMeasurement = {
        id: `measurement_${Date.now()}`,
        ...measurements,
        notes,
        recordedAt: recordedAtValue,
        createdAt: now,
        updatedAt: now,
      };

      // Store locally
      await this.dbManager.insertBodyMeasurement(localEntry);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'CREATE', 'MEASUREMENT', localEntry.id, JSON.stringify(localEntry));

      // Try to sync immediately
      try {
        const response = await this.apiClient.post('/body/measurements', {
          ...measurements,
          notes,
          recordedAt: recordedAtValue,
        });

        // Update with server ID
        const serverEntry = response.data;
        await this.dbManager.updateBodyMeasurement(localEntry.id, serverEntry);

        return serverEntry;
      } catch (error) {
        // Offline - return local entry
        console.warn('Failed to sync measurement entry, will retry later', error);
        return localEntry;
      }
    } catch (error) {
      console.error('Failed to log measurement', error);
      throw error;
    }
  }

  /**
   * Get measurement history with changes
   */
  async getMeasurementHistory(limit: number = 100, offset: number = 0): Promise<{
    history: BodyMeasurement[];
    changes: {
      chest: MeasurementChange | null;
      waist: MeasurementChange | null;
      hips: MeasurementChange | null;
      arms: MeasurementChange | null;
      thighs: MeasurementChange | null;
    };
  }> {
    try {
      // Try to fetch from server
      try {
        const response = await this.apiClient.get('/body/measurements', {
          params: { limit, offset },
        });

        // Cache locally
        for (const entry of response.data.history) {
          await this.dbManager.insertBodyMeasurement(entry);
        }

        return {
          history: response.data.history,
          changes: response.data.changes,
        };
      } catch (error) {
        // Offline - return local data
        console.warn('Failed to fetch measurement history from server, using local cache', error);
        const localHistory = await this.dbManager.getBodyMeasurementHistory(limit, offset);
        const changes = this.calculateLocalMeasurementChanges(localHistory);

        return {
          history: localHistory,
          changes,
        };
      }
    } catch (error) {
      console.error('Failed to get measurement history', error);
      throw error;
    }
  }

  /**
   * Update a measurement entry (within 7 days)
   */
  async updateMeasurement(
    measurementId: string,
    measurements: {
      chest?: number;
      waist?: number;
      hips?: number;
      arms?: number;
      thighs?: number;
    },
    notes?: string
  ): Promise<BodyMeasurement> {
    try {
      const now = new Date().toISOString();
      const userId = await this.authService.getUserId();

      // Update locally
      const updated: BodyMeasurement = {
        id: measurementId,
        ...measurements,
        notes,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: now,
      };

      await this.dbManager.updateBodyMeasurement(measurementId, updated);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'UPDATE', 'MEASUREMENT', measurementId, JSON.stringify(updated));

      // Try to sync
      try {
        const response = await this.apiClient.put(`/body/measurements/${measurementId}`, {
          ...measurements,
          notes,
        });

        return response.data;
      } catch (error) {
        console.warn('Failed to sync measurement update, will retry later', error);
        return updated;
      }
    } catch (error) {
      console.error('Failed to update measurement', error);
      throw error;
    }
  }

  /**
   * Delete a measurement entry (within 7 days)
   */
  async deleteMeasurement(measurementId: string): Promise<void> {
    try {
      const userId = await this.authService.getUserId();

      // Delete locally
      await this.dbManager.deleteBodyMeasurement(measurementId);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'DELETE', 'MEASUREMENT', measurementId, '{}');

      // Try to sync
      try {
        await this.apiClient.delete(`/body/measurements/${measurementId}`);
      } catch (error) {
        console.warn('Failed to sync measurement deletion, will retry later', error);
      }
    } catch (error) {
      console.error('Failed to delete measurement', error);
      throw error;
    }
  }

  // MARK: - Trend Calculations

  /**
   * Calculate weight trend line locally
   */
  private calculateLocalWeightTrendLine(weights: BodyWeight[]): TrendLine | null {
    if (weights.length < 2) {
      return null;
    }

    const startValue = weights[weights.length - 1].weight;
    const endValue = weights[0].weight;
    const startDate = weights[weights.length - 1].recordedAt;
    const endDate = weights[0].recordedAt;

    const changePercentage = ((endValue - startValue) / startValue) * 100;
    let trend: 'increasing' | 'decreasing' | 'stable';

    if (Math.abs(changePercentage) < 1) {
      trend = 'stable';
    } else if (changePercentage > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      startDate,
      endDate,
      startValue,
      endValue,
      trend,
      changePercentage: Math.round(changePercentage * 100) / 100,
    };
  }

  /**
   * Calculate measurement changes locally
   */
  private calculateLocalMeasurementChanges(measurements: BodyMeasurement[]): {
    chest: MeasurementChange | null;
    waist: MeasurementChange | null;
    hips: MeasurementChange | null;
    arms: MeasurementChange | null;
    thighs: MeasurementChange | null;
  } {
    const calculateChange = (type: 'chest' | 'waist' | 'hips' | 'arms' | 'thighs'): MeasurementChange | null => {
      const values = measurements
        .map((m) => m[type])
        .filter((v) => v !== undefined && v !== null) as number[];

      if (values.length < 2) {
        return null;
      }

      const current = values[0];
      const previous = values[1];
      const change = current - previous;
      const changePercentage = (change / previous) * 100;

      return {
        current,
        previous,
        change: Math.round(change * 100) / 100,
        changePercentage: Math.round(changePercentage * 100) / 100,
      };
    };

    return {
      chest: calculateChange('chest'),
      waist: calculateChange('waist'),
      hips: calculateChange('hips'),
      arms: calculateChange('arms'),
      thighs: calculateChange('thighs'),
    };
  }

  // MARK: - Progress Photos

  /**
   * Upload a progress photo
   */
  async uploadProgressPhoto(imageUrl: string, thumbnailUrl?: string, notes?: string, recordedAt?: string): Promise<ProgressPhoto> {
    try {
      const now = new Date().toISOString();
      const recordedAtValue = recordedAt || now;
      const userId = await this.authService.getUserId();

      // Create local entry
      const localEntry: ProgressPhoto = {
        id: `photo_${Date.now()}`,
        imageUrl,
        thumbnailUrl,
        notes,
        recordedAt: recordedAtValue,
        createdAt: now,
        updatedAt: now,
      };

      // Store locally
      await this.dbManager.insertProgressPhoto(localEntry);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'CREATE', 'PHOTO', localEntry.id, JSON.stringify(localEntry));

      // Try to sync immediately
      try {
        const response = await this.apiClient.post('/body/photos', {
          imageUrl,
          thumbnailUrl,
          notes,
          recordedAt: recordedAtValue,
        });

        // Update with server ID
        const serverEntry = response.data;
        await this.dbManager.updateProgressPhoto(localEntry.id, serverEntry);

        return serverEntry;
      } catch (error) {
        // Offline - return local entry
        console.warn('Failed to sync photo upload, will retry later', error);
        return localEntry;
      }
    } catch (error) {
      console.error('Failed to upload progress photo', error);
      throw error;
    }
  }

  /**
   * Get progress photo gallery
   */
  async getProgressPhotoGallery(limit: number = 100, offset: number = 0): Promise<ProgressPhoto[]> {
    try {
      // Try to fetch from server
      try {
        const response = await this.apiClient.get('/body/photos', {
          params: { limit, offset },
        });

        // Cache locally
        for (const photo of response.data.photos) {
          await this.dbManager.insertProgressPhoto(photo);
        }

        return response.data.photos;
      } catch (error) {
        // Offline - return local data
        console.warn('Failed to fetch photo gallery from server, using local cache', error);
        return await this.dbManager.getProgressPhotoGallery(limit, offset);
      }
    } catch (error) {
      console.error('Failed to get progress photo gallery', error);
      throw error;
    }
  }

  /**
   * Get a specific progress photo
   */
  async getProgressPhoto(photoId: string): Promise<ProgressPhoto> {
    try {
      // Try to fetch from server
      try {
        const response = await this.apiClient.get(`/body/photos/${photoId}`);

        // Cache locally
        await this.dbManager.insertProgressPhoto(response.data);

        return response.data;
      } catch (error) {
        // Offline - return local data
        console.warn('Failed to fetch photo from server, using local cache', error);
        return await this.dbManager.getProgressPhoto(photoId);
      }
    } catch (error) {
      console.error('Failed to get progress photo', error);
      throw error;
    }
  }

  /**
   * Delete a progress photo
   */
  async deleteProgressPhoto(photoId: string): Promise<void> {
    try {
      const userId = await this.authService.getUserId();

      // Delete locally
      await this.dbManager.deleteProgressPhoto(photoId);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'DELETE', 'PHOTO', photoId, '{}');

      // Try to sync
      try {
        await this.apiClient.delete(`/body/photos/${photoId}`);
      } catch (error) {
        console.warn('Failed to sync photo deletion, will retry later', error);
      }
    } catch (error) {
      console.error('Failed to delete progress photo', error);
      throw error;
    }
  }

  /**
   * Get two photos for side-by-side comparison
   */
  async getPhotoComparison(photoId1: string, photoId2: string): Promise<{ photo1: ProgressPhoto; photo2: ProgressPhoto }> {
    try {
      // Try to fetch from server
      try {
        const response = await this.apiClient.get('/body/photos/compare', {
          params: { photoId1, photoId2 },
        });

        // Cache locally
        await this.dbManager.insertProgressPhoto(response.data.photo1);
        await this.dbManager.insertProgressPhoto(response.data.photo2);

        return response.data;
      } catch (error) {
        // Offline - return local data
        console.warn('Failed to fetch photo comparison from server, using local cache', error);
        const photo1 = await this.dbManager.getProgressPhoto(photoId1);
        const photo2 = await this.dbManager.getProgressPhoto(photoId2);

        return { photo1, photo2 };
      }
    } catch (error) {
      console.error('Failed to get photo comparison', error);
      throw error;
    }
  }

  /**
   * Update progress photo notes
   */
  async updateProgressPhotoNotes(photoId: string, notes: string): Promise<ProgressPhoto> {
    try {
      const now = new Date().toISOString();
      const userId = await this.authService.getUserId();

      // Update locally
      const photo = await this.dbManager.getProgressPhoto(photoId);
      const updated: ProgressPhoto = {
        ...photo,
        notes,
        updatedAt: now,
      };

      await this.dbManager.updateProgressPhoto(photoId, updated);

      // Queue for sync
      await this.syncEngine.queueOperation(userId, 'UPDATE', 'PHOTO', photoId, JSON.stringify(updated));

      // Try to sync
      try {
        const response = await this.apiClient.put(`/body/photos/${photoId}`, { notes });

        return response.data;
      } catch (error) {
        console.warn('Failed to sync photo notes update, will retry later', error);
        return updated;
      }
    } catch (error) {
      console.error('Failed to update progress photo notes', error);
      throw error;
    }
  }
}
