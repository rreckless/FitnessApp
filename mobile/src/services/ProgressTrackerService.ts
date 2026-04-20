import axios from 'axios';
import { AuthenticationService } from './AuthenticationService';
import Config from '../config/Config';

// MARK: - Types

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  recordedAt: string;
}

export interface VolumeData {
  period: 'workout' | 'week' | 'month';
  totalVolume: number;
  startDate: string;
  endDate: string;
  exerciseBreakdown: Array<{
    exerciseId: string;
    exerciseName: string;
    volume: number;
  }>;
}

export interface VolumeTrend {
  date: string;
  volume: number;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }>;
}

// MARK: - ProgressTrackerService

export class ProgressTrackerService {
  private static instance: ProgressTrackerService;
  private authService: AuthenticationService;
  private apiClient: any;

  private constructor() {
    this.authService = AuthenticationService.getInstance();
    this.apiClient = axios.create({
      baseURL: Config.apiBaseURL,
      timeout: 10000,
    });
  }

  static getInstance(): ProgressTrackerService {
    if (!ProgressTrackerService.instance) {
      ProgressTrackerService.instance = new ProgressTrackerService();
    }
    return ProgressTrackerService.instance;
  }

  // MARK: - Personal Records

  /**
   * Get all personal records for the user
   */
  async getPersonalRecords(): Promise<PersonalRecord[]> {
    try {
      const response = await this.apiClient.get('/progress/prs');
      return response.data.prs || [];
    } catch (error) {
      console.error('Failed to get personal records:', error);
      throw error;
    }
  }

  /**
   * Get PR history for a specific exercise
   */
  async getExercisePRHistory(exerciseId: string): Promise<PersonalRecord[]> {
    try {
      const response = await this.apiClient.get(`/progress/prs/${exerciseId}`);
      return response.data.history || [];
    } catch (error) {
      console.error('Failed to get exercise PR history:', error);
      throw error;
    }
  }

  // MARK: - Volume Calculations

  /**
   * Get volume data for a specified period
   */
  async getVolumeData(period: 'week' | 'month', startDate: string): Promise<VolumeData> {
    try {
      const response = await this.apiClient.get('/progress/volume', {
        params: { period, startDate },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get volume data:', error);
      throw error;
    }
  }

  /**
   * Get volume trends over a date range
   */
  async getVolumeTrends(startDate: string, endDate: string): Promise<VolumeTrend[]> {
    try {
      const response = await this.apiClient.get('/progress/volume/trends', {
        params: { startDate, endDate },
      });
      return response.data.trends || [];
    } catch (error) {
      console.error('Failed to get volume trends:', error);
      throw error;
    }
  }

  /**
   * Get volume breakdown by muscle group
   */
  async getVolumeByMuscleGroup(startDate: string, endDate: string): Promise<Array<{ muscleGroup: string; volume: number }>> {
    try {
      const response = await this.apiClient.get('/progress/volume/by-muscle-group', {
        params: { startDate, endDate },
      });
      return response.data.volumeByMuscleGroup || [];
    } catch (error) {
      console.error('Failed to get volume by muscle group:', error);
      throw error;
    }
  }

  // MARK: - Chart Generation

  /**
   * Get chart data for a specified type
   */
  async getChartData(
    type: 'xp-progression' | 'volume-muscle-group' | 'exercise-distribution' | 'pr-progression',
    options?: {
      startDate?: string;
      endDate?: string;
      exerciseId?: string;
    }
  ): Promise<ChartData> {
    try {
      const response = await this.apiClient.get(`/progress/charts/${type}`, {
        params: options,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get chart data:', error);
      throw error;
    }
  }

  /**
   * Get XP progression chart
   */
  async getXPProgressionChart(startDate: string, endDate: string): Promise<ChartData> {
    return this.getChartData('xp-progression', { startDate, endDate });
  }

  /**
   * Get volume by muscle group chart
   */
  async getVolumeMuscleGroupChart(startDate: string, endDate: string): Promise<ChartData> {
    return this.getChartData('volume-muscle-group', { startDate, endDate });
  }

  /**
   * Get exercise distribution chart
   */
  async getExerciseDistributionChart(startDate: string, endDate: string): Promise<ChartData> {
    return this.getChartData('exercise-distribution', { startDate, endDate });
  }

  /**
   * Get PR progression chart for an exercise
   */
  async getPRProgressionChart(exerciseId: string): Promise<ChartData> {
    return this.getChartData('pr-progression', { exerciseId });
  }

  // MARK: - Filtering

  /**
   * Filter personal records by muscle group
   */
  filterPRsByMuscleGroup(prs: PersonalRecord[], muscleGroup: string): PersonalRecord[] {
    // This would require exercise metadata, so we'll implement a basic version
    return prs;
  }

  /**
   * Filter personal records by exercise
   */
  filterPRsByExercise(prs: PersonalRecord[], exerciseId: string): PersonalRecord[] {
    return prs.filter((pr) => pr.exerciseId === exerciseId);
  }

  // MARK: - Export

  /**
   * Export chart as image (base64)
   */
  async exportChartAsImage(chartData: ChartData): Promise<string> {
    // This would typically use a charting library like Chart.js
    // For now, we'll return a placeholder
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  /**
   * Export progress data as JSON
   */
  async exportProgressAsJSON(prs: PersonalRecord[], volumeData: VolumeData): Promise<string> {
    const data = {
      personalRecords: prs,
      volumeData,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }
}

export default ProgressTrackerService.getInstance();
