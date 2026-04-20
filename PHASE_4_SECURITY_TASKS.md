# Phase 4: Low-Priority OWASP Security Fixes - IMPLEMENTATION PLAN

**Status**: ⏳ PENDING  
**Estimated Effort**: 3-4 hours  
**Priority**: LOW (but recommended before production)

---

## Overview

Phase 4 focuses on the remaining low-priority OWASP vulnerabilities:
- **A06:2021 - Vulnerable and Outdated Components**: Dependency scanning
- **A10:2021 - Server-Side Request Forgery (SSRF)**: URL validation for images

These are lower priority than Phases 1-3 but important for production readiness.

---

## Phase 4 Tasks

### Task 4.1: Add Dependency Scanning (2 hours)

**Severity**: 🟡 LOW  
**OWASP**: A06:2021 - Vulnerable and Outdated Components

**Issue**: No automated dependency vulnerability scanning

**Implementation Steps**:

#### 1. Add npm audit to CI/CD
```bash
# Run npm audit in CI/CD pipeline
npm audit

# Generate audit report
npm audit --json > audit-report.json

# Fail build on vulnerabilities
npm audit --audit-level=moderate
```

#### 2. Integrate Snyk
```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate with Snyk
snyk auth

# Test for vulnerabilities
snyk test

# Monitor for new vulnerabilities
snyk monitor
```

#### 3. Update package.json
```json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "snyk:test": "snyk test",
    "snyk:monitor": "snyk monitor"
  }
}
```

#### 4. CI/CD Configuration
Add to `.github/workflows/security.yml`:
```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm audit --audit-level=moderate
      - run: npm run snyk:test
```

#### 5. Documentation
- Create `DEPENDENCY_SCANNING.md` with:
  - How to run npm audit
  - How to fix vulnerabilities
  - Snyk integration guide
  - Vulnerability response process

**Files to Create**:
- `.github/workflows/security.yml`
- `DEPENDENCY_SCANNING.md`

**Files to Modify**:
- `backend/package.json`
- `backend/.github/workflows/security.yml`

**Tests**: No unit tests needed (automated scanning)

---

### Task 4.2: Add URL Validation for Images (1-2 hours)

**Severity**: 🟡 LOW  
**OWASP**: A10:2021 - Server-Side Request Forgery (SSRF)

**Issue**: No validation on image URLs, could allow SSRF attacks

**Implementation Steps**:

#### 1. Create URL Validation Service
```typescript
// backend/src/services/urlValidationService.ts

export function validateImageURL(url: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    // Parse URL
    const parsedURL = new URL(url);

    // Require HTTPS
    if (parsedURL.protocol !== 'https:') {
      return { isValid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Whitelist allowed domains
    const allowedDomains = [
      'fitquest-images.s3.amazonaws.com',
      'cdn.fitquest.com',
      'images.fitquest.com',
    ];

    const isAllowed = allowedDomains.some(domain => 
      parsedURL.hostname === domain || 
      parsedURL.hostname?.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { isValid: false, error: 'Domain not whitelisted' };
    }

    // Block internal IPs
    const internalIPs = ['127.0.0.1', 'localhost', '0.0.0.0'];
    if (internalIPs.includes(parsedURL.hostname)) {
      return { isValid: false, error: 'Internal IP addresses not allowed' };
    }

    // Block private IP ranges
    const privateIPPattern = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
    if (privateIPPattern.test(parsedURL.hostname)) {
      return { isValid: false, error: 'Private IP addresses not allowed' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}
```

#### 2. Add Validation to Profile Picture Upload
```typescript
// backend/src/routes/userProfileRoutes.ts

router.post(
  '/:id/avatar',
  verifyToken,
  [
    body('avatarURL')
      .custom((value) => {
        const validation = validateImageURL(value);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }
        return true;
      })
  ],
  async (req: Request, res: Response) => {
    // ... implementation
  }
);
```

#### 3. Add Validation to Progress Photos
```typescript
// backend/src/routes/bodyTrackingRoutes.ts

router.post(
  '/photos',
  verifyToken,
  [
    body('photoURL')
      .custom((value) => {
        const validation = validateImageURL(value);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }
        return true;
      })
  ],
  async (req: Request, res: Response) => {
    // ... implementation
  }
);
```

#### 4. Add Unit Tests
```typescript
// backend/src/services/__tests__/urlValidationService.test.ts

describe('URL Validation Service', () => {
  it('should accept valid HTTPS URLs from whitelisted domains', () => {
    const result = validateImageURL('https://fitquest-images.s3.amazonaws.com/photo.jpg');
    expect(result.isValid).toBe(true);
  });

  it('should reject HTTP URLs', () => {
    const result = validateImageURL('http://fitquest-images.s3.amazonaws.com/photo.jpg');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('HTTPS');
  });

  it('should reject non-whitelisted domains', () => {
    const result = validateImageURL('https://evil.com/photo.jpg');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('whitelisted');
  });

  it('should reject internal IP addresses', () => {
    const result = validateImageURL('https://127.0.0.1/photo.jpg');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Internal');
  });

  it('should reject private IP ranges', () => {
    const result = validateImageURL('https://192.168.1.1/photo.jpg');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Private');
  });

  it('should reject invalid URL format', () => {
    const result = validateImageURL('not-a-url');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid');
  });
});
```

**Files to Create**:
- `backend/src/services/urlValidationService.ts`
- `backend/src/services/__tests__/urlValidationService.test.ts`

**Files to Modify**:
- `backend/src/routes/userProfileRoutes.ts`
- `backend/src/routes/bodyTrackingRoutes.ts`

**Tests**: 6+ unit tests

---

## Implementation Timeline

### Week 1
- **Day 1**: Task 4.1 - Add npm audit to CI/CD
- **Day 2**: Task 4.1 - Integrate Snyk
- **Day 3**: Task 4.2 - Create URL validation service
- **Day 4**: Task 4.2 - Add validation to endpoints
- **Day 5**: Task 4.2 - Add unit tests

---

## Testing Strategy

### Automated Testing
```bash
# Run npm audit
npm audit

# Run Snyk test
snyk test

# Run unit tests
npm test -- urlValidationService

# Run all security tests
npm run test:security
```

### Manual Testing
- Test profile picture upload with valid URL
- Test profile picture upload with invalid URL
- Test progress photo upload with valid URL
- Test progress photo upload with invalid URL
- Test with internal IP addresses
- Test with private IP ranges

---

## Deployment Checklist

### Pre-Deployment
- [ ] npm audit passes with no critical/high vulnerabilities
- [ ] Snyk test passes
- [ ] All unit tests pass
- [ ] URL validation tests pass
- [ ] Code review completed
- [ ] Security team approval

### Deployment Steps
1. Deploy CI/CD configuration
2. Deploy URL validation service
3. Deploy updated routes
4. Run npm audit
5. Run Snyk test
6. Monitor for errors

### Post-Deployment
- Monitor npm audit results
- Monitor Snyk alerts
- Track URL validation rejections
- Review security logs

---

## Success Criteria

### Task 4.1: Dependency Scanning
- ✅ npm audit runs in CI/CD
- ✅ Snyk integration configured
- ✅ Build fails on critical/high vulnerabilities
- ✅ Vulnerability reports generated
- ✅ Documentation complete

### Task 4.2: URL Validation
- ✅ URL validation service implemented
- ✅ Validation applied to all image endpoints
- ✅ HTTPS enforcement working
- ✅ Domain whitelist working
- ✅ Internal IP blocking working
- ✅ Private IP blocking working
- ✅ All unit tests passing

---

## Known Limitations

### Dependency Scanning
- npm audit may have false positives
- Snyk requires paid subscription for advanced features
- Vulnerability fixes may require major version upgrades

### URL Validation
- Whitelist must be maintained manually
- DNS rebinding attacks not prevented
- Time-of-check-time-of-use (TOCTOU) race conditions possible

---

## Future Enhancements

### Phase 5 (Optional)
- [ ] Add Hardware Security Key support
- [ ] Implement WebAuthn/FIDO2
- [ ] Add IP whitelisting
- [ ] Implement device fingerprinting
- [ ] Add anomaly detection

---

## References

- [OWASP A06:2021 - Vulnerable and Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)
- [OWASP A10:2021 - Server-Side Request Forgery (SSRF)](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)
- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk Documentation](https://docs.snyk.io/)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

---

## Next Steps

1. **Implement Phase 4 Tasks**:
   - Add dependency scanning (npm audit, Snyk)
   - Add URL validation for images

2. **Run OWASP Security Audit**:
   - Use OWASP_SECURITY_CHECK_PROCESS.md
   - Verify all Phase 4 fixes
   - Document any remaining vulnerabilities

3. **Prepare for Production**:
   - Complete all security fixes
   - Run full security test suite
   - Conduct penetration testing
   - Get security team approval

4. **Begin Phase 2 Core Features**:
   - Workout logging
   - XP system
   - Streaks
   - Achievements
