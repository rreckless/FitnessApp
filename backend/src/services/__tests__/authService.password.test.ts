import * as authService from '../authService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

describe('Authentication Service - Strong Password Requirements (Fix 2.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Password validation on registration', () => {
    it('should reject password shorter than 12 characters', async () => {
      await expect(
        authService.register('test@example.com', 'Short1!', 'Test User')
      ).rejects.toThrow('Password must be at least 12 characters');
    });

    it('should reject password without uppercase letter', async () => {
      await expect(
        authService.register('test@example.com', 'lowercase123!', 'Test User')
      ).rejects.toThrow('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', async () => {
      await expect(
        authService.register('test@example.com', 'UPPERCASE123!', 'Test User')
      ).rejects.toThrow('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', async () => {
      await expect(
        authService.register('test@example.com', 'NoNumbers!Abc', 'Test User')
      ).rejects.toThrow('Password must contain at least one number');
    });

    it('should reject password without special character', async () => {
      await expect(
        authService.register('test@example.com', 'NoSpecial123Abc', 'Test User')
      ).rejects.toThrow('Password must contain at least one special character');
    });

    it('should accept password with all requirements', async () => {
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

      const result = await authService.register(
        'test@example.com',
        'ValidPassword123!',
        'Test User'
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should accept various special characters', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '='];

      for (const char of specialChars) {
        jest.clearAllMocks();

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

        const password = `ValidPassword123${char}`;
        const result = await authService.register('test@example.com', password, 'Test User');

        expect(result.user.email).toBe('test@example.com');
      }
    });

    it('should accept exactly 12 character password with all requirements', async () => {
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

      // Exactly 12 characters: Aa1!Aa1!Aa1!
      const result = await authService.register(
        'test@example.com',
        'Aa1!Aa1!Aa1!',
        'Test User'
      );

      expect(result.user.email).toBe('test@example.com');
    });

    it('should accept long password with all requirements', async () => {
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

      const result = await authService.register(
        'test@example.com',
        'VeryLongPasswordWith123!AndMoreCharacters',
        'Test User'
      );

      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject 11 character password even with all other requirements', async () => {
      await expect(
        authService.register('test@example.com', 'Aa1!Aa1!Aa1', 'Test User')
      ).rejects.toThrow('Password must be at least 12 characters');
    });

    it('should validate all requirements in order', async () => {
      // Test that it checks length first
      await expect(
        authService.register('test@example.com', 'short', 'Test User')
      ).rejects.toThrow('Password must be at least 12 characters');

      // Test that it checks uppercase
      await expect(
        authService.register('test@example.com', 'lowercase123!', 'Test User')
      ).rejects.toThrow('Password must contain at least one uppercase letter');

      // Test that it checks lowercase
      await expect(
        authService.register('test@example.com', 'UPPERCASE123!', 'Test User')
      ).rejects.toThrow('Password must contain at least one lowercase letter');

      // Test that it checks number
      await expect(
        authService.register('test@example.com', 'NoNumbers!Abc', 'Test User')
      ).rejects.toThrow('Password must contain at least one number');

      // Test that it checks special character
      await expect(
        authService.register('test@example.com', 'NoSpecial123Abc', 'Test User')
      ).rejects.toThrow('Password must contain at least one special character');
    });
  });
});
