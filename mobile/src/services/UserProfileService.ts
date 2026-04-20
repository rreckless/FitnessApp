import axios, { AxiosInstance } from 'axios';
import { UserProfile, UserPreferences, ProfileError, ProfileErrorType } from '@types/index';
import Config from '@config/Config';
import AuthenticationService from './AuthenticationService';

export interface UpdateProfileRequest {
  name?: string;
  bio?: string;
}

export interface UpdatePreferencesRequest {
  fitnessGoals?: string[];
  experienceLevel?: string;
  workoutFrequency?: number;
  availableEquipment?: string[];
}

export class UserProfileService {
  private static instance: UserProfileService;
  private api: AxiosInstance;
  private authService = AuthenticationService;

  private userProfile: UserProfile | null = null;
  private userPreferences: UserPreferences | null = null;

  private constructor() {
    this.api = axios.create({
      baseURL: Config.apiBaseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor
    this.api.interceptors.request.use(async (config) => {
      const token = await this.authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await this.api.get<UserProfile>(`/users/${userId}`);
      this.userProfile = response.data;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const response = await this.api.put<UserProfile>(`/users/${userId}`, data);
      this.userProfile = response.data;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: string): Promise<void> {
    try {
      await this.api.delete(`/users/${userId}`);
      this.userProfile = null;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    try {
      const response = await this.api.get<UserPreferences>(`/users/${userId}/preferences`);
      this.userPreferences = response.data;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, data: UpdatePreferencesRequest): Promise<UserPreferences> {
    try {
      const response = await this.api.put<UserPreferences>(`/users/${userId}/preferences`, data);
      this.userPreferences = response.data;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Set fitness goals
   */
  async setFitnessGoals(userId: string, goals: string[]): Promise<UserPreferences> {
    return this.updatePreferences(userId, { fitnessGoals: goals });
  }

  /**
   * Set experience level
   */
  async setExperienceLevel(userId: string, level: string): Promise<UserPreferences> {
    return this.updatePreferences(userId, { experienceLevel: level });
  }

  /**
   * Set workout frequency
   */
  async setWorkoutFrequency(userId: string, frequency: number): Promise<UserPreferences> {
    return this.updatePreferences(userId, { workoutFrequency: frequency });
  }

  /**
   * Set available equipment
   */
  async setAvailableEquipment(userId: string, equipment: string[]): Promise<UserPreferences> {
    return this.updatePreferences(userId, { availableEquipment: equipment });
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, imageUri: string): Promise<UserProfile> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);

      const response = await this.api.post<UserProfile>(`/users/${userId}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      this.userProfile = response.data;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get cached profile
   */
  getCachedProfile(): UserProfile | null {
    return this.userProfile;
  }

  /**
   * Get cached preferences
   */
  getCachedPreferences(): UserPreferences | null {
    return this.userPreferences;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): ProfileError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new ProfileError(ProfileErrorType.BadRequest, data.error || 'Bad request');
        case 401:
          return new ProfileError(ProfileErrorType.Unauthorized, 'Unauthorized');
        case 404:
          return new ProfileError(ProfileErrorType.NotFound, 'Profile not found');
        default:
          return new ProfileError(ProfileErrorType.ServerError, `Server error: ${status}`);
      }
    }

    return new ProfileError(ProfileErrorType.NetworkError, error.message || 'Network error');
  }
}

export { UserProfileService };
export default UserProfileService.getInstance();
