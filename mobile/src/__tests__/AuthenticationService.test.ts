import AuthenticationService from '@services/AuthenticationService';
import { AuthenticationService as AuthenticationServiceClass } from '@services/AuthenticationService';
import { mockAxiosInstance, mockKeychain } from './setup';

const mockedAxios = mockAxiosInstance;
const mockedKeychain = mockKeychain;

describe('AuthenticationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            level: 1,
            totalXp: 0,
            currentStreak: 0,
            longestStreak: 0,
            subscriptionTier: 'FREE',
            createdAt: '2024-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);
      mockedKeychain.setGenericPassword.mockResolvedValueOnce(false);

      const result = await AuthenticationService.register('test@example.com', 'Password123!', 'Test User');

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('access-token-123');
      expect(mockedKeychain.setGenericPassword).toHaveBeenCalled();
    });

    it('should throw error on invalid email', async () => {
      const mockResponse = {
        response: {
          status: 400,
          data: { error: 'Invalid email' },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockResponse);

      await expect(
        AuthenticationService.register('invalid-email', 'Password123!', 'Test User')
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            level: 1,
            totalXp: 0,
            currentStreak: 0,
            longestStreak: 0,
            subscriptionTier: 'FREE',
            createdAt: '2024-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);
      mockedKeychain.setGenericPassword.mockResolvedValueOnce(false);

      const result = await AuthenticationService.login('test@example.com', 'Password123!');

      expect(result.user.email).toBe('test@example.com');
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'Password123!',
      });
    });

    it('should throw error on invalid credentials', async () => {
      const mockResponse = {
        response: {
          status: 401,
          data: { error: 'Invalid credentials' },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockResponse);

      await expect(
        AuthenticationService.login('test@example.com', 'WrongPassword')
      ).rejects.toThrow();
    });

    it('should throw error on rate limit', async () => {
      const mockResponse = {
        response: {
          status: 429,
          data: { error: 'Too many requests' },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockResponse);

      await expect(
        AuthenticationService.login('test@example.com', 'Password123!')
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should logout user and clear tokens', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} });
      mockedKeychain.resetGenericPassword.mockResolvedValueOnce(true);

      await AuthenticationService.logout();

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/logout');
      expect(mockedKeychain.resetGenericPassword).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      const mockResponse = {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      mockedKeychain.getGenericPassword.mockResolvedValueOnce({
        username: 'refreshToken',
        password: 'refresh-token-123',
        service: 'com.fitquest.auth',
        storage: 'keychain',
      });
      mockedAxios.post.mockResolvedValueOnce(mockResponse);
      mockedKeychain.setGenericPassword.mockResolvedValueOnce(false);

      const result = await AuthenticationService.refreshAccessToken();

      expect(result.accessToken).toBe('new-access-token');
      expect(mockedKeychain.setGenericPassword).toHaveBeenCalled();
    });

    it('should throw error if no refresh token', async () => {
      mockedKeychain.getGenericPassword.mockResolvedValueOnce(false);

      await expect(AuthenticationService.refreshAccessToken()).rejects.toThrow();
    });
  });

  describe('isValidPassword', () => {
    it('should accept valid password', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'ValidPass123!');
      expect(isValid).toBe(true);
    });

    it('should reject password < 12 characters', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'Short1!');
      expect(isValid).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'validpass123!');
      expect(isValid).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'VALIDPASS123!');
      expect(isValid).toBe(false);
    });

    it('should reject password without number', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'ValidPass!');
      expect(isValid).toBe(false);
    });

    it('should reject password without special character', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidPassword.call({}, 'ValidPass123');
      expect(isValid).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid email', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidEmail.call({}, 'test@example.com');
      expect(isValid).toBe(true);
    });

    it('should reject invalid email', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidEmail.call({}, 'invalid-email');
      expect(isValid).toBe(false);
    });

    it('should reject email without domain', () => {
      const isValid = AuthenticationServiceClass.prototype.isValidEmail.call({}, 'test@');
      expect(isValid).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.test';
      const isExpired = AuthenticationServiceClass.isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it('should return false for valid token', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ exp: futureTimestamp })).toString('base64')}.test`;
      const isExpired = AuthenticationServiceClass.isTokenExpired(validToken);
      expect(isExpired).toBe(false);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true if token expires within 5 minutes', () => {
      const soonTimestamp = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      const soonToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ exp: soonTimestamp })).toString('base64')}.test`;
      const shouldRefresh = AuthenticationServiceClass.shouldRefreshToken(soonToken);
      expect(shouldRefresh).toBe(true);
    });

    it('should return false if token expires after 5 minutes', () => {
      const laterTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const laterToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ exp: laterTimestamp })).toString('base64')}.test`;
      const shouldRefresh = AuthenticationServiceClass.shouldRefreshToken(laterToken);
      expect(shouldRefresh).toBe(false);
    });
  });
});
