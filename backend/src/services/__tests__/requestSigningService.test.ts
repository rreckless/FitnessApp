import * as signingService from '../requestSigningService';
import crypto from 'crypto';

describe('Request Signing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSignature', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const requestBody = { email: 'test@example.com', password: 'password123' };
      const timestamp = 1704067200;
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, timestamp, apiSecret);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex is 64 characters
    });

    it('should generate different signatures for different bodies', () => {
      const timestamp = 1704067200;
      const apiSecret = 'test-secret-key';

      const sig1 = signingService.generateSignature({ data: 'test1' }, timestamp, apiSecret);
      const sig2 = signingService.generateSignature({ data: 'test2' }, timestamp, apiSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different timestamps', () => {
      const requestBody = { data: 'test' };
      const apiSecret = 'test-secret-key';

      const sig1 = signingService.generateSignature(requestBody, 1704067200, apiSecret);
      const sig2 = signingService.generateSignature(requestBody, 1704067201, apiSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const requestBody = { data: 'test' };
      const timestamp = 1704067200;

      const sig1 = signingService.generateSignature(requestBody, timestamp, 'secret1');
      const sig2 = signingService.generateSignature(requestBody, timestamp, 'secret2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const requestBody = { email: 'test@example.com' };
      const timestamp = Math.floor(Date.now() / 1000);
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, timestamp, apiSecret);
      const result = signingService.verifySignature(requestBody, signature, timestamp, apiSecret);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const requestBody = { email: 'test@example.com' };
      const timestamp = Math.floor(Date.now() / 1000);
      const apiSecret = 'test-secret-key';

      const result = signingService.verifySignature(
        requestBody,
        'invalid-signature',
        timestamp,
        apiSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject signature with wrong secret', () => {
      const requestBody = { email: 'test@example.com' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = signingService.generateSignature(requestBody, timestamp, 'secret1');
      const result = signingService.verifySignature(
        requestBody,
        signature,
        timestamp,
        'secret2' // Different secret
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject signature with modified body', () => {
      const requestBody = { email: 'test@example.com' };
      const timestamp = Math.floor(Date.now() / 1000);
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, timestamp, apiSecret);

      const modifiedBody = { email: 'modified@example.com' };
      const result = signingService.verifySignature(
        modifiedBody,
        signature,
        timestamp,
        apiSecret
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject signature with future timestamp', () => {
      const requestBody = { email: 'test@example.com' };
      const futureTimestamp = Math.floor(Date.now() / 1000) + 100;
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, futureTimestamp, apiSecret);
      const result = signingService.verifySignature(
        requestBody,
        signature,
        futureTimestamp,
        apiSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should reject signature older than 5 minutes', () => {
      const requestBody = { email: 'test@example.com' };
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes old
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, oldTimestamp, apiSecret);
      const result = signingService.verifySignature(
        requestBody,
        signature,
        oldTimestamp,
        apiSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too old');
    });

    it('should accept signature within 5 minute window', () => {
      const requestBody = { email: 'test@example.com' };
      const recentTimestamp = Math.floor(Date.now() / 1000) - 200; // 3+ minutes old
      const apiSecret = 'test-secret-key';

      const signature = signingService.generateSignature(requestBody, recentTimestamp, apiSecret);
      const result = signingService.verifySignature(
        requestBody,
        signature,
        recentTimestamp,
        apiSecret
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('generateAPISecret', () => {
    it('should generate random API secret', () => {
      const secret1 = signingService.generateAPISecret();
      const secret2 = signingService.generateAPISecret();

      expect(secret1).toBeDefined();
      expect(secret2).toBeDefined();
      expect(secret1).not.toBe(secret2);
      expect(secret1).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });
  });

  describe('hashAPISecret', () => {
    it('should hash API secret', async () => {
      const secret = signingService.generateAPISecret();
      const hash = await signingService.hashAPISecret(secret);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(secret);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should generate different hashes for same secret', async () => {
      const secret = signingService.generateAPISecret();
      const hash1 = await signingService.hashAPISecret(secret);
      const hash2 = await signingService.hashAPISecret(secret);

      expect(hash1).not.toBe(hash2); // Different salts
    });
  });

  describe('verifyAPISecret', () => {
    it('should verify correct API secret', async () => {
      const secret = signingService.generateAPISecret();
      const hash = await signingService.hashAPISecret(secret);

      const isValid = await signingService.verifyAPISecret(secret, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect API secret', async () => {
      const secret = signingService.generateAPISecret();
      const hash = await signingService.hashAPISecret(secret);

      const isValid = await signingService.verifyAPISecret('wrong-secret', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('extractSignatureFromHeaders', () => {
    it('should extract signature and timestamp from headers', () => {
      const headers = {
        'x-signature': 'test-signature',
        'x-timestamp': '1704067200',
      };

      const result = signingService.extractSignatureFromHeaders(headers);

      expect(result.signature).toBe('test-signature');
      expect(result.timestamp).toBe(1704067200);
      expect(result.error).toBeUndefined();
    });

    it('should return error if signature missing', () => {
      const headers = {
        'x-timestamp': '1704067200',
      };

      const result = signingService.extractSignatureFromHeaders(headers);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('X-Signature');
    });

    it('should return error if timestamp missing', () => {
      const headers = {
        'x-signature': 'test-signature',
      };

      const result = signingService.extractSignatureFromHeaders(headers);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('X-Timestamp');
    });

    it('should return error if timestamp invalid', () => {
      const headers = {
        'x-signature': 'test-signature',
        'x-timestamp': 'invalid',
      };

      const result = signingService.extractSignatureFromHeaders(headers);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid X-Timestamp');
    });
  });

  describe('isReplayAttack', () => {
    it('should detect replay attack', async () => {
      const recentSignatures = new Map<string, Set<string>>();
      const userId = 'user-123';
      const signature = 'test-signature';
      const timestamp = Math.floor(Date.now() / 1000);

      // First request - not a replay
      const isReplay1 = await signingService.isReplayAttack(
        userId,
        signature,
        timestamp,
        recentSignatures
      );
      expect(isReplay1).toBe(false);

      // Second request with same signature - is a replay
      const isReplay2 = await signingService.isReplayAttack(
        userId,
        signature,
        timestamp,
        recentSignatures
      );
      expect(isReplay2).toBe(true);
    });

    it('should not detect replay for different signatures', async () => {
      const recentSignatures = new Map<string, Set<string>>();
      const userId = 'user-123';
      const timestamp = Math.floor(Date.now() / 1000);

      const isReplay1 = await signingService.isReplayAttack(
        userId,
        'signature-1',
        timestamp,
        recentSignatures
      );
      expect(isReplay1).toBe(false);

      const isReplay2 = await signingService.isReplayAttack(
        userId,
        'signature-2',
        timestamp,
        recentSignatures
      );
      expect(isReplay2).toBe(false);
    });

    it('should clean up old entries', async () => {
      const recentSignatures = new Map<string, Set<string>>();
      const userId = 'user-123';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 700; // 11+ minutes old

      await signingService.isReplayAttack(userId, 'signature-1', oldTimestamp, recentSignatures);

      // Old entry should be cleaned up
      expect(recentSignatures.size).toBe(0);
    });
  });
});
