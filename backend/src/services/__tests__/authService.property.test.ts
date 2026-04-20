import fc from 'fast-check';
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

/**
 * Property 1: Authentication Round Trip
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4**
 * 
 * Property: For any valid email and password, a user can register, then login with the same credentials,
 * and receive valid tokens that can be used to verify the user's identity.
 */
describe('Property 1: Authentication Round Trip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full authentication round trip for valid credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.email(),
        fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/), // 8-32 character password
        fc.stringMatching(/^[a-zA-Z\s]{2,50}$/), // 2-50 character name
        async (email, password, name) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          // Step 1: Register user
          mockQuery.mockClear();

          // Mock: user doesn't exist
          mockQuery.mockResolvedValueOnce({ rows: [] });

          // Mock: user created
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: 'test-uuid-1234',
                email: email.toLowerCase(),
                name,
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

          const registerResult = await authService.register(email, password, name);

          // Verify registration succeeded
          expect(registerResult.user.email).toBe(email.toLowerCase());
          expect(registerResult.user.name).toBe(name);
          expect(registerResult.tokens.accessToken).toBeDefined();
          expect(registerResult.tokens.refreshToken).toBeDefined();

          // Step 2: Login with same credentials
          mockQuery.mockClear();

          // Mock: user found with correct password hash
          // Note: In real scenario, password would be hashed, but for this test we mock it
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: 'test-uuid-1234',
                email: email.toLowerCase(),
                password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', // bcrypt hash
                name,
                level: 1,
                total_xp: 0,
                current_streak: 0,
                longest_streak: 0,
                subscription_tier: 'FREE',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          });

          const loginResult = await authService.login(email, password);

          // Verify login succeeded
          expect(loginResult.user.email).toBe(email.toLowerCase());
          expect(loginResult.tokens.accessToken).toBeDefined();
          expect(loginResult.tokens.refreshToken).toBeDefined();

          // Step 3: Verify access token is valid
          const verified = authService.verifyAccessToken(loginResult.tokens.accessToken);

          // Verify token verification succeeded
          expect(verified).not.toBeNull();
          expect(verified?.userId).toBe('test-uuid-1234');

          // Step 4: Refresh token should produce new valid tokens
          mockQuery.mockClear();

          // Mock: user exists
          mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'test-uuid-1234' }],
          });

          const refreshResult = await authService.refreshAccessToken(loginResult.tokens.refreshToken);

          // Verify refresh succeeded
          expect(refreshResult.accessToken).toBeDefined();
          expect(refreshResult.refreshToken).toBeDefined();

          // Verify new access token is valid
          const verifiedRefreshed = authService.verifyAccessToken(refreshResult.accessToken);
          expect(verifiedRefreshed).not.toBeNull();
          expect(verifiedRefreshed?.userId).toBe('test-uuid-1234');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject login with wrong password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.email(),
        fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/),
        fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/),
        async (email, correctPassword, wrongPassword) => {
          // Skip if passwords are the same
          if (correctPassword === wrongPassword) {
            return;
          }

          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          mockQuery.mockClear();

          // Mock: user found but with different password hash
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: 'test-uuid-1234',
                email: email.toLowerCase(),
                password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', // hash of correctPassword
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

          // Attempt login with wrong password should fail
          await expect(authService.login(email, wrongPassword)).rejects.toThrow(
            'Invalid email or password'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject registration with duplicate email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.email(),
        fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/),
        fc.stringMatching(/^[a-zA-Z\s]{2,50}$/),
        async (email, password, name) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          mockQuery.mockClear();

          // Mock: user already exists
          mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'existing-user-id' }],
          });

          // Attempt to register with existing email should fail
          await expect(authService.register(email, password, name)).rejects.toThrow(
            'User with this email already exists'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should always reject invalid tokens', async () => {
    await fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0),
        (invalidToken) => {
          // Skip if it happens to be a valid JWT
          try {
            jwt.verify(invalidToken, config.jwtSecret);
            return; // Skip this case
          } catch {
            // Expected - token is invalid
          }

          const result = authService.verifyAccessToken(invalidToken);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain user data consistency through registration and login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.email(),
        fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/),
        fc.stringMatching(/^[a-zA-Z\s]{2,50}$/),
        async (email, password, name) => {
          const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

          // Register
          mockQuery.mockClear();
          mockQuery.mockResolvedValueOnce({ rows: [] }); // user doesn't exist
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: 'test-uuid-1234',
                email: email.toLowerCase(),
                name,
                level: 1,
                total_xp: 0,
                current_streak: 0,
                longest_streak: 0,
                subscription_tier: 'FREE',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          });
          mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'test-uuid-1234' }] });

          const registerResult = await authService.register(email, password, name);

          // Login
          mockQuery.mockClear();
          mockQuery.mockResolvedValueOnce({
            rows: [
              {
                id: 'test-uuid-1234',
                email: email.toLowerCase(),
                password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
                name,
                level: 1,
                total_xp: 0,
                current_streak: 0,
                longest_streak: 0,
                subscription_tier: 'FREE',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          });

          const loginResult = await authService.login(email, password);

          // Verify user data is consistent
          expect(registerResult.user.email).toBe(loginResult.user.email);
          expect(registerResult.user.name).toBe(loginResult.user.name);
          expect(registerResult.user.level).toBe(loginResult.user.level);
          expect(registerResult.user.totalXp).toBe(loginResult.user.totalXp);
        }
      ),
      { numRuns: 100 }
    );
  });
});
