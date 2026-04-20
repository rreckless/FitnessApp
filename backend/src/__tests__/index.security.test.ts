import request from 'supertest';
import app from '../index';

describe('Server - HTTPS Enforcement and Security Headers (Fix 2.5)', () => {
  describe('Security headers', () => {
    it('should include HSTS header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
      expect(response.headers['strict-transport-security']).toContain('preload');
    });

    it('should include CSP header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-XSS-Protection header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should have HSTS max-age of 1 year', async () => {
      const response = await request(app).get('/health');

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toContain('max-age=31536000'); // 1 year in seconds
    });

    it('should have CSP with restrictive defaults', async () => {
      const response = await request(app).get('/health');

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("style-src 'self'");
      expect(cspHeader).toContain("img-src 'self' https:");
      expect(cspHeader).toContain("connect-src 'self'");
    });

    it('should apply security headers to all endpoints', async () => {
      const endpoints = ['/health', '/auth/login', '/sync/status'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);

        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
      }
    });
  });

  describe('HTTPS enforcement in production', () => {
    it('should include HSTS header for HTTPS enforcement', async () => {
      const response = await request(app).get('/health');

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader).toContain('max-age=31536000');
      expect(hstsHeader).toContain('includeSubDomains');
      expect(hstsHeader).toContain('preload');
    });

    it('should have CSP that restricts external resources', async () => {
      const response = await request(app).get('/health');

      const cspHeader = response.headers['content-security-policy'];
      // Should not allow external scripts
      expect(cspHeader).not.toContain('script-src *');
      expect(cspHeader).not.toContain('script-src https:');
    });

    it('should deny framing with X-Frame-Options', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent MIME type sniffing', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Health check endpoint', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should have security headers on health endpoint', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('should include security headers on 404 response', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
