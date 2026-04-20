import * as mfaService from '../mfaService';
import * as connection from '../../database/connection';
import speakeasy from 'speakeasy';

// Mock the database connection
jest.mock('../../database/connection');

// Mock speakeasy
jest.mock('speakeasy');

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test'),
}));

describe('MFA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMFASecret', () => {
    it('should generate TOTP secret and QR code', async () => {
      const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
      mockSpeakeasy.generateSecret.mockReturnValue({
        base32: 'JBSWY3DPEBLW64TMMQ======',
        otpauth_url: 'otpauth://totp/FitQuest%20(test%40example.com)?secret=JBSWY3DPEBLW64TMMQ%3D%3D%3D%3D%3D%3D&issuer=FitQuest',
      } as any);

      const result = await mfaService.generateMFASecret('user-123', 'test@example.com');

      expect(result.secret).toBe('JBSWY3DPEBLW64TMMQ======');
      expect(result.qrCode).toBeDefined();
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should throw error if secret generation fails', async () => {
      const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
      mockSpeakeasy.generateSecret.mockReturnValue({
        base32: undefined,
      } as any);

      await expect(mfaService.generateMFASecret('user-123', 'test@example.com')).rejects.toThrow(
        'Failed to generate TOTP secret'
      );
    });
  });

  describe('verifyTOTPCode', () => {
    it('should verify valid TOTP code', () => {
      const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
      mockSpeakeasy.totp.verify.mockReturnValue(true);

      const result = mfaService.verifyTOTPCode('JBSWY3DPEBLW64TMMQ======', '123456');

      expect(result).toBe(true);
      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEBLW64TMMQ======',
        encoding: 'base32',
        token: '123456',
        window: 2,
      });
    });

    it('should reject invalid TOTP code', () => {
      const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = mfaService.verifyTOTPCode('JBSWY3DPEBLW64TMMQ======', '000000');

      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
      mockSpeakeasy.totp.verify.mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = mfaService.verifyTOTPCode('JBSWY3DPEBLW64TMMQ======', '123456');

      expect(result).toBe(false);
    });
  });

  describe('enableMFA', () => {
    it('should enable MFA for user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      mockClient.query.mockResolvedValue({ rows: [] });

      await mfaService.enableMFA('user-123', 'JBSWY3DPEBLW64TMMQ======', [
        'CODE00001',
        'CODE00002',
      ]);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        mfaService.enableMFA('user-123', 'JBSWY3DPEBLW64TMMQ======', ['CODE00001'])
      ).rejects.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA for user', async () => {
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      mockClient.query.mockResolvedValue({ rows: [] });

      await mfaService.disableMFA('user-123');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getMFASettings', () => {
    it('should get MFA settings for user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValue({
        rows: [
          {
            user_id: 'user-123',
            totp_enabled: true,
            backup_codes_generated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const result = await mfaService.getMFASettings('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        totpEnabled: true,
        backupCodesGeneratedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should return null if MFA not set up', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValue({ rows: [] });

      const result = await mfaService.getMFASettings('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getTOTPSecret', () => {
    it('should get TOTP secret for user', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValue({
        rows: [
          {
            totp_secret: 'JBSWY3DPEBLW64TMMQ======',
          },
        ],
      });

      const result = await mfaService.getTOTPSecret('user-123');

      expect(result).toBe('JBSWY3DPEBLW64TMMQ======');
    });

    it('should return null if MFA not enabled', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValue({ rows: [] });

      const result = await mfaService.getTOTPSecret('user-123');

      expect(result).toBeNull();
    });
  });

  describe('verifyAndUseBackupCode', () => {
    it('should verify and use backup code', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Mock: get backup codes
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'code-123',
            code_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', // bcrypt hash
          },
        ],
      });

      // Mock: update backup code
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await mfaService.verifyAndUseBackupCode('user-123', 'CODE00001');

      expect(result).toBe(true);
    });

    it('should return false for invalid backup code', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'code-123',
            code_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
          },
        ],
      });

      const result = await mfaService.verifyAndUseBackupCode('user-123', 'INVALID');

      expect(result).toBe(false);
    });
  });

  describe('getBackupCodesCount', () => {
    it('should get count of unused backup codes', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValue({
        rows: [
          {
            count: '8',
          },
        ],
      });

      const result = await mfaService.getBackupCodesCount('user-123');

      expect(result).toBe(8);
    });
  });

  describe('generateNewBackupCodes', () => {
    it('should generate new backup codes', async () => {
      const mockConnect = jest.fn();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);
      (connection.query as any).connect = mockConnect;

      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await mfaService.generateNewBackupCodes('user-123');

      expect(result).toHaveLength(10);
      expect(result[0]).toMatch(/^[A-Z0-9]{8}$/);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
