import AuthenticationService, { AuthenticationService as AuthenticationServiceClass } from '@services/AuthenticationService';
import { mockAxiosInstance, mockKeychain } from './setup';

const mockedAxios = mockAxiosInstance;
const mockedKeychain = mockKeychain;

describe('AuthenticationService - Device Fingerprinting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceFingerprint', () => {
    it('should create and store device fingerprint on first call', async () => {
      const fingerprint = await AuthenticationService.getDeviceFingerprint();

      expect(fingerprint).toBeDefined();
      expect(fingerprint?.deviceId).toBeDefined();
      expect(fingerprint?.platform).toBeDefined();
      expect(fingerprint?.osVersion).toBeDefined();
      expect(fingerprint?.appVersion).toBeDefined();
      expect(fingerprint?.createdAt).toBeDefined();
    });

    it('should return cached fingerprint on subsequent calls', async () => {
      const fingerprint1 = await AuthenticationService.getDeviceFingerprint();
      const fingerprint2 = await AuthenticationService.getDeviceFingerprint();

      expect(fingerprint1?.deviceId).toBe(fingerprint2?.deviceId);
    });

    it('should include device fingerprint in request headers', async () => {
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

      await AuthenticationService.login('test@example.com', 'Password123!');

      // Verify that device fingerprint was created
      const fingerprint = await AuthenticationService.getDeviceFingerprint();
      expect(fingerprint).toBeDefined();
      expect(fingerprint?.deviceId).toBeDefined();
    });
  });
});

describe('AuthenticationService - Automatic Token Refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  describe('refreshAccessToken', () => {
    it('should refresh access token automatically', async () => {
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

    it('should throw error if no refresh token available', async () => {
      mockedKeychain.getGenericPassword.mockResolvedValueOnce(false);

      await expect(AuthenticationService.refreshAccessToken()).rejects.toThrow();
    });
  });
});
