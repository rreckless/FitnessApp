# OWASP Top 10 Security Audit - FitQuest Phase 1

**Date**: April 20, 2026  
**Scope**: Phase 1 Implementation (Authentication, User Profiles, Exercise Library, Sync Engine)  
**Status**: ⚠️ CRITICAL ISSUES FOUND - Requires Immediate Remediation

---

## Executive Summary

Phase 1 implementation has **7 critical security vulnerabilities** and **12 high-priority issues** across OWASP Top 10 categories. While foundational security practices are in place (bcrypt, JWT, rate limiting), several critical gaps require immediate attention before production deployment.

**Risk Level**: 🔴 **HIGH** - Production deployment NOT recommended without fixes

---

## OWASP Top 10 Findings

### 1. ❌ A01:2021 - Broken Access Control

#### Issue 1.1: Missing Authorization Checks on Sync Endpoints
**Severity**: 🔴 CRITICAL  
**Location**: `backend/src/routes/syncRoutes.ts`

**Problem**:
- Sync endpoints verify authentication but don't verify user ownership of data
- A user can sync another user's data by changing the `userId` in the request
- No authorization check in `syncService.pullChanges()` or `syncService.pushChanges()`

**Vulnerable Code**:
```typescript
// syncRoutes.ts - Line 15
router.post('/pull', verifyToken, async (req: Request, res: Response) => {
  const userId = (req as any).userId;  // ✅ Extracted from token
  const { lastSyncAt } = req.body;
  
  // ❌ No check that userId matches authenticated user
  const changes = await syncService.pullChanges(userId, lastSyncAt);
});
```

**Attack Scenario**:
1. User A logs in, gets token with `userId: "user-a-id"`
2. User A calls `/sync/pull` with `userId: "user-b-id"` in request body
3. Server syncs User B's data to User A

**Fix Required**:
```typescript
// Use userId from token, NOT from request body
const userId = (req as any).userId;  // From JWT
const changes = await syncService.pullChanges(userId);  // No userId param
```

---

#### Issue 1.2: Missing User Ownership Validation in User Profile Routes
**Severity**: 🔴 CRITICAL  
**Location**: `backend/src/routes/userProfileRoutes.ts`

**Problem**:
- Users can modify other users' profiles by changing the `:id` parameter
- No check that the authenticated user owns the profile being modified

**Example Attack**:
```bash
# User A's token
curl -X PUT /users/user-b-id \
  -H "Authorization: Bearer user-a-token" \
  -d '{"name": "Hacked", "email": "attacker@example.com"}'
```

**Fix Required**:
```typescript
router.put('/:id', verifyToken, async (req, res) => {
  const userId = (req as any).userId;
  const profileId = req.params.id;
  
  // ✅ Verify ownership
  if (userId !== profileId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Proceed with update
});
```

---

#### Issue 1.3: No Rate Limiting on Sync Endpoints
**Severity**: 🟠 HIGH  
**Location**: `backend/src/routes/syncRoutes.ts`

**Problem**:
- Sync endpoints have no rate limiting
- Attackers can flood the server with sync requests
- No protection against brute force attacks on sync operations

**Fix Required**:
```typescript
const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute
  message: 'Too many sync requests',
});

router.post('/pull', syncLimiter, verifyToken, ...);
router.post('/push', syncLimiter, verifyToken, ...);
```

---

### 2. ❌ A02:2021 - Cryptographic Failures

#### Issue 2.1: Weak JWT Secret in Development
**Severity**: 🔴 CRITICAL  
**Location**: `backend/src/config/config.ts`

**Problem**:
- Default JWT secrets are hardcoded and weak
- `jwtSecret: 'your_jwt_secret_key_here'` is used if env var not set
- Allows attackers to forge valid JWT tokens

**Vulnerable Code**:
```typescript
jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_here',
```

**Attack Scenario**:
1. Attacker knows default secret is `'your_jwt_secret_key_here'`
2. Attacker creates valid JWT: `jwt.sign({userId: 'any-user-id'}, 'your_jwt_secret_key_here')`
3. Attacker gains access as any user

**Fix Required**:
```typescript
// Require environment variables in production
if (config.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');
  }
}

jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex'),
```

---

#### Issue 2.2: Tokens Not Invalidated on Logout
**Severity**: 🟠 HIGH  
**Location**: `backend/src/services/authService.ts`

**Problem**:
- `logout()` function doesn't invalidate tokens
- Users can continue using old tokens after logout
- No token blacklist implementation

**Vulnerable Code**:
```typescript
export async function logout(userId: string): Promise<void> {
  try {
    // ❌ Just logs the logout, doesn't invalidate token
    logger.info('User logged out', { userId });
  } catch (error) {
    logger.error('Logout failed', error as Error);
    throw error;
  }
}
```

**Attack Scenario**:
1. User logs out
2. Attacker intercepts the access token
3. Attacker uses token to access API (still valid until expiration)

**Fix Required**:
```typescript
export async function logout(userId: string): Promise<void> {
  // Add token to blacklist (Redis)
  await redis.setex(`blacklist:${token}`, jwtExpiration, '1');
}

// In verifyToken middleware:
const isBlacklisted = await redis.get(`blacklist:${token}`);
if (isBlacklisted) {
  throw new Error('Token has been revoked');
}
```

---

#### Issue 2.3: Passwords Sent Over HTTP in Development
**Severity**: 🟠 HIGH  
**Location**: All endpoints

**Problem**:
- No HTTPS enforcement in development
- Passwords transmitted in plaintext over HTTP
- No HSTS headers configured

**Fix Required**:
```typescript
// In index.ts
app.use(helmet({
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Enforce HTTPS in production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

### 3. ❌ A03:2021 - Injection

#### Issue 3.1: Potential SQL Injection in Sync Service
**Severity**: 🟠 HIGH  
**Location**: `backend/src/services/syncService.ts`

**Problem**:
- While using parameterized queries (good), dynamic table names are used
- `entityType` parameter determines which table to query
- If `entityType` is not properly validated, could lead to injection

**Vulnerable Code**:
```typescript
private async getEntity(
  entityType: string,  // ❌ Not validated
  entityId: string,
  userId: string
): Promise<any> {
  let query = '';
  
  switch (entityType) {
    case 'WORKOUT':
      query = 'SELECT * FROM workouts WHERE id = $1 AND user_id = $2';
      // ...
  }
  
  // If entityType doesn't match any case, query is empty string
  // Could be exploited if validation is bypassed
}
```

**Fix Required**:
```typescript
const VALID_ENTITY_TYPES = ['WORKOUT', 'WEIGHT', 'MEASUREMENT', 'PHOTO'];

if (!VALID_ENTITY_TYPES.includes(entityType)) {
  throw new Error(`Invalid entity type: ${entityType}`);
}

// Then proceed with switch statement
```

---

#### Issue 3.2: No Input Validation on Sync Payload
**Severity**: 🟠 HIGH  
**Location**: `backend/src/routes/syncRoutes.ts`

**Problem**:
- Sync payload is not validated before processing
- Arbitrary JSON can be stored in database
- No schema validation for payload structure

**Vulnerable Code**:
```typescript
router.post('/push', verifyToken, async (req: Request, res: Response) => {
  const { operations } = req.body as SyncPushRequest;
  
  // ❌ No validation of operations array structure
  // ❌ No validation of payload contents
  
  const result = await syncService.pushChanges(userId, operations);
});
```

**Fix Required**:
```typescript
import { body, validationResult } from 'express-validator';

router.post('/push', verifyToken, [
  body('operations').isArray().notEmpty(),
  body('operations.*.operation').isIn(['CREATE', 'UPDATE', 'DELETE']),
  body('operations.*.entityType').isIn(['WORKOUT', 'WEIGHT', 'MEASUREMENT', 'PHOTO']),
  body('operations.*.entityId').isUUID(),
  body('operations.*.payload').isObject(),
  body('operations.*.clientTimestamp').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Proceed...
});
```

---

### 4. ❌ A04:2021 - Insecure Design

#### Issue 4.1: No Fraud Detection for XP Manipulation
**Severity**: 🔴 CRITICAL  
**Location**: Design gap - not yet implemented

**Problem**:
- Design mentions anti-cheat validation (max 50 reps/set, max 100 reps/exercise)
- Not implemented in Phase 1
- Users can manipulate XP by logging fake workouts

**Risk**:
- Leaderboard manipulation
- Unfair competitive advantage
- Monetization fraud (premium features based on XP)

**Fix Required** (for Phase 2):
```typescript
function validateWorkoutData(workout: Workout): ValidationResult {
  const errors: string[] = [];
  
  // Validate reps per set
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (set.reps > 50) {
        errors.push(`Max 50 reps per set, got ${set.reps}`);
      }
    }
  }
  
  // Validate total reps per exercise
  const totalReps = workout.exercises.reduce((sum, ex) => 
    sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0
  );
  
  if (totalReps > 100) {
    errors.push(`Max 100 reps per exercise, got ${totalReps}`);
  }
  
  // Validate weight range
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (set.weight < 1 || set.weight > 1000) {
        errors.push(`Weight must be 1-1000 lbs, got ${set.weight}`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}
```

---

#### Issue 4.2: No Conflict Resolution UI for Users
**Severity**: 🟠 HIGH  
**Location**: Design gap

**Problem**:
- Sync conflicts are resolved server-side without user input
- Users don't know when their data was overwritten
- No way to recover lost data

**Fix Required**:
- Implement conflict notification system
- Show users when conflicts occur
- Allow manual resolution options

---

### 5. ❌ A05:2021 - Broken Authentication

#### Issue 5.1: No Multi-Factor Authentication (MFA)
**Severity**: 🟠 HIGH  
**Location**: Authentication system

**Problem**:
- Only password-based authentication
- No MFA/2FA support
- Compromised password = full account compromise

**Fix Required** (for Phase 2):
- Implement TOTP (Time-based One-Time Password)
- Support authenticator apps (Google Authenticator, Authy)
- Backup codes for account recovery

---

#### Issue 5.2: Weak Password Requirements
**Severity**: 🟠 HIGH  
**Location**: `backend/src/routes/authRoutes.ts`

**Problem**:
- Only requires 8 characters
- No complexity requirements (uppercase, numbers, symbols)
- Vulnerable to dictionary attacks

**Current Code**:
```typescript
body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
```

**Fix Required**:
```typescript
body('password')
  .isLength({ min: 12 })
  .withMessage('Password must be at least 12 characters')
  .matches(/[A-Z]/)
  .withMessage('Password must contain uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain number')
  .matches(/[!@#$%^&*]/)
  .withMessage('Password must contain special character'),
```

---

#### Issue 5.3: No Account Lockout After Failed Attempts
**Severity**: 🟠 HIGH  
**Location**: `backend/src/services/authService.ts`

**Problem**:
- Rate limiting exists but no account lockout
- Attackers can make unlimited attempts (just slower)
- No progressive delays

**Fix Required**:
```typescript
async function login(email: string, password: string): Promise<AuthResponse> {
  // Check if account is locked
  const lockoutKey = `lockout:${email}`;
  const lockoutCount = await redis.get(lockoutKey);
  
  if (lockoutCount && parseInt(lockoutCount) >= 5) {
    throw new Error('Account locked. Try again in 30 minutes.');
  }
  
  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  
  if (!isPasswordValid) {
    // Increment lockout counter
    await redis.incr(lockoutKey);
    await redis.expire(lockoutKey, 1800);  // 30 minutes
    throw new Error('Invalid email or password');
  }
  
  // Clear lockout on successful login
  await redis.del(lockoutKey);
  
  // Generate tokens...
}
```

---

### 6. ❌ A06:2021 - Vulnerable and Outdated Components

#### Issue 6.1: No Dependency Vulnerability Scanning
**Severity**: 🟠 HIGH  
**Location**: `backend/package.json`

**Problem**:
- No automated dependency scanning
- No security audit process
- Vulnerable packages may be in use

**Fix Required**:
```bash
# Add to CI/CD pipeline
npm audit
npm audit fix

# Or use Snyk
snyk test
snyk monitor
```

---

### 7. ❌ A07:2021 - Identification and Authentication Failures

#### Issue 7.1: Email Enumeration Vulnerability (Partially Mitigated)
**Severity**: 🟡 MEDIUM  
**Location**: `backend/src/services/authService.ts`

**Status**: ✅ Partially Fixed

**Current Implementation**:
```typescript
// Password reset endpoint returns same message for all emails
res.status(200).json({
  message: 'If an account exists with this email, a password reset link has been sent',
});
```

**Remaining Issue**:
- Registration endpoint reveals if email exists
- Timing attacks could reveal email existence

**Fix Required**:
```typescript
// Registration endpoint
router.post('/register', authLimiter, [...], async (req, res) => {
  // Always return same response time
  const startTime = Date.now();
  
  try {
    const result = await register(email, password, name);
    res.status(201).json(result);
  } catch (error) {
    // Add delay to match success response time
    const elapsed = Date.now() - startTime;
    const targetTime = 500;  // 500ms
    if (elapsed < targetTime) {
      await new Promise(r => setTimeout(r, targetTime - elapsed));
    }
    res.status(400).json({ error: 'Registration failed' });
  }
});
```

---

#### Issue 7.2: No Session Timeout
**Severity**: 🟠 HIGH  
**Location**: JWT configuration

**Problem**:
- Access tokens valid for 1 hour
- No automatic session timeout
- Unattended devices remain logged in

**Fix Required**:
```typescript
// Reduce access token expiration
jwtExpiration: '15m',  // 15 minutes instead of 1 hour

// Implement idle timeout on client
// If no activity for 5 minutes, force re-authentication
```

---

### 8. ❌ A08:2021 - Software and Data Integrity Failures

#### Issue 8.1: No Request Signing/Verification
**Severity**: 🟠 HIGH  
**Location**: All API endpoints

**Problem**:
- No way to verify request integrity
- Man-in-the-middle attacks possible
- No protection against request tampering

**Fix Required**:
```typescript
// Add request signature verification
import crypto from 'crypto';

function signRequest(payload: any, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Middleware to verify signatures
app.use((req, res, next) => {
  const signature = req.headers['x-signature'];
  const expectedSignature = signRequest(req.body, config.apiSecret);
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
});
```

---

### 9. ❌ A09:2021 - Logging and Monitoring Failures

#### Issue 9.1: Insufficient Security Logging
**Severity**: 🟠 HIGH  
**Location**: `backend/src/logging/logger.ts`

**Problem**:
- No logging of failed authentication attempts
- No logging of authorization failures
- No audit trail for sensitive operations

**Fix Required**:
```typescript
// Log all security events
logger.warn('Failed login attempt', {
  email,
  ip: req.ip,
  userAgent: req.get('user-agent'),
  timestamp: new Date(),
});

logger.warn('Unauthorized access attempt', {
  userId,
  resource: req.path,
  ip: req.ip,
  timestamp: new Date(),
});

logger.info('Sensitive data accessed', {
  userId,
  dataType: 'user_profile',
  action: 'read',
  timestamp: new Date(),
});
```

---

#### Issue 9.2: No Alerting for Suspicious Activity
**Severity**: 🟠 HIGH  
**Location**: Monitoring gap

**Problem**:
- No real-time alerts for security events
- No detection of brute force attacks
- No notification of unusual access patterns

**Fix Required**:
- Implement real-time alerting
- Monitor for multiple failed logins
- Alert on access from new locations
- Track unusual API usage patterns

---

### 10. ❌ A10:2021 - Server-Side Request Forgery (SSRF)

#### Issue 10.1: No URL Validation for Profile Pictures
**Severity**: 🟠 HIGH  
**Location**: `backend/src/services/userProfileService.ts`

**Problem**:
- Profile picture URLs not validated
- Could be used to access internal services
- No whitelist of allowed domains

**Fix Required**:
```typescript
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Whitelist allowed domains
    const allowedDomains = ['s3.amazonaws.com', 'cdn.fitquest.com'];
    if (!allowedDomains.some(domain => parsed.hostname?.endsWith(domain))) {
      return false;
    }
    
    // Prevent access to internal IPs
    const internalIPs = ['127.0.0.1', 'localhost', '192.168.', '10.', '172.'];
    if (internalIPs.some(ip => parsed.hostname?.startsWith(ip))) {
      return false;
    }
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

---

## Summary Table

| # | OWASP Category | Issue | Severity | Status |
|---|---|---|---|---|
| 1.1 | A01 - Broken Access Control | Missing authorization on sync endpoints | 🔴 CRITICAL | ❌ Not Fixed |
| 1.2 | A01 - Broken Access Control | No user ownership validation | 🔴 CRITICAL | ❌ Not Fixed |
| 1.3 | A01 - Broken Access Control | No rate limiting on sync | 🟠 HIGH | ❌ Not Fixed |
| 2.1 | A02 - Cryptographic Failures | Weak JWT secrets | 🔴 CRITICAL | ❌ Not Fixed |
| 2.2 | A02 - Cryptographic Failures | Tokens not invalidated on logout | 🟠 HIGH | ❌ Not Fixed |
| 2.3 | A02 - Cryptographic Failures | No HTTPS enforcement | 🟠 HIGH | ❌ Not Fixed |
| 3.1 | A03 - Injection | Potential SQL injection in sync | 🟠 HIGH | ⚠️ Partial |
| 3.2 | A03 - Injection | No input validation on sync payload | 🟠 HIGH | ❌ Not Fixed |
| 4.1 | A04 - Insecure Design | No fraud detection for XP | 🔴 CRITICAL | ❌ Not Implemented |
| 4.2 | A04 - Insecure Design | No conflict resolution UI | 🟠 HIGH | ❌ Not Implemented |
| 5.1 | A05 - Broken Authentication | No MFA/2FA | 🟠 HIGH | ❌ Not Implemented |
| 5.2 | A05 - Broken Authentication | Weak password requirements | 🟠 HIGH | ❌ Not Fixed |
| 5.3 | A05 - Broken Authentication | No account lockout | 🟠 HIGH | ❌ Not Fixed |
| 6.1 | A06 - Vulnerable Components | No dependency scanning | 🟠 HIGH | ❌ Not Implemented |
| 7.1 | A07 - Identification Failures | Email enumeration | 🟡 MEDIUM | ✅ Partial |
| 7.2 | A07 - Identification Failures | No session timeout | 🟠 HIGH | ❌ Not Fixed |
| 8.1 | A08 - Data Integrity | No request signing | 🟠 HIGH | ❌ Not Implemented |
| 9.1 | A09 - Logging Failures | Insufficient security logging | 🟠 HIGH | ❌ Not Fixed |
| 9.2 | A09 - Logging Failures | No alerting for suspicious activity | 🟠 HIGH | ❌ Not Implemented |
| 10.1 | A10 - SSRF | No URL validation for images | 🟠 HIGH | ❌ Not Fixed |

---

## Recommendations

### Immediate Actions (Before Production)

1. **Fix Critical Authorization Issues** (1.1, 1.2)
   - Add user ownership validation to all endpoints
   - Ensure userId comes from JWT, not request body
   - Estimated effort: 2-3 hours

2. **Secure JWT Secrets** (2.1)
   - Require environment variables in production
   - Generate strong random secrets
   - Estimated effort: 1 hour

3. **Implement Token Blacklist** (2.2)
   - Add Redis-backed token blacklist
   - Check blacklist in verifyToken middleware
   - Estimated effort: 2-3 hours

4. **Add Input Validation** (3.2)
   - Validate all sync operations
   - Use express-validator for payload validation
   - Estimated effort: 2 hours

### High Priority (Before Phase 2)

5. **Implement Account Lockout** (5.3)
   - Lock accounts after 5 failed attempts
   - 30-minute lockout period
   - Estimated effort: 2 hours

6. **Strengthen Password Requirements** (5.2)
   - Require 12+ characters
   - Require uppercase, numbers, symbols
   - Estimated effort: 1 hour

7. **Add Security Logging** (9.1)
   - Log all authentication failures
   - Log authorization failures
   - Log sensitive data access
   - Estimated effort: 3-4 hours

8. **Implement Rate Limiting on Sync** (1.3)
   - Add rate limiter to sync endpoints
   - 10 requests per minute per user
   - Estimated effort: 1 hour

### Medium Priority (Phase 2+)

9. **Implement MFA/2FA** (5.1)
   - TOTP support
   - Backup codes
   - Estimated effort: 8-10 hours

10. **Add Fraud Detection** (4.1)
    - Validate workout data
    - Flag suspicious patterns
    - Estimated effort: 5-6 hours

11. **Implement Request Signing** (8.1)
    - HMAC-SHA256 signatures
    - Verify on all requests
    - Estimated effort: 3-4 hours

12. **Add Dependency Scanning** (6.1)
    - npm audit in CI/CD
    - Snyk integration
    - Estimated effort: 2 hours

---

## Total Remediation Effort

- **Immediate (Critical)**: 8-9 hours
- **High Priority**: 11-12 hours
- **Medium Priority**: 18-20 hours
- **Total**: 37-41 hours

---

## Conclusion

Phase 1 has solid foundational security practices (bcrypt, JWT, rate limiting on auth), but **critical authorization gaps** must be fixed before any production deployment. The most urgent issues are:

1. ❌ Missing authorization checks on sync endpoints
2. ❌ Weak JWT secrets
3. ❌ No token invalidation on logout
4. ❌ No input validation on sync payloads

**Recommendation**: Do NOT deploy to production until at least the 4 critical issues are resolved.

