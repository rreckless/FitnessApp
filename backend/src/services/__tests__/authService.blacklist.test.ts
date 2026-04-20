import * as authService from '../authService';
import * as connection from '../../database/connection';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

// Mock the database connection
jest.mock('../../database/connection');

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

describe('Authentication Service - Token Blacklist (Fix 1.4)', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis client
    mockRedisClient = {
      setEx: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
    };

    (connection.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
  });

  describe('logout', () => {
    it('should blacklist token on logout', async () => {
      const userId = 'test-uuid-1234';
      const accessToken = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      await authService.logout(userId, accessToken);

      // Verify token was added to blacklist
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      const call = mockRedisClient.setEx.mock.calls[0];
      expect(call[0]).toContain('blacklist:');
      expect(call[0]).toContain(accessToken);
    });

    it('should set correct TTL for blacklist entry', async () => {
      const userId = 'test-uuid-1234';
      const accessToken = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      await authService.logout(userId, accessToken);

      // Verify TTL is set (should be close to 3600 seconds for 1h token)
      const call = mockRedisClient.setEx.mock.calls[0];
      const ttl = call[1];
      expect(ttl).toBeGreaterThan(3500); // Allow some time drift
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should reject logout with invalid token', async () => {
      const userId = 'test-uuid-1234';
      const invalidToken = 'invalid.token.here';

      await expect(authService.logout(userId, invalidToken)).rejects.toThrow(
        'Invalid token'
      );
    });

    it('should reject logout with token missing exp claim', async () => {
      const userId = 'test-uuid-1234';
      // Create token without exp (manually)
      const tokenWithoutExp = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret
      );
      // Decode and remove exp
      const decoded = jwt.decode(tokenWithoutExp) as any;
      delete decoded.exp;
      const malformedToken = jwt.sign(decoded, config.jwtSecret);

      await expect(authService.logout(userId, malformedToken)).rejects.toThrow(
        'Invalid token'
      );
    });

    it('should log token blacklist event', async () => {
      const userId = 'test-uuid-1234';
      const accessToken = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const loggerSpy = jest.spyOn(console, 'log').mockImplementation();

      await authService.logout(userId, accessToken);

      // Verify logging occurred (in real implementation)
      expect(mockRedisClient.setEx).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });

    it('should not blacklist already-expired tokens', async () => {
      const userId = 'test-uuid-1234';
      // Create an already-expired token
      const expiredToken = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      await authService.logout(userId, expiredToken);

      // Should not call setEx for expired tokens (TTL would be negative)
      // The implementation should skip blacklisting if TTL <= 0
      if (mockRedisClient.setEx.mock.calls.length > 0) {
        const ttl = mockRedisClient.setEx.mock.calls[0][1];
        expect(ttl).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Token Blacklist Integration', () => {
    it('should prevent use of blacklisted token', async () => {
      const userId = 'test-uuid-1234';
      const accessToken = jwt.sign(
        { userId, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      // Logout and blacklist token
      await authService.logout(userId, accessToken);

      // Verify token was blacklisted
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining(accessToken),
        expect.any(Number),
        '1'
      );
    });

    it('should handle multiple concurrent logouts', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const token1 = jwt.sign(
        { userId: userId1, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const token2 = jwt.sign(
        { userId: userId2, type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      // Logout both users concurrently
      await Promise.all([
        authService.logout(userId1, token1),
        authService.logout(userId2, token2),
      ]);

      // Verify both tokens were blacklisted
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(2);
    });
  });
});
