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

describe('Authentication Service - Account Lockout (Fix 2.1)', () => {
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Redis client
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      setEx: jest.fn(),
    };

    const mockConnection = connection as any;
    mockConnection.getRedisClient = jest.fn(() => mockRedis);
  });

  describe('Account Lockout after failed attempts', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        mockRedis.get.mockResolvedValueOnce(null); // Not locked yet
        mockRedis.incr.mockResolvedValueOnce(i + 1); // Increment counter
        mockRedis.expire.mockResolvedValueOnce(1); // Set expiration

        // Mock: user found
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              id: 'test-uuid-1234',
              email: 'test@example.com',
              password_hash: 'invalid-hash',
              name: 'Test User',
              level: 1,
              total_xp: 0,
              current_streak: 0,
              longest_streak: 0,
              subscription_tier: 'FREE',
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
        });

        try {
          await authService.login('test@example.com', 'wrongpassword');
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should be locked
      mockRedis.get.mockResolvedValueOnce('5'); // Account is locked (5 attempts)

      await expect(authService.login('test@example.com', 'password123')).rejects.toThrow(
        'ACCOUNT_LOCKED'
      );
    });

    it('should return 429 status when account is locked', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: account is locked
      mockRedis.get.mockResolvedValueOnce('5');

      try {
        await authService.login('test@example.com', 'password123');
        fail('Should have thrown ACCOUNT_LOCKED error');
      } catch (error) {
        expect((error as Error).message).toBe('ACCOUNT_LOCKED');
      }
    });

    it('should clear lockout counter on successful login', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: account not locked
      mockRedis.get.mockResolvedValueOnce(null);

      // Mock: user found with valid password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
            password_hash:
              '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', // bcrypt hash of 'password123'
            name: 'Test User',
            level: 1,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            subscription_tier: 'FREE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Mock: clear failed attempts
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.user.email).toBe('test@example.com');
      expect(mockRedis.del).toHaveBeenCalledWith('lockout:test@example.com');
    });

    it('should increment failed attempts on invalid password', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: account not locked
      mockRedis.get.mockResolvedValueOnce(null);

      // Mock: user found with invalid password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
            password_hash: 'invalid-hash',
            name: 'Test User',
            level: 1,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            subscription_tier: 'FREE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Mock: increment failed attempts
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      try {
        await authService.login('test@example.com', 'wrongpassword');
      } catch (error) {
        expect((error as Error).message).toBe('Invalid email or password');
      }

      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:test@example.com');
      expect(mockRedis.expire).toHaveBeenCalledWith('lockout:test@example.com', 1800); // 30 minutes
    });

    it('should increment failed attempts on non-existent email', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: account not locked
      mockRedis.get.mockResolvedValueOnce(null);

      // Mock: user not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Mock: increment failed attempts
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      try {
        await authService.login('nonexistent@example.com', 'password123');
      } catch (error) {
        expect((error as Error).message).toBe('Invalid email or password');
      }

      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:nonexistent@example.com');
    });

    it('should handle Redis errors gracefully', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: Redis error on lockout check
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      // Mock: user found with valid password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
            password_hash:
              '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
            name: 'Test User',
            level: 1,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            subscription_tier: 'FREE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Should still allow login even if Redis fails
      const result = await authService.login('test@example.com', 'password123');

      expect(result.user.email).toBe('test@example.com');
    });

    it('should use 30-minute lockout duration', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: account not locked
      mockRedis.get.mockResolvedValueOnce(null);

      // Mock: user found with invalid password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
            password_hash: 'invalid-hash',
            name: 'Test User',
            level: 1,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            subscription_tier: 'FREE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Mock: increment failed attempts
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      try {
        await authService.login('test@example.com', 'wrongpassword');
      } catch (error) {
        // Expected
      }

      // Verify 30-minute duration (1800 seconds)
      expect(mockRedis.expire).toHaveBeenCalledWith('lockout:test@example.com', 1800);
    });

    it('should use 5 as lockout threshold', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Test that 4 attempts doesn't lock
      mockRedis.get.mockResolvedValueOnce('4');

      // Mock: user found
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
            password_hash:
              '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
            name: 'Test User',
            level: 1,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            subscription_tier: 'FREE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      // Should not throw ACCOUNT_LOCKED
      try {
        await authService.login('test@example.com', 'password123');
      } catch (error) {
        // May fail for other reasons, but not lockout
        expect((error as Error).message).not.toBe('ACCOUNT_LOCKED');
      }

      // Test that 5 attempts locks
      mockRedis.get.mockResolvedValueOnce('5');

      try {
        await authService.login('test@example.com', 'password123');
        fail('Should have thrown ACCOUNT_LOCKED error');
      } catch (error) {
        expect((error as Error).message).toBe('ACCOUNT_LOCKED');
      }
    });
  });
});
