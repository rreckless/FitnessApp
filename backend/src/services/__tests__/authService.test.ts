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

describe('Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user doesn't exist
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Mock: user created
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            email: 'test@example.com',
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

      // Mock: preferences created
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'test-uuid-1234' }] });

      const result = await authService.register('test@example.com', 'password123', 'Test User');

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.user.level).toBe(1);
      expect(result.user.totalXp).toBe(0);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject registration with short password', async () => {
      await expect(
        authService.register('test@example.com', 'short', 'Test User')
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should reject registration with missing email', async () => {
      await expect(authService.register('', 'password123', 'Test User')).rejects.toThrow(
        'Email, password, and name are required'
      );
    });

    it('should reject registration if user already exists', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }],
      });

      await expect(
        authService.register('existing@example.com', 'password123', 'Test User')
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user found
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

      const result = await authService.login('test@example.com', 'password123');

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(authService.login('nonexistent@example.com', 'password123')).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should reject login with missing credentials', async () => {
      await expect(authService.login('', 'password123')).rejects.toThrow(
        'Email and password are required'
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Create a valid refresh token
      const refreshToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'refresh' },
        config.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      // Mock: user exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'test-uuid-1234' }],
      });

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should reject refresh token for non-existent user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Create a valid refresh token
      const refreshToken = jwt.sign(
        { userId: 'nonexistent-user', type: 'refresh' },
        config.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      // Mock: user not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const result = await authService.logout('test-uuid-1234');
      expect(result).toBeUndefined();
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset for existing user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'test-uuid-1234' }],
      });

      const result = await authService.requestPasswordReset('test@example.com');

      expect(result.resetToken).toBeDefined();
    });

    it('should not reveal if email exists (security)', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: user not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.requestPasswordReset('nonexistent@example.com');

      expect(result.resetToken).toBe('token-sent-if-email-exists');
    });
  });

  describe('confirmPasswordReset', () => {
    it('should confirm password reset successfully', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Create a valid reset token
      const resetToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'password-reset' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      // Mock: password updated
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'test-uuid-1234' }],
      });

      const result = await authService.confirmPasswordReset(resetToken, 'newpassword123');

      expect(result.success).toBe(true);
    });

    it('should reject invalid reset token', async () => {
      await expect(authService.confirmPasswordReset('invalid-token', 'newpassword123')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should reject short password', async () => {
      const resetToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'password-reset' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      await expect(authService.confirmPasswordReset(resetToken, 'short')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const accessToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const result = authService.verifyAccessToken(accessToken);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('test-uuid-1234');
    });

    it('should reject invalid access token', () => {
      const result = authService.verifyAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject refresh token as access token', () => {
      const refreshToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'refresh' },
        config.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      const result = authService.verifyAccessToken(refreshToken);

      expect(result).toBeNull();
    });
  });
});
