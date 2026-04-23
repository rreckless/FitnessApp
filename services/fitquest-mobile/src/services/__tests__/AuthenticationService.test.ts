/**
 * AuthenticationService Tests
 * Unit and property-based tests for authentication functionality
 */

import { AuthenticationService } from '../AuthenticationService';
import { AuthError, AuthException } from '../../models/AuthModels';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-keychain');
jest.mock('axios');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  const mockApiBaseUrl = 'http://localhost:5000/api';

  beforeEach(() => {
    jest.clearAllMocks();
    authService = AuthenticationService.getInstance(mockApiBaseUrl);
  });

  describe('Password Strength Validation', () => {
    it('should reject password shorter than 12 characters', () => {
      const result = (authService as any).validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = (authService as any).validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = (authService as any).validatePasswordStrength('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = (authService as any).validatePasswordStrength('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = (authService as any).validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should accept valid password', () => {
      const result = (authService as any).validatePasswordStrength('ValidPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Property-based test: All valid passwords should pass validation
    it('should validate all passwords with required components', () => {
      const validPasswords = [
        'ValidPass123!',
        'AnotherPass456@',
        'ThirdPass789#',
        'FourthPass000$',
        'FifthPass111%',
      ];

      for (const password of validPasswords) {
        const result = (authService as any).validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
      }
    });

    // Property-based test: Invalid passwords should always have errors
    it('should reject all passwords missing required components', () => {
      const invalidPasswords = [
        'short1!', // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!', // No number
        'NoSpecial123', // No special char
      ];

      for (const password of invalidPasswords) {
        const result = (authService as any).validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });

      expect(result).toEqual(mockResponse);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      expect(Keychain.setGenericPassword).toHaveBeenCalled();
    });

    it('should throw AuthException on invalid credentials', async () => {
      const error = new Error('Invalid credentials');
      (error as any).response = { status: 401, data: { message: 'Invalid credentials' } };

      (axios.post as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      })).rejects.toThrow(AuthException);
    });

    it('should throw AuthException on network error', async () => {
      const error = new Error('Network error');
      (error as any).response = undefined;

      (axios.post as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'ValidPass123!',
      })).rejects.toThrow(AuthException);
    });
  });

  describe('Register', () => {
    it('should successfully register with valid data', async () => {
      const mockResponse = {
        userId: 'user123',
        email: 'newuser@example.com',
        name: 'New User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'ValidPass123!',
        name: 'New User',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should reject weak password on registration', async () => {
      await expect(authService.register({
        email: 'newuser@example.com',
        password: 'weak', // Too short
        name: 'New User',
      })).rejects.toThrow(AuthException);
    });

    it('should throw AuthException if email already exists', async () => {
      const error = new Error('Email already exists');
      (error as any).response = { status: 409, data: { message: 'Email already exists' } };

      (axios.post as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.register({
        email: 'existing@example.com',
        password: 'ValidPass123!',
        name: 'User',
      })).rejects.toThrow(AuthException);
    });
  });

  describe('Session Management', () => {
    it('should retrieve current session', async () => {
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        accessTokenExpiresAt: Date.now() + 900000,
        refreshTokenExpiresAt: Date.now() + 604800000,
        deviceFingerprint: 'fingerprint123',
        createdAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSession));

      const session = await authService.getSession();
      expect(session).toEqual(mockSession);
    });

    it('should return null if no session exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const session = await authService.getSession();
      expect(session).toBeNull();
    });

    it('should check if user is authenticated', async () => {
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        accessTokenExpiresAt: Date.now() + 900000,
        refreshTokenExpiresAt: Date.now() + 604800000,
        deviceFingerprint: 'fingerprint123',
        createdAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSession));

      const isAuthenticated = await authService.isAuthenticated();
      expect(isAuthenticated).toBe(true);
    });

    it('should return false if token is expired', async () => {
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        accessTokenExpiresAt: Date.now() - 1000, // Expired
        refreshTokenExpiresAt: Date.now() + 604800000,
        deviceFingerprint: 'fingerprint123',
        createdAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSession));

      const isAuthenticated = await authService.isAuthenticated();
      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should successfully logout', async () => {
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        accessTokenExpiresAt: Date.now() + 900000,
        refreshTokenExpiresAt: Date.now() + 604800000,
        deviceFingerprint: 'fingerprint123',
        createdAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSession));
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
      (Keychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);
      (axios.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      await authService.logout();

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
      expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    });
  });

  describe('Authentication Round Trip', () => {
    // Property-based test: Register -> Login -> Logout should work
    it('should complete full authentication round trip', async () => {
      const mockRegisterResponse = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockRegisterResponse });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        accessTokenExpiresAt: Date.now() + 900000,
        refreshTokenExpiresAt: Date.now() + 604800000,
        deviceFingerprint: 'fingerprint123',
        createdAt: Date.now(),
      }));
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);
      (Keychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      // Register
      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: 'Test User',
      });
      expect(registerResult.userId).toBe('user123');

      // Check authenticated
      const isAuthenticated = await authService.isAuthenticated();
      expect(isAuthenticated).toBe(true);

      // Logout
      await authService.logout();
      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });
  });
});
