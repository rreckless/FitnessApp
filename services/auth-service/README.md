# FitQuest Authentication Service

A production-ready authentication service built with .NET 10 ASP.NET Core Minimal APIs for the FitQuest gamified fitness application.

## Overview

The Authentication Service handles:
- User registration and login
- JWT token generation and refresh
- Password strength validation and hashing
- Password reuse prevention with history tracking
- Device fingerprinting for security
- Token blacklist management via Redis
- Rate limiting and brute force protection
- Password reset flow

## Technology Stack

- **Runtime**: .NET 10
- **Framework**: ASP.NET Core Minimal APIs
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Password Hashing**: BCrypt.Net-Next
- **Authentication**: JWT (JSON Web Tokens)
- **Logging**: Serilog

## Project Structure

```
services/auth-service/
├── Program.cs                          # Application entry point
├── auth-service.csproj                 # Project file
├── appsettings.json                    # Production configuration
├── appsettings.Development.json        # Development configuration
├── Dockerfile                          # Docker image definition
├── .dockerignore                       # Docker build exclusions
├── kubernetes-deployment.yaml          # Kubernetes deployment manifest
├── kubernetes-service.yaml             # Kubernetes service manifest
├── Models/                             # Data models
│   ├── User.cs
│   ├── PasswordHistory.cs
│   ├── AuthRequest.cs
│   ├── AuthResponse.cs
│   ├── TokenResponse.cs
│   ├── PasswordValidationResult.cs
│   └── DeviceFingerprint.cs
├── Services/                           # Business logic services
│   ├── PasswordValidator.cs
│   ├── PasswordHasher.cs
│   ├── PasswordHistoryService.cs
│   ├── JwtTokenService.cs
│   ├── DeviceFingerprintService.cs
│   ├── TokenBlacklistService.cs
│   └── AuthenticationService.cs
├── Data/                               # Database context
│   └── AuthDbContext.cs
├── Controllers/                        # API endpoints
│   └── AuthController.cs
├── Middleware/                         # Custom middleware
│   ├── RateLimitingMiddleware.cs
│   └── BruteForceProtectionMiddleware.cs
├── Tests/                              # Unit and integration tests
│   ├── AuthService.Tests.csproj
│   ├── PasswordValidatorTests.cs
│   ├── PasswordReusePreventionTests.cs
│   ├── JwtTokenServiceTests.cs
│   └── AuthenticationRoundTripTests.cs
├── README.md                           # This file
└── DEPLOYMENT.md                       # Deployment guide
```

## Setup Instructions

### Prerequisites

- .NET 10 SDK
- PostgreSQL 14+
- Redis 7+
- Docker (for containerization)
- Kubernetes (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/auth-service
   ```

2. **Install dependencies**
   ```bash
   dotnet restore
   ```

3. **Configure local database**
   ```bash
   # Update appsettings.Development.json with your PostgreSQL connection string
   ```

4. **Run migrations**
   ```bash
   dotnet ef database update
   ```

5. **Run the service**
   ```bash
   dotnet run
   ```

   The service will be available at `https://localhost:5001` or `http://localhost:5000`

6. **Access Swagger UI**
   Navigate to `http://localhost:5000/swagger` to view API documentation

## Running Tests

### Unit Tests

```bash
cd Tests
dotnet test
```

### Test Coverage

- **PasswordValidatorTests**: Password strength validation
- **PasswordReusePreventionTests**: Password history and reuse prevention
- **JwtTokenServiceTests**: JWT token generation and validation
- **AuthenticationRoundTripTests**: Full authentication flow

## API Endpoints

### Authentication

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 201 Created
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "user",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "user",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}

Response: 200 OK
{
  "accessToken": "new-jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

#### Logout
```
POST /auth/logout
Content-Type: application/json

{
  "accessToken": "jwt-token"
}

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

#### Password Reset Request
```
POST /auth/password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: 200 OK
{
  "message": "Password reset email sent"
}
```

#### Password Reset Confirm
```
POST /auth/password-reset/confirm
Content-Type: application/json

{
  "email": "user@example.com",
  "resetToken": "reset-token",
  "newPassword": "NewSecurePass456!"
}

Response: 200 OK
{
  "message": "Password reset successfully"
}
```

#### Validate Password
```
POST /auth/validate-password
Content-Type: application/json

{
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "isValid": true,
  "errors": []
}
```

#### Health Check
```
GET /health

Response: 200 OK
{
  "status": "healthy"
}
```

## Security Features

### Password Security
- **Minimum 12 characters** required
- **Uppercase, lowercase, number, and special character** required
- **BCrypt hashing** with SHA384 enhancement
- **5-password history** to prevent reuse
- **Password reset** via secure token

### Authentication
- **JWT tokens** with 15-minute expiry
- **Refresh tokens** with 7-day expiry
- **Token blacklist** via Redis for logout
- **Device fingerprinting** for security validation

### Rate Limiting
- **10 requests/second** for `/auth` endpoints
- **100 requests/second** for other endpoints
- **Redis-based** counter management

### Brute Force Protection
- **5 failed login attempts** trigger account lockout
- **15-minute lockout** duration
- **Automatic unlock** after timeout

## Configuration

### Environment Variables

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_users;Username=fitquest;Password=changeme
ConnectionStrings__Redis=redis.fitquest.svc.cluster.local:6379
Jwt__Secret=your-secret-key-min-32-characters
Jwt__Issuer=fitquest
Jwt__Audience=fitquest-mobile
Jwt__AccessTokenExpiryMinutes=15
Jwt__RefreshTokenExpiryDays=7
```

### appsettings.json

See `appsettings.json` for production configuration and `appsettings.Development.json` for development configuration.

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `name` (String)
- `bio` (String)
- `profile_picture_url` (String)
- `level` (Integer, Default: 1)
- `total_xp` (Integer, Default: 0)
- `current_streak` (Integer, Default: 0)
- `longest_streak` (Integer, Default: 0)
- `last_password_change_at` (DateTime)
- `subscription_tier` (String, Default: "FREE")
- `subscription_expires_at` (DateTime, Nullable)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `last_sync_at` (DateTime)

### PasswordHistory Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `password_hash` (String)
- `created_at` (DateTime)

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Performance

- **Sub-second response times** for authentication endpoints
- **Redis caching** for token blacklist and rate limiting
- **Connection pooling** for database connections
- **Async/await** throughout for scalability

## Monitoring

- **Serilog** for structured logging
- **Health check endpoint** at `/health`
- **Prometheus metrics** (future enhancement)
- **Distributed tracing** support (future enhancement)

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `dotnet test`
4. Submit a pull request

## License

Proprietary - FitQuest
