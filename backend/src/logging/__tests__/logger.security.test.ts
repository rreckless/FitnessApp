import { logger, SecurityEventType } from '../logger';

describe('Logger - Security Logging (Fix 2.4)', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Security event logging', () => {
    it('should log LOGIN_SUCCESS event', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('LOGIN_SUCCESS');
      expect(call[1]).toMatchObject({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should log LOGIN_FAILED event with reason', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: 'user-123',
        email: 'test@example.com',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        details: { reason: 'invalid_password' },
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('LOGIN_FAILED');
      expect(call[1]).toMatchObject({
        eventType: SecurityEventType.LOGIN_FAILED,
        details: { reason: 'invalid_password' },
      });
    });

    it('should log LOGIN_LOCKED event', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_LOCKED,
        email: 'test@example.com',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('LOGIN_LOCKED');
      expect(call[1]).toMatchObject({
        eventType: SecurityEventType.LOGIN_LOCKED,
        email: 'test@example.com',
      });
    });

    it('should log PASSWORD_RESET_REQUESTED event', () => {
      logger.security({
        eventType: SecurityEventType.PASSWORD_RESET_REQUESTED,
        userId: 'user-123',
        email: 'test@example.com',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('PASSWORD_RESET_REQUESTED');
    });

    it('should log PASSWORD_RESET_CONFIRMED event', () => {
      logger.security({
        eventType: SecurityEventType.PASSWORD_RESET_CONFIRMED,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('PASSWORD_RESET_CONFIRMED');
    });

    it('should log LOGOUT event', () => {
      logger.security({
        eventType: SecurityEventType.LOGOUT,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('LOGOUT');
    });

    it('should log SYNC_OPERATION event with details', () => {
      logger.security({
        eventType: SecurityEventType.SYNC_OPERATION,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        details: {
          operation: 'push',
          operationCount: 5,
          entityTypes: ['WORKOUT', 'WEIGHT'],
        },
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('SYNC_OPERATION');
      expect(call[1]).toMatchObject({
        details: {
          operation: 'push',
          operationCount: 5,
          entityTypes: ['WORKOUT', 'WEIGHT'],
        },
      });
    });

    it('should include timestamp in ISO format', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        timestamp: testDate,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1].timestamp).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should include request ID if provided', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        requestId: 'req-12345',
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1].requestId).toBe('req-12345');
    });

    it('should include IP address if provided', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        ip: '192.168.1.1',
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1].ip).toBe('192.168.1.1');
    });

    it('should include user-agent if provided', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        userAgent: 'Mozilla/5.0...',
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1].userAgent).toBe('Mozilla/5.0...');
    });

    it('should log all security event types', () => {
      const eventTypes = Object.values(SecurityEventType);

      eventTypes.forEach((eventType) => {
        consoleSpy.mockClear();

        logger.security({
          eventType,
          userId: 'user-123',
          timestamp: new Date(),
        });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain(eventType);
      });
    });

    it('should include SECURITY level in log', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1].level).toBe('SECURITY');
    });

    it('should handle optional fields gracefully', () => {
      logger.security({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toMatchObject({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: undefined,
        email: undefined,
        ip: undefined,
        userAgent: undefined,
        requestId: undefined,
      });
    });
  });
});
