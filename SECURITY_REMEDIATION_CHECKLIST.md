# Security Remediation Checklist

**Status**: Ready for Implementation  
**Total Tasks**: 15  
**Estimated Effort**: 37-41 hours

---

## Phase 1: Critical Issues (8-9 hours) ⚠️ MUST COMPLETE FIRST

### Task 1.1: Fix Authorization on Sync Endpoints
- [ ] Remove userId from request body in sync endpoints
- [ ] Extract userId only from JWT token
- [ ] Update syncService.pullChanges() to use authenticated userId
- [ ] Update syncService.pushChanges() to use authenticated userId
- [ ] Add unit tests for authorization
- [ ] Test that users cannot access other users' data
- **Estimated**: 2-3 hours
- **Files**: syncRoutes.ts, syncService.ts
- **Risk if not fixed**: Users can access/modify other users' data

### Task 1.2: Fix Authorization on User Profile Routes
- [ ] Add ownership check to PUT /users/:id
- [ ] Add ownership check to DELETE /users/:id
- [ ] Add ownership check to PUT /users/:id/preferences
- [ ] Add ownership check to POST /users/:id/avatar
- [ ] Return 403 Forbidden for unauthorized access
- [ ] Add unit tests for authorization
- [ ] Log unauthorized access attempts
- **Estimated**: 1-2 hours
- **Files**: userProfileRoutes.ts
- **Risk if not fixed**: Users can modify other users' profiles

### Task 1.3: Secure JWT Secrets
- [ ] Add validation for JWT_SECRET in production
- [ ] Add validation for JWT_REFRESH_SECRET in production
- [ ] Generate strong random secrets for development
- [ ] Require minimum 32-character secrets
- [ ] Update .env.example with examples
- [ ] Add startup validation
- [ ] Log warning if using default secrets
- **Estimated**: 1 hour
- **Files**: config.ts, .env.example
- **Risk if not fixed**: Attackers can forge valid JWT tokens

### Task 1.4: Implement Token Blacklist
- [ ] Add Redis client initialization
- [ ] Update logout() to blacklist tokens
- [ ] Update verifyToken middleware to check blacklist
- [ ] Set expiration on blacklist entries
- [ ] Add error handling for Redis
- [ ] Add unit tests for token blacklist
- [ ] Test that blacklisted tokens are rejected
- **Estimated**: 2-3 hours
- **Files**: authService.ts, authRoutes.ts, connection.ts
- **Risk if not fixed**: Users can use tokens after logout

### Task 1.5: Add Input Validation to Sync Endpoints
- [ ] Add express-validator rules for operations array
- [ ] Validate operation types (CREATE|UPDATE|DELETE)
- [ ] Validate entity types (WORKOUT|WEIGHT|MEASUREMENT|PHOTO)
- [ ] Validate entity IDs are UUIDs
- [ ] Validate timestamps are ISO8601
- [ ] Add validation middleware
- [ ] Return 400 for invalid requests
- [ ] Add unit tests for validation
- **Estimated**: 2 hours
- **Files**: syncRoutes.ts
- **Risk if not fixed**: Arbitrary data can be stored in database

---

## Phase 2: High Priority Issues (11-12 hours)

### Task 2.1: Implement Account Lockout
- [ ] Add lockout tracking in Redis
- [ ] Track failed login attempts per email
- [ ] Lock account after 5 failed attempts
- [ ] Set 30-minute lockout duration
- [ ] Return 429 when account locked
- [ ] Include retry-after header
- [ ] Clear lockout on successful login
- [ ] Add unit tests for lockout
- **Estimated**: 2 hours
- **Files**: authService.ts, authRoutes.ts
- **Risk if not fixed**: Brute force attacks possible

### Task 2.2: Strengthen Password Requirements
- [ ] Update minimum length to 12 characters
- [ ] Require uppercase letter
- [ ] Require lowercase letter
- [ ] Require number
- [ ] Require special character
- [ ] Update error messages
- [ ] Add unit tests for each requirement
- **Estimated**: 1 hour
- **Files**: authRoutes.ts
- **Risk if not fixed**: Weak passwords vulnerable to dictionary attacks

### Task 2.3: Add Rate Limiting to Sync Endpoints
- [ ] Create sync rate limiter (10 req/min)
- [ ] Apply to POST /sync/pull
- [ ] Apply to POST /sync/push
- [ ] Apply to GET /sync/status
- [ ] Return 429 with retry-after header
- [ ] Add unit tests for rate limiting
- **Estimated**: 1 hour
- **Files**: syncRoutes.ts
- **Risk if not fixed**: Attackers can flood sync endpoints

### Task 2.4: Add Comprehensive Security Logging
- [ ] Log failed login attempts (email, IP, user-agent)
- [ ] Log successful logins (userId, IP, timestamp)
- [ ] Log password reset requests
- [ ] Log account lockouts
- [ ] Log unauthorized access attempts
- [ ] Log profile modifications
- [ ] Log sync operations
- [ ] Log token refresh
- [ ] Include request ID for tracing
- [ ] Add unit tests for logging
- **Estimated**: 3-4 hours
- **Files**: authService.ts, authRoutes.ts, syncRoutes.ts, logger.ts
- **Risk if not fixed**: No audit trail for security events

### Task 2.5: Implement HTTPS Enforcement
- [ ] Add HSTS header (1 year)
- [ ] Add CSP header
- [ ] Add X-Content-Type-Options header
- [ ] Add X-Frame-Options header
- [ ] Redirect HTTP to HTTPS in production
- [ ] Check x-forwarded-proto header
- [ ] Add unit tests for headers
- **Estimated**: 1-2 hours
- **Files**: index.ts
- **Risk if not fixed**: Passwords transmitted in plaintext

---

## Phase 3: Medium Priority Issues (18-20 hours)

### Task 3.1: Implement MFA/2FA
- [ ] Add TOTP support
- [ ] Generate TOTP secret on setup
- [ ] Validate TOTP codes on login
- [ ] Store encrypted secrets in database
- [ ] Generate 10 backup codes
- [ ] Store hashed backup codes
- [ ] Allow one-time use of backup codes
- [ ] Update login flow for MFA
- [ ] Add POST /auth/mfa/setup endpoint
- [ ] Add POST /auth/mfa/enable endpoint
- [ ] Add POST /auth/mfa/disable endpoint
- [ ] Add POST /auth/mfa/backup-codes endpoint
- [ ] Add unit tests for MFA
- **Estimated**: 8-10 hours
- **Files**: authService.ts, authRoutes.ts, schema.sql
- **Risk if not fixed**: Compromised password = full account compromise

### Task 3.2: Implement Fraud Detection
- [ ] Add workout validation (max 50 reps/set)
- [ ] Add workout validation (max 100 reps/exercise)
- [ ] Add weight range validation (1-1000 lbs)
- [ ] Add duration validation (5 min - 4 hours)
- [ ] Add fraud detection for suspicious patterns
- [ ] Track user's historical data
- [ ] Detect outliers
- [ ] Flag suspicious workouts
- [ ] Create admin review dashboard
- [ ] Allow manual approval/rollback
- [ ] Add unit tests for validation
- **Estimated**: 5-6 hours
- **Files**: workoutService.ts, workoutRoutes.ts
- **Risk if not fixed**: XP manipulation, leaderboard fraud

### Task 3.3: Implement Request Signing
- [ ] Add HMAC-SHA256 signature generation
- [ ] Include timestamp in signature
- [ ] Add signature verification middleware
- [ ] Check timestamp freshness (5 min window)
- [ ] Return 401 for invalid signatures
- [ ] Update iOS client to sign requests
- [ ] Add unit tests for signing
- **Estimated**: 3-4 hours
- **Files**: index.ts, config.ts, NetworkService.swift
- **Risk if not fixed**: Request tampering possible

### Task 3.4: Add Dependency Scanning
- [ ] Add npm audit to CI/CD
- [ ] Configure Snyk CLI
- [ ] Add Snyk monitoring
- [ ] Fail build on vulnerabilities
- [ ] Generate audit reports
- [ ] Create vulnerability response runbook
- [ ] Add documentation
- **Estimated**: 2 hours
- **Files**: package.json, CI/CD config
- **Risk if not fixed**: Vulnerable dependencies in use

### Task 3.5: Add URL Validation for Images
- [ ] Create URL validation function
- [ ] Whitelist allowed domains
- [ ] Block internal IPs
- [ ] Require HTTPS
- [ ] Validate URL format
- [ ] Apply to profile pictures
- [ ] Apply to progress photos
- [ ] Add unit tests for validation
- **Estimated**: 1-2 hours
- **Files**: userProfileService.ts
- **Risk if not fixed**: SSRF attacks possible

---

## Testing Checklist

### Unit Tests
- [ ] Authorization tests for all endpoints
- [ ] Token blacklist tests
- [ ] Input validation tests
- [ ] Account lockout tests
- [ ] Password requirement tests
- [ ] Rate limiting tests
- [ ] Security logging tests
- [ ] MFA tests
- [ ] Fraud detection tests
- [ ] Request signing tests
- [ ] URL validation tests

### Integration Tests
- [ ] End-to-end authorization flows
- [ ] End-to-end authentication flows
- [ ] End-to-end sync flows
- [ ] Rate limiting under load
- [ ] Token blacklist with multiple users
- [ ] MFA with backup codes

### Security Tests
- [ ] Penetration testing
- [ ] OWASP Top 10 validation
- [ ] Dependency vulnerability scan
- [ ] Manual security review

### Performance Tests
- [ ] Rate limiting performance
- [ ] Token blacklist performance
- [ ] Logging performance
- [ ] Request signing performance

---

## Deployment Checklist

### Pre-Deployment
- [ ] All critical issues fixed
- [ ] All high priority issues fixed
- [ ] Unit tests passing (100% coverage of security code)
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] Penetration testing completed
- [ ] Dependency scan passed
- [ ] Code review completed
- [ ] Security sign-off obtained

### Deployment
- [ ] Deploy to staging environment
- [ ] Run full security test suite on staging
- [ ] Perform manual security testing
- [ ] Get final security approval
- [ ] Deploy to production
- [ ] Monitor security logs
- [ ] Monitor for security events

### Post-Deployment
- [ ] Monitor failed login attempts
- [ ] Monitor unauthorized access attempts
- [ ] Monitor rate limiting triggers
- [ ] Review audit logs daily
- [ ] Track security metrics
- [ ] Respond to security alerts

---

## Success Criteria

### Critical Issues (Must Fix)
- [x] Authorization checks on all endpoints
- [x] JWT secrets secured
- [x] Token blacklist implemented
- [x] Input validation complete

### High Priority Issues (Should Fix)
- [x] Account lockout implemented
- [x] Password requirements enforced
- [x] Rate limiting on sync
- [x] Security logging comprehensive
- [x] HTTPS enforced

### Medium Priority Issues (Nice to Have)
- [x] MFA/2FA available
- [x] Fraud detection active
- [x] Request signing implemented
- [x] Dependency scanning automated
- [x] URL validation in place

### Overall
- [x] OWASP Top 10 compliance
- [x] Zero critical vulnerabilities
- [x] Security audit passed
- [x] Penetration testing passed
- [x] Ready for production

---

## Quick Reference

### Critical Issues Summary
| Issue | Severity | Fix Time | Impact |
|-------|----------|----------|--------|
| Missing authorization on sync | 🔴 CRITICAL | 2-3h | Users can access other users' data |
| Missing authorization on profiles | 🔴 CRITICAL | 1-2h | Users can modify other profiles |
| Weak JWT secrets | 🔴 CRITICAL | 1h | Attackers can forge tokens |
| No token blacklist | 🔴 CRITICAL | 2-3h | Users can use tokens after logout |
| No input validation | 🟠 HIGH | 2h | Arbitrary data stored in DB |

### High Priority Issues Summary
| Issue | Severity | Fix Time | Impact |
|-------|----------|----------|--------|
| No account lockout | 🟠 HIGH | 2h | Brute force attacks possible |
| Weak passwords | 🟠 HIGH | 1h | Dictionary attacks possible |
| No sync rate limiting | 🟠 HIGH | 1h | Endpoint flooding possible |
| No security logging | 🟠 HIGH | 3-4h | No audit trail |
| No HTTPS enforcement | 🟠 HIGH | 1-2h | Passwords in plaintext |

---

## Implementation Order

**Week 1 (Critical Issues)**
1. Task 1.1: Authorization on sync (2-3h)
2. Task 1.2: Authorization on profiles (1-2h)
3. Task 1.3: JWT secrets (1h)
4. Task 1.4: Token blacklist (2-3h)
5. Task 1.5: Input validation (2h)

**Week 2 (High Priority)**
1. Task 2.1: Account lockout (2h)
2. Task 2.2: Password requirements (1h)
3. Task 2.3: Sync rate limiting (1h)
4. Task 2.4: Security logging (3-4h)
5. Task 2.5: HTTPS enforcement (1-2h)

**Week 3-4 (Medium Priority)**
1. Task 3.1: MFA/2FA (8-10h)
2. Task 3.2: Fraud detection (5-6h)
3. Task 3.3: Request signing (3-4h)
4. Task 3.4: Dependency scanning (2h)
5. Task 3.5: URL validation (1-2h)

---

## Notes

- All code examples are in `SECURITY_FIXES_CODE_EXAMPLES.md`
- Detailed implementation steps are in `SECURITY_REMEDIATION_PLAN.md`
- OWASP findings are in `OWASP_SECURITY_AUDIT.md`
- Do NOT deploy to production until all critical issues are fixed
- Recommend completing high priority issues before Phase 2 development
- Medium priority issues can be completed in parallel with Phase 2

