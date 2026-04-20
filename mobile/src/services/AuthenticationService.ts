import * as Keychain from 'react-native-keychain';
import axios, { AxiosInstance } from 'axios';
import type { User, TokenPair, AuthResponse, AuthErrorType } from '@types/index';
import { AuthError } from '@types/index';
import Config from '@config/Config';

export class AuthenticationService {
  private static instance: AuthenticationService;
  private api: AxiosInstance;
  private keychainService = 'com.fitquest.auth';
  private accessTokenKey = 'accessToken';
  private refreshTokenKey = 'refreshToken';
  private userKey = 'currentUser';

  private currentUser: User | null = null;
  private isAuthenticated = false;

  private constructor() {
    this.api = axios.create({
      baseURL: Config.apiBaseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.loadStoredUser();
  }

  static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/register', {
        email,
        password,
        name,
      });

      // Store tokens and user
      await this.storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      await this.storeUser(response.data.user);

      this.currentUser = response.data.user;
      this.isAuthenticated = true;

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });

      // Store tokens and user
      await this.storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      await this.storeUser(response.data.user);

      this.currentUser = response.data.user;
      this.isAuthenticated = true;

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear stored tokens and user
      await this.clearTokens();
      await this.clearUser();

      this.currentUser = null;
      this.isAuthenticated = false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<TokenPair> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new AuthError(AuthErrorType.NoToken, 'No refresh token available');
      }

      const response = await this.api.post<TokenPair>('/auth/refresh', {
        refreshToken,
      });

      // Store new tokens
      await this.storeTokens(response.data.accessToken, response.data.refreshToken);

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const response = await this.api.post('/auth/password-reset', { email });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(resetToken: string, newPassword: string): Promise<{ success: boolean }> {
    try {
      const response = await this.api.post('/auth/password-reset/confirm', {
        resetToken,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: this.keychainService,
        username: this.accessTokenKey,
      });
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Get current refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: this.keychainService,
        username: this.refreshTokenKey,
      });
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Validate password meets requirements
   */
  isValidPassword(password: string): boolean {
    // Minimum 12 characters
    if (password.length < 12) return false;

    // Must contain uppercase
    if (!/[A-Z]/.test(password)) return false;

    // Must contain lowercase
    if (!/[a-z]/.test(password)) return false;

    // Must contain number
    if (!/[0-9]/.test(password)) return false;

    // Must contain special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) return false;

    return true;
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expirationTime = this.extractExpirationFromToken(token);
    if (!expirationTime) return true;
    return new Date() > expirationTime;
  }

  /**
   * Check if token should be refreshed (expires within 5 minutes)
   */
  shouldRefreshToken(token: string): boolean {
    const expirationTime = this.extractExpirationFromToken(token);
    if (!expirationTime) return true;
    const refreshThreshold = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    return expirationTime < refreshThreshold;
  }

  /**
   * Extract expiration time from JWT token
   */
  private extractExpirationFromToken(token: string): Date | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      let payload = parts[1];
      // Add padding if needed
      const remainder = payload.length % 4;
      if (remainder > 0) {
        payload += '='.repeat(4 - remainder);
      }

      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
      if (decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      console.error('Failed to extract expiration from token:', error);
      return null;
    }
  }

  /**
   * Store tokens in Keychain
   */
  private async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(this.accessTokenKey, accessToken, {
        service: this.keychainService,
      });
      await Keychain.setGenericPassword(this.refreshTokenKey, refreshToken, {
        service: this.keychainService,
      });
    } catch (error) {
      throw new AuthError(AuthErrorType.KeychainError, `Failed to store tokens: ${error}`);
    }
  }

  /**
   * Clear tokens from Keychain
   */
  private async clearTokens(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: this.keychainService });
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  /**
   * Store user in AsyncStorage
   */
  private async storeUser(user: User): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
    } catch (error) {
      throw new AuthError(AuthErrorType.StorageError, `Failed to store user: ${error}`);
    }
  }

  /**
   * Clear user from AsyncStorage
   */
  private async clearUser(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(this.userKey);
    } catch (error) {
      console.error('Failed to clear user:', error);
    }
  }

  /**
   * Load stored user from AsyncStorage
   */
  private async loadStoredUser(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem(this.userKey);
      if (data) {
        this.currentUser = JSON.parse(data);
        const token = await this.getAccessToken();
        this.isAuthenticated = !!token;
      }
    } catch (error) {
      console.error('Failed to load stored user:', error);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): AuthError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new AuthError(AuthErrorType.BadRequest, data.error || 'Bad request');
        case 401:
          return new AuthError(AuthErrorType.Unauthorized, data.error || 'Unauthorized');
        case 429:
          return new AuthError(AuthErrorType.RateLimited, 'Too many requests');
        default:
          return new AuthError(AuthErrorType.ServerError, `Server error: ${status}`);
      }
    }

    return new AuthError(AuthErrorType.NetworkError, error.message || 'Network error');
  }
}

export default AuthenticationService.getInstance();
