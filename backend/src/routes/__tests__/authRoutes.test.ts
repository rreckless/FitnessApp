import request from 'supertest';
import express from 'express';
import authRoutes, { verifyToken } from '../authRoutes';
import * as authService from '../../services/authService';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

// Mock the auth service
jest.mock('../../services/authService');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const mockRegister = authService.register as jest.MockedFunction<typeof authService.register>;

      mockRegister.mockResolvedValueOnce({
        user: {
          id: 'test-uuid-1234',
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
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should login user successfully', async () => {
      const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>;

      mockLogin.mockResolvedValueOnce({
        user: {
          id: 'test-uuid-1234',
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
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>;

      mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token', async () => {
      const mockRefresh = authService.refreshAccessToken as jest.MockedFunction<
        typeof authService.refreshAccessToken
      >;

      mockRefresh.mockResolvedValueOnce({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBe('new-access-token');
    });

    it('should reject invalid refresh token', async () => {
      const mockRefresh = authService.refreshAccessToken as jest.MockedFunction<
        typeof authService.refreshAccessToken
      >;

      mockRefresh.mockRejectedValueOnce(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user with valid token', async () => {
      const mockLogout = authService.logout as jest.MockedFunction<typeof authService.logout>;

      mockLogout.mockResolvedValueOnce();

      const accessToken = jwt.sign(
        { userId: 'test-uuid-1234', type: 'access' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing or invalid authorization header');
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('POST /auth/password-reset', () => {
    it('should request password reset', async () => {
      const mockReset = authService.requestPasswordReset as jest.MockedFunction<
        typeof authService.requestPasswordReset
      >;

      mockReset.mockResolvedValueOnce({
        resetToken: 'reset-token-123',
      });

      const response = await request(app)
        .post('/auth/password-reset')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/password-reset')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/password-reset/confirm', () => {
    it('should confirm password reset', async () => {
      const mockConfirm = authService.confirmPasswordReset as jest.MockedFunction<
        typeof authService.confirmPasswordReset
      >;

      mockConfirm.mockResolvedValueOnce({
        success: true,
      });

      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          resetToken: 'valid-reset-token',
          newPassword: 'newpassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          resetToken: 'valid-reset-token',
          newPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject invalid reset token', async () => {
      const mockConfirm = authService.confirmPasswordReset as jest.MockedFunction<
        typeof authService.confirmPasswordReset
      >;

      mockConfirm.mockRejectedValueOnce(new Error('Invalid or expired reset token'));

      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          resetToken: 'invalid-token',
          newPassword: 'newpassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired reset token');
    });
  });
});
