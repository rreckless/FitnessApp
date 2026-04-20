# Security Remediation Plan - FitQuest

**Created**: April 20, 2026  
**Total Effort**: 37-41 hours  
**Priority**: CRITICAL - Must complete before production

---

## Phase 1: Critical Issues (8-9 hours) - MUST FIX FIRST

### Task 1.1: Fix Authorization on Sync Endpoints
**Severity**: 🔴 CRITICAL  
**Effort**: 2-3 hours  
**Files to Modify**:
- `backend/src/routes/syncRoutes.ts`
- `backend/src/services/syncService.ts`

**Changes Required**:
1. Remove `userId` from request body in sync endpoints
2. Extract `userId` only from JWT token
3. Pass authenticated `userId` to service methods
4. Add authorization checks in service layer

**Implementation Steps**:
```
1. Update syncRoutes.ts:
   - Remove userId from request body parsing
   - Extract userId from (req as any).userId
   - Pass only authenticated userId to syncService

2. Update syncService.ts:
   - Remove userId parameter from pullChanges()
   - Remove userId parameter from pushChanges()
   - Add userId parameter to constructor or as instance variable
   - Verify all queries filter by authenticated userId

3. Add unit tests:
   - Test that users cannot access other users' data
   - Test that userId from token is used, not request body
```

---

### Task 1.2: Fix Authorization on User Profile Routes
**Severity**: 🔴 CRITICAL  
**Effort**: 1-2 hours  
**Files to Modify**:
- `backend/src/routes/userProfileRoutes.ts`

**Changes Required**:
1. Add ownership check before any profile modification
2. Verify authenticated userId matches profile ID
3. Return 403 Forbidden if not owner

**Implementation Steps**:
```
1. Add authorization middleware:
   - Check if userId from token matches :id parameter
   - Return 403 if mismatch
   - Only allow users to modify their own profiles

2. Apply to all profile endpoints:
   - PUT /users/:id
   - DELETE /users/:id
   - PUT /users/:id/preferences
   - POST /users/:id/avatar

3. Add unit tests:
   - Test that users cannot modify other profiles
   - Test that 403 is returned for unauthorized access
```

---

### Task 1.3: Secure JWT Secrets
**Severity**: 🔴 CRITICAL  
**Effort**: 1 hour  
**Files to Modify**:
- `backend/src/config/config.ts`
- `backend/.env.example`

**Changes Required**:
1. Require JWT secrets in production
2. Generate strong random defaults for development
3. Add validation on startup

**Implementation Steps**:
```
1. Update config.ts:
   - Check if production environment
   - Throw error if JWT_SECRET not set
   - Use crypto.randomBytes for development defaults
   - Add minimum secret length validation (32 bytes)

2. Update .env.example:
   - Add JWT_SECRET and JWT_REFRESH_SECRET examples
   - Document that these are required in production

3. Add startup validation:
   - Log warning if using default secrets
   - Throw error in production if defaults used
```

---

### Task 1.4: Implement Token Blacklist
**Severity**: 🔴 CRITICAL  
**Effort**: 2-3 hours  
**Files to Modify**:
- `backend/src/services/authService.ts`
- `backend/src/routes/authRoutes.ts`
- `backend/src/database/connection.ts` (add Redis)

**Changes Required**:
1. Add Redis connection for token blacklist
2. Blacklist tokens on logout
3. Check blacklist in verifyToken middleware
4. Set expiration on blacklist entries

**Implementation Steps**:
```
1. Add Redis client:
   - Initialize Redis connection in connection.ts
   - Add error handling and reconnection logic

2. Update logout function:
   - Extract token from request
   - Add token to Redis blacklist
   - Set expiration = JWT token expiration time

3. Update verifyToken middleware:
   - Check if token is in blacklist
   - Return 401 if blacklisted
   - Continue if not blacklisted

4. Add unit tests:
   - Test that logout blacklists token
   - Test that blacklisted tokens are rejected
   - Test that blacklist entries expire
```

---

### Task 1.5: Add Input Validation to Sync Endpoints
**Severity**: 🟠 HIGH  
**Effort**: 2 hours  
**Files to Modify**:
- `backend/src/routes/syncRoutes.ts`

**Changes Required**:
1. Validate operations array structure
2. Validate each operation's fields
3. Validate entity types and IDs
4. Validate timestamps

**Implementation Steps**:
```
1. Add express-validator rules:
   - operations must be array
   - Each operation must have required fields
   - operation must be CREATE|UPDATE|DELETE
   - entityType must be WORKOUT|WEIGHT|MEASUREMENT|PHOTO
   - entityId must be valid UUID
   - clientTimestamp must be ISO8601 date

2. Add validation middleware:
   - Check validationResult
   - Return 400 with errors if invalid
   - Log validation failures

3. Add unit tests:
   - Test invalid operation types
   - Test invalid entity types
   - Test invalid UUIDs
   - Test missing required fields
```

---

## Phase 2: High Priority Issues (11-12 hours)

### Task 2.1: Implement Account Lockout
**Severity**: 🟠 HIGH  
**Effort**: 2 hours  
**Files to Modify**:
- `backend/src/services/authService.ts`
- `backend/src/database/connection.ts` (Redis)

**Implementation Steps**:
```
1. Add lockout tracking:
   - Track failed login attempts per email
   - Store in Redis with 30-minute expiration
   - Increment counter on failed attempt

2. Add lockout check:
   - Check lockout counter before login
   - Return 429 if locked out
   - Include retry-after header

3. Clear lockout on success:
   - Delete lockout counter on successful login
   - Log successful login after lockout

4. Add unit tests:
   - Test lockout after 5 failed attempts
   - Test 429 response when locked
   - Test lockout expiration
   - Test counter reset on success
```

---

### Task 2.2: Strengthen Password Requirements
**Severity**: 🟠 HIGH  
**Effort**: 1 hour  
**Files to Modify**:
- `backend/src/routes/authRoutes.ts`

**Implementation Steps**:
```
1. Update password validation:
   - Minimum 12 characters (was 8)
   - Require uppercase letter
   - Require lowercase letter
   - Require number
   - Require special character (!@#$%^&*)

2. Update error messages:
   - Clear feedback on what's missing
   - Help users create strong passwords

3. Add unit tests:
   - Test each requirement individually
   - Test combinations of requirements
   - Test rejection of weak passwords
```

---

### Task 2.3: Add Rate Limiting to Sync Endpoints
**Severity**: 🟠 HIGH  
**Effort**: 1 hour  
**Files to Modify**:
- `backend/src/routes/syncRoutes.ts`

**Implementation Steps**:
```
1. Create sync rate limiter:
   - 10 requests per minute per user
   - Use Redis for distributed rate limiting
   - Return 429 with retry-after header

2. Apply to sync endpoints:
   - POST /sync/pull
   - POST /sync/push
   - GET /sync/status

3. Add unit tests:
   - Test rate limit enforcement
   - Test 429 response
   - Test retry-after header
```

---

### Task 2.4: Add Comprehensive Security Logging
**Severity**: 🟠 HIGH  
**Effort**: 3-4 hours  
**Files to Modify**:
- `backend/src/services/authService.ts`
- `backend/src/routes/authRoutes.ts`
- `backend/src/routes/syncRoutes.ts`
- `backend/src/logging/logger.ts`

**Implementation Steps**:
```
1. Log authentication events:
   - Failed login attempts (email, IP, user-agent)
   - Successful logins (userId, IP, timestamp)
   - Password reset requests (email, IP)
   - Account lockouts (email, IP, reason)

2. Log authorization failures:
   - Unauthorized access attempts (userId, resource, IP)
   - Permission denied events (userId, action, resource)

3. Log sensitive operations:
   - Profile modifications (userId, fields changed)
   - Sync operations (userId, entity count, conflicts)
   - Token refresh (userId, timestamp)

4. Add structured logging:
   - Include IP address
   - Include user-agent
   - Include timestamp
   - Include request ID for tracing

5. Add unit tests:
   - Test that events are logged
   - Test log format and content
   - Test sensitive data is not logged
```

---

### Task 2.5: Implement HTTPS Enforcement
**Severity**: 🟠 HIGH  
**Effort**: 1-2 hours  
**Files to Modify**:
- `backend/src/index.ts`
- `backend/src/config/config.ts`

**Implementation Steps**:
```
1. Add security headers:
   - HSTS (HTTP Strict-Transport-Security)
   - CSP (Content-Security-Policy)
   - X-Content-Type-Options
   - X-Frame-Options

2. Enforce HTTPS in production:
   - Redirect HTTP to HTTPS
   - Check x-forwarded-proto header
   - Only allow HTTPS connections

3. Add unit tests:
   - Test HTTPS redirect
   - Test security headers present
   - Test HSTS header
```

---

## Phase 3: Medium Priority Issues (18-20 hours)

### Task 3.1: Implement MFA/2FA
**Severity**: 🟠 HIGH  
**Effort**: 8-10 hours  
**Files to Modify**:
- `backend/src/services/authService.ts` (new)
- `backend/src/routes/authRoutes.ts`
- `backend/src/database/schema.sql`

**Implementation Steps**:
```
1. Add TOTP support:
   - Generate TOTP secret on MFA setup
   - Validate TOTP codes on login
   - Store encrypted secret in database

2. Add backup codes:
   - Generate 10 backup codes
   - Store hashed codes in database
   - Allow one-time use of backup codes

3. Update login flow:
   - After password verification, check if MFA enabled
   - Prompt for TOTP code
   - Allow backup code as fallback

4. Add MFA management endpoints:
   - POST /auth/mfa/setup - Generate secret
   - POST /auth/mfa/enable - Enable MFA
   - POST /auth/mfa/disable - Disable MFA
   - POST /auth/mfa/backup-codes - Generate new codes

5. Add unit tests:
   - Test TOTP generation and validation
   - Test backup code generation and use
   - Test MFA enforcement on login
   - Test backup code one-time use
```

---

### Task 3.2: Implement Fraud Detection
**Severity**: 🔴 CRITICAL (for Phase 2)  
**Effort**: 5-6 hours  
**Files to Modify**:
- `backend/src/services/workoutService.ts` (new)
- `backend/src/routes/workoutRoutes.ts`

**Implementation Steps**:
```
1. Add workout validation:
   - Max 50 reps per set
   - Max 100 reps per exercise
   - Weight range 1-1000 lbs
   - Reasonable duration (5 min - 4 hours)

2. Add fraud detection:
   - Flag suspicious patterns
   - Track user's historical data
   - Detect outliers
   - Log suspicious workouts

3. Add admin review:
   - Create admin dashboard
   - Show flagged workouts
   - Allow manual review and approval
   - Rollback fraudulent XP

4. Add unit tests:
   - Test validation rules
   - Test fraud detection
   - Test flagging logic
```

---

### Task 3.3: Implement Request Signing
**Severity**: 🟠 HIGH  
**Effort**: 3-4 hours  
**Files to Modify**:
- `backend/src/index.ts`
- `backend/src/config/config.ts`
- `ios/FitQuest/FitQuest/Services/NetworkService.swift` (new)

**Implementation Steps**:
```
1. Add signature generation:
   - HMAC-SHA256 of request body
   - Include timestamp in signature
   - Use API secret key

2. Add signature verification middleware:
   - Extract signature from header
   - Verify signature matches
   - Check timestamp freshness (5 min window)
   - Return 401 if invalid

3. Update iOS client:
   - Generate signatures for all requests
   - Include signature in headers
   - Handle 401 responses

4. Add unit tests:
   - Test signature generation
   - Test signature verification
   - Test timestamp validation
   - Test replay attack prevention
```

---

### Task 3.4: Add Dependency Scanning
**Severity**: 🟠 HIGH  
**Effort**: 2 hours  
**Files to Modify**:
- `backend/package.json`
- CI/CD pipeline configuration

**Implementation Steps**:
```
1. Add npm audit:
   - Run npm audit in CI/CD
   - Fail build on vulnerabilities
   - Generate audit reports

2. Add Snyk integration:
   - Configure Snyk CLI
   - Monitor dependencies
   - Get alerts for new vulnerabilities

3. Add to CI/CD:
   - Run audit on every commit
   - Generate reports
   - Notify on failures

4. Add documentation:
   - Document vulnerability response process
   - Create runbook for patching
```

---

### Task 3.5: Add URL Validation for Images
**Severity**: 🟠 HIGH  
**Effort**: 1-2 hours  
**Files to Modify**:
- `backend/src/services/userProfileService.ts`

**Implementation Steps**:
```
1. Add URL validation function:
   - Whitelist allowed domains
   - Block internal IPs
   - Require HTTPS
   - Validate URL format

2. Apply to profile pictures:
   - Validate on upload
   - Validate on update
   - Reject invalid URLs

3. Add unit tests:
   - Test valid URLs accepted
   - Test invalid URLs rejected
   - Test internal IPs blocked
   - Test HTTP URLs rejected
```

---

## Implementation Timeline

### Week 1: Critical Issues
- **Day 1-2**: Tasks 1.1, 1.2 (Authorization fixes)
- **Day 3**: Task 1.3 (JWT secrets)
- **Day 4**: Task 1.4 (Token blacklist)
- **Day 5**: Task 1.5 (Input validation)

### Week 2: High Priority
- **Day 1-2**: Task 2.1 (Account lockout)
- **Day 3**: Task 2.2 (Password requirements)
- **Day 4**: Task 2.3 (Rate limiting)
- **Day 5**: Task 2.4 (Security logging)

### Week 3: Medium Priority
- **Day 1**: Task 2.5 (HTTPS enforcement)
- **Day 2-4**: Task 3.1 (MFA/2FA)
- **Day 5**: Task 3.2 (Fraud detection - start)

### Week 4: Remaining
- **Day 1-2**: Task 3.2 (Fraud detection - finish)
- **Day 3**: Task 3.3 (Request signing)
- **Day 4**: Task 3.4 (Dependency scanning)
- **Day 5**: Task 3.5 (URL validation)

---

## Testing Strategy

### Unit Tests
- Add tests for each security fix
- Test both positive and negative cases
- Aim for 100% coverage of security code

### Integration Tests
- Test end-to-end security flows
- Test authorization across endpoints
- Test rate limiting and lockout

### Security Tests
- Penetration testing after fixes
- OWASP Top 10 validation
- Dependency vulnerability scanning

### Performance Tests
- Ensure security fixes don't impact performance
- Test rate limiting under load
- Test token blacklist performance

---

## Deployment Strategy

### Pre-Deployment Checklist
- [ ] All critical issues fixed and tested
- [ ] Security audit passed
- [ ] Penetration testing completed
- [ ] Dependency scan passed
- [ ] Security logging enabled
- [ ] Monitoring and alerting configured

### Deployment Steps
1. Deploy to staging environment
2. Run full security test suite
3. Perform manual security testing
4. Get security sign-off
5. Deploy to production
6. Monitor for security events

### Post-Deployment
- Monitor security logs
- Track failed login attempts
- Monitor for suspicious activity
- Review audit logs daily

---

## Success Criteria

### Critical Issues
- ✅ All authorization checks in place
- ✅ JWT secrets secured
- ✅ Token blacklist working
- ✅ Input validation complete

### High Priority Issues
- ✅ Account lockout implemented
- ✅ Password requirements enforced
- ✅ Rate limiting on sync
- ✅ Security logging comprehensive
- ✅ HTTPS enforced

### Medium Priority Issues
- ✅ MFA/2FA available
- ✅ Fraud detection active
- ✅ Request signing implemented
- ✅ Dependency scanning automated
- ✅ URL validation in place

### Overall
- ✅ OWASP Top 10 compliance
- ✅ Zero critical vulnerabilities
- ✅ Security audit passed
- ✅ Penetration testing passed
- ✅ Ready for production

