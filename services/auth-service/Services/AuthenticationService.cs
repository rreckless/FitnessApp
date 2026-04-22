using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IAuthenticationService
{
    Task<(bool Success, string? Error, AuthResponse? Response)> RegisterAsync(string email, string password, string name);
    Task<(bool Success, string? Error, AuthResponse? Response)> LoginAsync(string email, string password, string userAgent, string ipAddress);
    Task<(bool Success, string? Error)> LogoutAsync(string accessToken);
    Task<(bool Success, string? Error, TokenResponse? Response)> RefreshTokenAsync(string refreshToken);
    Task<(bool Success, string? Error)> ResetPasswordAsync(string email, string resetToken, string newPassword);
}

public class AuthenticationService : IAuthenticationService
{
    private readonly AuthDbContext _context;
    private readonly IPasswordValidator _passwordValidator;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IPasswordHistoryService _passwordHistoryService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IDeviceFingerprintService _deviceFingerprintService;
    private readonly ITokenBlacklistService _tokenBlacklistService;
    private readonly StackExchange.Redis.IConnectionMultiplexer _redis;

    public AuthenticationService(
        AuthDbContext context,
        IPasswordValidator passwordValidator,
        IPasswordHasher passwordHasher,
        IPasswordHistoryService passwordHistoryService,
        IJwtTokenService jwtTokenService,
        IDeviceFingerprintService deviceFingerprintService,
        ITokenBlacklistService tokenBlacklistService,
        StackExchange.Redis.IConnectionMultiplexer redis)
    {
        _context = context;
        _passwordValidator = passwordValidator;
        _passwordHasher = passwordHasher;
        _passwordHistoryService = passwordHistoryService;
        _jwtTokenService = jwtTokenService;
        _deviceFingerprintService = deviceFingerprintService;
        _tokenBlacklistService = tokenBlacklistService;
        _redis = redis;
    }

    public async Task<(bool Success, string? Error, AuthResponse? Response)> RegisterAsync(string email, string password, string name)
    {
        // Validate email format
        if (!IsValidEmail(email))
            return (false, "Invalid email format", null);

        // Check if email already exists
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existingUser != null)
            return (false, "Email already registered", null);

        // Validate password strength
        var passwordValidation = _passwordValidator.Validate(password);
        if (!passwordValidation.IsValid)
            return (false, string.Join("; ", passwordValidation.Errors), null);

        // Hash password
        var passwordHash = _passwordHasher.HashPassword(password);

        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = passwordHash,
            Name = name,
            Level = 1,
            TotalXP = 0,
            CurrentStreak = 0,
            LongestStreak = 0,
            LastPasswordChangeAt = DateTime.UtcNow,
            SubscriptionTier = "FREE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Add initial password to history
        await _passwordHistoryService.AddPasswordToHistoryAsync(user.Id, passwordHash);

        // Generate tokens
        var accessToken = _jwtTokenService.GenerateAccessToken(user.Id, user.Email, user.Level);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        // Store refresh token in Redis
        var db = _redis.GetDatabase();
        await db.StringSetAsync($"refresh_token:{user.Id}:{refreshToken}", "valid", TimeSpan.FromDays(7));

        var response = new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email,
            Name = user.Name,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtTokenService.GetAccessTokenExpirySeconds()
        };

        return (true, null, response);
    }

    public async Task<(bool Success, string? Error, AuthResponse? Response)> LoginAsync(string email, string password, string userAgent, string ipAddress)
    {
        // Find user by email
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return (false, "Invalid credentials", null);

        // Check if account is locked (brute force protection)
        var db = _redis.GetDatabase();
        var lockKey = $"account_lock:{email}";
        var isLocked = await db.StringGetAsync(lockKey);
        if (isLocked.HasValue)
            return (false, "Account temporarily locked due to too many failed login attempts", null);

        // Verify password
        if (!_passwordHasher.VerifyPassword(password, user.PasswordHash))
        {
            // Increment failed attempts
            var attemptsKey = $"login_attempts:{email}";
            var attempts = await db.StringGetAsync(attemptsKey);
            var attemptCount = attempts.HasValue ? int.Parse(attempts.ToString()) : 0;
            attemptCount++;

            if (attemptCount >= 5)
            {
                // Lock account for 15 minutes
                await db.StringSetAsync(lockKey, "locked", TimeSpan.FromMinutes(15));
                return (false, "Account locked due to too many failed login attempts", null);
            }

            await db.StringSetAsync(attemptsKey, attemptCount.ToString(), TimeSpan.FromHours(1));
            return (false, "Invalid credentials", null);
        }

        // Clear failed attempts on successful login
        var attemptsKeySuccess = $"login_attempts:{email}";
        await db.KeyDeleteAsync(attemptsKeySuccess);

        // Generate device fingerprint
        var fingerprint = _deviceFingerprintService.GenerateFingerprint(userAgent, ipAddress);
        var deviceType = _deviceFingerprintService.ExtractDeviceType(userAgent);

        // Store device fingerprint
        var deviceFingerprint = new DeviceFingerprint
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Fingerprint = fingerprint,
            UserAgent = userAgent,
            IpAddress = ipAddress,
            DeviceType = deviceType,
            CreatedAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow
        };

        // Note: DeviceFingerprint table would need to be added to DbContext
        // For now, we'll skip storing it in the database

        // Generate tokens
        var accessToken = _jwtTokenService.GenerateAccessToken(user.Id, user.Email, user.Level);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        // Store refresh token in Redis
        await db.StringSetAsync($"refresh_token:{user.Id}:{refreshToken}", "valid", TimeSpan.FromDays(7));

        var response = new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email,
            Name = user.Name,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtTokenService.GetAccessTokenExpirySeconds()
        };

        return (true, null, response);
    }

    public async Task<(bool Success, string? Error)> LogoutAsync(string accessToken)
    {
        // Add token to blacklist
        var expirySeconds = _jwtTokenService.GetAccessTokenExpirySeconds();
        await _tokenBlacklistService.AddTokenToBlacklistAsync(accessToken, expirySeconds);

        return (true, null);
    }

    public async Task<(bool Success, string? Error, TokenResponse? Response)> RefreshTokenAsync(string refreshToken)
    {
        // Validate refresh token exists in Redis
        var db = _redis.GetDatabase();
        var keys = _redis.GetServer(_redis.GetEndPoints().First()).Keys(pattern: $"refresh_token:*:{refreshToken}");
        
        if (!keys.Any())
            return (false, "Invalid refresh token", null);

        // Extract userId from key
        var keyStr = keys.First().ToString();
        var parts = keyStr.Split(':');
        if (parts.Length < 3 || !Guid.TryParse(parts[1], out var userId))
            return (false, "Invalid refresh token", null);

        // Get user
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return (false, "User not found", null);

        // Generate new access token
        var accessToken = _jwtTokenService.GenerateAccessToken(user.Id, user.Email, user.Level);

        var response = new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtTokenService.GetAccessTokenExpirySeconds()
        };

        return (true, null, response);
    }

    public async Task<(bool Success, string? Error)> ResetPasswordAsync(string email, string resetToken, string newPassword)
    {
        // Validate reset token from Redis
        var db = _redis.GetDatabase();
        var tokenKey = $"password_reset:{email}:{resetToken}";
        var storedToken = await db.StringGetAsync(tokenKey);

        if (!storedToken.HasValue)
            return (false, "Invalid or expired reset token");

        // Find user
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return (false, "User not found");

        // Validate new password strength
        var passwordValidation = _passwordValidator.Validate(newPassword);
        if (!passwordValidation.IsValid)
            return (false, string.Join("; ", passwordValidation.Errors));

        // Check password reuse
        if (await _passwordHistoryService.IsPasswordReusedAsync(user.Id, newPassword, _passwordHasher))
            return (false, "Cannot reuse a previous password");

        // Hash new password
        var newPasswordHash = _passwordHasher.HashPassword(newPassword);

        // Update user password
        user.PasswordHash = newPasswordHash;
        user.LastPasswordChangeAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;

        _context.Users.Update(user);
        await _context.SaveChangesAsync();

        // Add old password to history
        await _passwordHistoryService.AddPasswordToHistoryAsync(user.Id, newPasswordHash);

        // Delete reset token from Redis
        await db.KeyDeleteAsync(tokenKey);

        return (true, null);
    }

    private bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}
