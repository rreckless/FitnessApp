import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

interface LoginResponse {
  success: boolean;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RegisterResponse {
  success: boolean;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthenticationService {
  private apiClient: AxiosInstance;
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:5001') {
    this.baseURL = baseURL;
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.apiClient.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token refresh
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            if (this.refreshToken) {
              const response = await this.apiClient.post<RefreshTokenResponse>(
                '/auth/refresh',
                { refreshToken: this.refreshToken }
              );

              this.accessToken = response.data.accessToken;
              this.refreshToken = response.data.refreshToken;

              await this.saveTokens(this.accessToken, this.refreshToken);

              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
              return this.apiClient(originalRequest);
            }
          } catch (refreshError) {
            await this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    try {
      const response = await this.apiClient.post<RegisterResponse>('/auth/register', {
        email,
        password,
        name,
      });

      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      await this.saveTokens(this.accessToken, this.refreshToken);

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await this.apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      await this.saveTokens(this.accessToken, this.refreshToken);

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.apiClient.post('/auth/logout');
      }
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      this.accessToken = null;
      this.refreshToken = null;
      await this.clearTokens();
    }
  }

  async restoreSession(): Promise<boolean> {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (accessToken && refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error restoring session:', error);
      return false;
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return new Error('Invalid email or password');
      }
      if (error.response?.status === 400) {
        const data = error.response.data as any;
        return new Error(data.message || 'Invalid request');
      }
      if (error.code === 'ECONNREFUSED') {
        return new Error('Cannot connect to server. Make sure the backend is running.');
      }
      return new Error(error.response?.data?.message || error.message);
    }
    return new Error('An unexpected error occurred');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}

export const authService = new AuthenticationService();
