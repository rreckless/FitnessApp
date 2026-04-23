/**
 * Authentication Models
 * Defines types and interfaces for authentication operations
 */

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  deviceFingerprint?: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  deviceFingerprint: string;
  createdAt: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DeviceFingerprint {
  deviceId: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  timestamp: number;
}

export enum AuthError {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}

export class AuthException extends Error {
  constructor(
    public code: AuthError,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthException';
  }
}
