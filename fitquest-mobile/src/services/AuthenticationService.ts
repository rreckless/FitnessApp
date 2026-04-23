/**
 * AuthenticationService - Handles user authentication and session management
 * Manages login, register, logout, token refresh, and secure token storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  SessionData,
  PasswordValidationResult,
  DeviceFingerprint,
  AuthError,
  AuthException,
} from '../models/AuthModels';
import { DeviceFingerprintService } from './DeviceFingerprintService';

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_REFRESH_THRESHOLD = 2 * 60 * 1000; // Refresh 2 minutes before expiry

export class AuthenticationService {
  private static instance: AuthenticationService;
  private apiClient: AxiosInstance;
  private currentSession: SessionData | null = null;
  private refreshTokenTimer: NodeJS.Timeout | null = null;
  private readonly apiBaseUrl: string;

  private constructor(apiBaseUrl: string = 'http://localhost:5000/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
    });

    // Add request interceptor to include access token
    this.apiClient.interceptors.request.use(
      async (config) => {
        const session = await this.getSession();
        if (session?.accessToken) {
          config.headers.Authorization = `Bearer ${session.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token refresh
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          try {
            await this.refreshAccessToken();
            // Retry original request
            return this.apiClient.request(error.config);
          } catch (refreshError) {
            await this.logout();
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  static getInstance(apiBaseUrl?: string): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService(apiBaseUrl);
    }
    return AuthenticationService.instance;
  }

  /**
   * Register a new user account
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      // Validate password strength
      const passwordValidation = this.validatePasswordStrength(request.password);
      if (!passwordValidation.isValid) {
        throw new AuthException(
          AuthError.WEAK_PASSWORD,
          'Password does not meet requirements',
          { errors: passwordValidation.errors }
        );
      }

      // Generate device fingerprint if not provided
      const deviceFingerprint = request.deviceFingerprint || await DeviceFingerprintService.generateFingerprint();

      // Call registration endpoint
      const response = await this.apiClient.post<AuthResponse>('/auth/register', {
        email: request.email,
        password: request.password,
        name: request.name,
        deviceFingerprint,
      });

      // Store session
      await this.storeSession(response.data);

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login with email and password
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      // Generate device fingerprint if not provided
      const deviceFingerprint = request.deviceFingerprint || await DeviceFingerprintService.generateFingerprint();

      // Call login endpoint
      const response = await this.apiClient.post<AuthResponse>('/auth/login', {
        email: request.email,
        password: request.password,
        deviceFingerprint,
      });

      // Store session
      await this.storeSession(response.data);

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if session exists
      const session = await this.getSession();
      if (session?.accessToken) {
        try {
          await this.apiClient.post('/auth/logout');
        } catch (error) {
          // Logout endpoint failure is not critical
          console.warn('Logout endpoint failed:', error);
        }
      }

      // Clear session data
      await this.clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      throw new AuthException(AuthError.UNKNOWN, 'Failed to logout', { error });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session?.refreshToken) {
        throw new AuthException(AuthError.INVALID_TOKEN, 'No refresh token available');
      }

      // Call refresh endpoint
      const response = await axios.post<AuthResponse>(`${this.apiBaseUrl}/auth/refresh`, {
        refreshToken: session.refreshToken,
      });

      // Update session with new tokens
      await this.storeSession(response.data);
    } catch (error) {
      await this.clearSession();
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<SessionData | null> {
    if (this.currentSession) {
      return this.currentSession;
    }

    try {
      const sessionJson = await AsyncStorage.getItem('user_session');
      if (!sessionJson) {
        return null;
      }

      const session = JSON.parse(sessionJson) as SessionData;
      this.currentSession = session;

      // Check if token is expired
      if (session.accessTokenExpiresAt < Date.now()) {
        // Token expired, try to refresh
        try {
          await this.refreshAccessToken();
        } catch (error) {
          await this.clearSession();
          return null;
        }
      }

      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null && session.accessTokenExpiresAt > Date.now();
  }

  /**
   * Get current user ID
   */
  async getCurrentUserId(): Promise<string | null> {
    const session = await this.getSession();
    return session?.userId || null;
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.accessToken || null;
  }

  /**
   * Validate password strength
   * Requirements: min 12 chars, uppercase, lowercase, number, special char
   */
  private validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Store session data securely
   */
  private async storeSession(authResponse: AuthResponse): Promise<void> {
    try {
      const deviceFingerprint = await DeviceFingerprintService.generateFingerprint();

      const session: SessionData = {
        userId: authResponse.userId,
        email: authResponse.email,
        name: authResponse.name,
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_EXPIRY,
        refreshTokenExpiresAt: Date.now() + REFRESH_TOKEN_EXPIRY,
        deviceFingerprint,
        createdAt: Date.now(),
      };

      // Store session in AsyncStorage
      await AsyncStorage.setItem('user_session', JSON.stringify(session));
      await AsyncStorage.setItem('user_id', session.userId);
      await AsyncStorage.setItem('user_token', session.accessToken);

      // Store refresh token securely in Keychain
      await Keychain.setGenericPassword('fitquest_refresh_token', session.refreshToken, {
        service: 'fitquest.refresh_token',
      });

      // Store device fingerprint securely in Keychain
      await Keychain.setGenericPassword('fitquest_device_fingerprint', deviceFingerprint, {
        service: 'fitquest.device_fingerprint',
      });

      this.currentSession = session;

      // Schedule token refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('Failed to store session:', error);
      throw new AuthException(AuthError.UNKNOWN, 'Failed to store session', { error });
    }
  }

  /**
   * Clear session data
   */
  private async clearSession(): Promise<void> {
    try {
      // Clear AsyncStorage
      await AsyncStorage.multiRemove(['user_session', 'user_id', 'user_token']);

      // Clear Keychain
      await Keychain.resetGenericPassword({ service: 'fitquest.refresh_token' });
      await Keychain.resetGenericPassword({ service: 'fitquest.device_fingerprint' });

      this.currentSession = null;

      // Cancel token refresh timer
      if (this.refreshTokenTimer) {
        clearTimeout(this.refreshTokenTimer);
        this.refreshTokenTimer = null;
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    // Cancel existing timer
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
    }

    const session = this.currentSession;
    if (!session) {
      return;
    }

    // Calculate time until refresh (2 minutes before expiry)
    const timeUntilRefresh = session.accessTokenExpiresAt - Date.now() - TOKEN_REFRESH_THRESHOLD;

    if (timeUntilRefresh > 0) {
      this.refreshTokenTimer = setTimeout(async () => {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error('Automatic token refresh failed:', error);
        }
      }, timeUntilRefresh);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): AuthException {
    if (error instanceof AuthException) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as any;

      if (status === 401) {
        return new AuthException(
          AuthError.INVALID_CREDENTIALS,
          data?.message || 'Invalid credentials',
          data
        );
      }

      if (status === 429) {
        return new AuthException(
          AuthError.ACCOUNT_LOCKED,
          'Account temporarily locked due to too many failed attempts',
          data
        );
      }

      if (status === 409) {
        return new AuthException(
          AuthError.EMAIL_ALREADY_EXISTS,
          'Email already registered',
          data
        );
      }

      if (status === 400) {
        return new AuthException(
          AuthError.INVALID_PASSWORD,
          data?.message || 'Invalid request',
          data
        );
      }

      if (!error.response) {
        return new AuthException(
          AuthError.NETWORK_ERROR,
          'Network error. Please check your connection.',
          error
        );
      }

      return new AuthException(
        AuthError.UNKNOWN,
        error.message || 'Authentication failed',
        error
      );
    }

    return new AuthException(
      AuthError.UNKNOWN,
      'An unexpected error occurred',
      error
    );
  }
}

export default AuthenticationService;
