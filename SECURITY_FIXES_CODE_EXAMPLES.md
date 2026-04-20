# Security Fixes - Code Examples

This document provides specific code implementations for each security fix.

---

## Fix 1.1: Authorization on Sync Endpoints

### Before (Vulnerable)
```typescript
// syncRoutes.ts
router.post('/pull', verifyToken, async (req: Request, res: Response) => {
  const userId = (req as any).userId;  // From token
  const { lastSyncAt } = req.body;
  
  // ❌ PROBLEM: userId could be overridden in request body
  const changes = await syncService.pullChanges(userId, lastSyncAt);
});
```

### After (Fixed)
```typescript
// syncRoutes.ts
router.post('/pull', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;  // Only from token
    const { lastSyncAt } = req.body;
    
    // ✅ Pass only authenticated userId
    const changes = await syncService.pullChanges(userId, lastSyncAt);
    
    res.json({
      success: true,
      changes,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Pull sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to pull changes' });
  }
});

// syncService.ts
async pullChanges(userId: string, lastSyncAt?: Date): Promise<any[]> {
  // ✅ userId is parameter, not from request
  const query = `
    SELECT * FROM workouts
    WHERE user_id = $1 AND updated_at > $2
    ORDER BY updated_at ASC
  `;
  
  const result = await this.pool.query(query, [
    userId,  // ✅ Authenticated user only
    lastSyncAt || new Date(0),
  ]);
  
  return result.rows;
}
```

---

## Fix 1.2: User Profile Authorization

### Before (Vulnerable)
```typescript
// userProfileRoutes.ts
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const profileId = req.params.id;
  
  // ❌ PROBLEM: No check that userId === profileId
  const result = await updateUserProfile(profileId, req.body);
  res.json(result);
});
```

### After (Fixed)
```typescript
// userProfileRoutes.ts
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const profileId = req.params.id;
    
    // ✅ Verify ownership
    if (userId !== profileId) {
      logger.warn('Unauthorized profile update attempt', {
        userId,
        targetProfile: profileId,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const result = await updateUserProfile(userId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
```

---

## Fix 1.3: Secure JWT Secrets

### Before (Vulnerable)
```typescript
// config.ts
export const config = {
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_here',
};
```

### After (Fixed)
```typescript
// config.ts
import crypto from 'crypto';

function validateJwtSecrets(): void {
  if (config.nodeEnv === 'production') {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_SECRET and JWT_REFRESH_SECRET must be set in production'
      );
    }
    
    // Validate minimum length (32 bytes = 256 bits)
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
    }
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // ✅ Generate strong random secrets for development
  jwtSecret: process.env.JWT_SECRET || 
    crypto.randomBytes(32).toString('hex'),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 
    crypto.randomBytes(32).toString('hex'),
};

// ✅ Validate on startup
validateJwtSecrets();

if (config.nodeEnv === 'development') {
  logger.warn('Using generated JWT secrets for development');
}
```

---

## Fix 1.4: Token Blacklist

### Before (Vulnerable)
```typescript
// authService.ts
export async function logout(userId: string): Promise<void> {
  try {
    // ❌ PROBLEM: Token not invalidated
    logger.info('User logged out', { userId });
  } catch (error) {
    logger.error('Logout failed', error as Error);
    throw error;
  }
}
```

### After (Fixed)
```typescript
// authService.ts
import { getRedisClient } from '../database/connection';

export async function logout(userId: string, token: string): Promise<void> {
  try {
    const redis = getRedisClient();
    
    // ✅ Decode token to get expiration
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid token');
    }
    
    // ✅ Calculate TTL (time until expiration)
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;
    
    if (ttl > 0) {
      // ✅ Add token to blacklist with TTL
      await redis.setex(`blacklist:${token}`, ttl, '1');
      logger.info('Token blacklisted', { userId, ttl });
    }
    
    logger.info('User logged out', { userId });
  } catch (error) {
    logger.error('Logout failed', error as Error);
    throw error;
  }
}

// authRoutes.ts
router.post('/logout', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const token = req.headers.authorization?.substring(7);  // Remove "Bearer "
    
    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    // ✅ Pass token to logout
    await logout(userId, token);
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout endpoint error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Middleware to check blacklist
export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  // ✅ Check if token is blacklisted
  const redis = getRedisClient();
  redis.get(`blacklist:${token}`, (err, result) => {
    if (err) {
      logger.error('Redis error checking blacklist:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    if (result) {
      logger.warn('Attempt to use blacklisted token');
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }
    
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    (req as any).userId = decoded.userId;
    next();
  });
}
```

---

## Fix 1.5: Input Validation on Sync

### Before (Vulnerable)
```typescript
// syncRoutes.ts
router.post('/push', verifyToken, async (req: Request, res: Response) => {
  const { operations } = req.body;
  
  // ❌ PROBLEM: No validation of operations
  const result = await syncService.pushChanges(userId, operations);
  res.json(result);
});
```

### After (Fixed)
```typescript
// syncRoutes.ts
import { body, validationResult } from 'express-validator';

router.post(
  '/push',
  verifyToken,
  [
    // ✅ Validate operations array
    body('operations')
      .isArray({ min: 1 })
      .withMessage('Operations must be a non-empty array'),
    
    // ✅ Validate each operation
    body('operations.*.operation')
      .isIn(['CREATE', 'UPDATE', 'DELETE'])
      .withMessage('Invalid operation type'),
    
    body('operations.*.entityType')
      .isIn(['WORKOUT', 'WEIGHT', 'MEASUREMENT', 'PHOTO'])
      .withMessage('Invalid entity type'),
    
    body('operations.*.entityId')
      .isUUID()
      .withMessage('Entity ID must be valid UUID'),
    
    body('operations.*.payload')
      .isObject()
      .withMessage('Payload must be an object'),
    
    body('operations.*.clientTimestamp')
      .isISO8601()
      .withMessage('Client timestamp must be ISO8601 date'),
  ],
  async (req: Request, res: Response) => {
    try {
      // ✅ Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Invalid sync push request', {
          userId: (req as any).userId,
          errors: errors.array(),
        });
        return res.status(400).json({ errors: errors.array() });
      }
      
      const userId = (req as any).userId;
      const { operations } = req.body;
      
      const result = await syncService.pushChanges(userId, operations);
      
      res.json({
        success: true,
        synced: result.synced,
        conflicts: result.conflicts,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Push sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to push changes',
      });
    }
  }
);
```

---

## Fix 2.1: Account Lockout

### Implementation
```typescript
// authService.ts
import { getRedisClient } from '../database/connection';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 30 * 60;  // 30 minutes

async function checkAccountLockout(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const lockoutKey = `lockout:${email.toLowerCase()}`;
  
  const count = await redis.get(lockoutKey);
  return count && parseInt(count) >= LOCKOUT_THRESHOLD;
}

async function incrementFailedAttempts(email: string): Promise<void> {
  const redis = getRedisClient();
  const lockoutKey = `lockout:${email.toLowerCase()}`;
  
  await redis.incr(lockoutKey);
  await redis.expire(lockoutKey, LOCKOUT_DURATION);
}

async function clearFailedAttempts(email: string): Promise<void> {
  const redis = getRedisClient();
  const lockoutKey = `lockout:${email.toLowerCase()}`;
  
  await redis.del(lockoutKey);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    // ✅ Check if account is locked
    const isLocked = await checkAccountLockout(email);
    if (isLocked) {
      logger.warn('Login attempt on locked account', { email });
      throw new Error('Account locked. Try again in 30 minutes.');
    }
    
    // Find user
    const result = await query(
      `SELECT id, email, password_hash, name, level, total_xp, 
              current_streak, longest_streak, subscription_tier, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // ✅ Increment failed attempts
      await incrementFailedAttempts(email);
      throw new Error('Invalid email or password');
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      // ✅ Increment failed attempts
      await incrementFailedAttempts(email);
      throw new Error('Invalid email or password');
    }
    
    // ✅ Clear failed attempts on success
    await clearFailedAttempts(email);
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    logger.info('User logged in successfully', { userId: user.id, email });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
        totalXp: user.total_xp,
        currentStreak: user.current_streak,
        longestStreak: user.longest_streak,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
      },
      tokens,
    };
  } catch (error) {
    logger.error('Login failed', error as Error);
    throw error;
  }
}

// authRoutes.ts
router.post('/login', authLimiter, [...], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    try {
      const result = await login(email, password);
      res.status(200).json(result);
    } catch (error) {
      const message = (error as Error).message;
      
      // ✅ Return 429 for locked accounts
      if (message.includes('locked')) {
        return res.status(429).json({
          error: message,
          retryAfter: 1800,  // 30 minutes
        });
      }
      
      res.status(401).json({ error: message });
    }
  } catch (error) {
    logger.error('Login endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Fix 2.2: Strong Password Requirements

### Implementation
```typescript
// authRoutes.ts
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    
    // ✅ Strong password requirements
    body('password')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain number')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Password must contain special character'),
    
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { email, password, name } = req.body;
      const result = await register(email, password, name);
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Registration endpoint error:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);
```

---

## Fix 2.3: Rate Limiting on Sync

### Implementation
```typescript
// syncRoutes.ts
import rateLimit from 'express-rate-limit';

const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute
  message: 'Too many sync requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/health';
  },
});

// ✅ Apply to sync endpoints
router.post('/pull', syncLimiter, verifyToken, async (req, res) => {
  // ...
});

router.post('/push', syncLimiter, verifyToken, async (req, res) => {
  // ...
});

router.get('/status', syncLimiter, verifyToken, async (req, res) => {
  // ...
});
```

---

## Fix 2.4: Security Logging

### Implementation
```typescript
// authService.ts
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    // ... existing code ...
    
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      // ✅ Log failed attempt
      logger.warn('Failed login attempt', {
        email,
        userId: user.id,
        timestamp: new Date(),
        reason: 'invalid_password',
      });
      
      await incrementFailedAttempts(email);
      throw new Error('Invalid email or password');
    }
    
    // ✅ Log successful login
    logger.info('User logged in successfully', {
      userId: user.id,
      email,
      timestamp: new Date(),
    });
    
    // ... rest of code ...
  } catch (error) {
    logger.error('Login failed', error as Error);
    throw error;
  }
}

// syncRoutes.ts
router.post('/push', syncLimiter, verifyToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { operations } = req.body;
    
    // ✅ Log sync operation
    logger.info('Sync push initiated', {
      userId,
      operationCount: operations.length,
      timestamp: new Date(),
    });
    
    const result = await syncService.pushChanges(userId, operations);
    
    // ✅ Log sync result
    logger.info('Sync push completed', {
      userId,
      synced: result.synced.length,
      conflicts: result.conflicts.length,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      synced: result.synced,
      conflicts: result.conflicts,
      timestamp: new Date(),
    });
  } catch (error) {
    // ✅ Log errors
    logger.error('Sync push failed', {
      userId: (req as any).userId,
      error: (error as Error).message,
      timestamp: new Date(),
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to push changes',
    });
  }
});
```

---

## Fix 2.5: HTTPS Enforcement

### Implementation
```typescript
// index.ts
import helmet from 'helmet';

// ✅ Add security headers
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
      imgSrc: ["'self'", 'https:'],
      connectSrc: ["'self'"],
    },
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  xssFilter: true,
}));

// ✅ Enforce HTTPS in production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    // Check x-forwarded-proto header (for load balancers)
    const proto = req.get('x-forwarded-proto');
    
    if (proto && proto !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
    
    next();
  });
}
```

