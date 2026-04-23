using AuthenticationService.Data;
using AuthenticationService.DTOs;
using AuthenticationService.Models;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuthenticationService.Services;

public interface IAuthenticationService
{
    Task<(bool Success, AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request);
    Task<(bool Success, AuthResponse? Response, string? Error)> LoginAsync(LoginRequest request);
    Task<(bool Success, AuthResponse? Response, string? Error)> RefreshTokenAsync(RefreshTokenRequest request);
    Task<bool> LogoutAsync(string token);
    Task<(bool Success, string? Error)> RequestPasswordResetAsync(string email);
    Task<(bool Success, string? Error)> ConfirmPasswordResetAsync(PasswordResetConfirmRequest request);
}

public class AuthenticationServiceImpl : IAuthenticationService
{
    private readonly AuthDbContext _dbContext;
    private readonly IPasswordValidator _passwordValidator;
    private readonly IConnectionMultiplexer _redis;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthenticationServiceImpl> _logger;

    private const int PasswordHistoryLimit = 5;
    private const int AccessTokenExpirationMinutes = 15;
    private const int RefreshTokenExpirationDays = 7;

    public AuthenticationServiceImpl(
        AuthDbContext dbContext,
        IPasswordValidator passwordValidator,
        IConnectionMultiplexer redis,
        IConfiguration configuration,
        ILogger<AuthenticationServiceImpl> logger)
    {
        _dbContext = dbContext;
        _passwordValidator = passwordValidator;
        _redis = redis;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<(bool Success, AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request)
    {
        try
        {
            // Validate email format
            if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains("@"))
            {
                return (false, null, "Invalid email format");
            }

            // Check if user already exists
            var existingUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (existingUser != null)
            {
                return (false, null, "User with this email already exists");
            }

            // Validate password strength
            var (isValid, errors) = _passwordValidator.ValidatePassword(request.Password);
            if (!isValid)
            {
                return (false, null, string.Join(", ", errors));
            }

            // Create new user
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = request.Email,
                Name = request.Name,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                LastPasswordChangeAt = DateTime.UtcNow
            };

            _dbContext.Users.Add(user);

            // Add to password history
            var passwordHistory = new PasswordHistory
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                PasswordHash = user.PasswordHash,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.PasswordHistories.Add(passwordHistory);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"User registered: {user.Email}");

            // Generate tokens
            var accessToken = GenerateAccessToken(user);
            var refreshToken = GenerateRefreshToken(user);

            // Store refresh token in Redis
            await StoreRefreshTokenAsync(user.Id, refreshToken);

            return (true, new AuthResponse
            {
                UserId = user.Id,
                Email = user.Email,
                Name = user.Name,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = AccessTokenExpirationMinutes * 60
            }, null);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Registration error: {ex.Message}");
            return (false, null, "An error occurred during registration");
        }
    }

    public async Task<(bool Success, AuthResponse? Response, string? Error)> LoginAsync(LoginRequest request)
    {
        try
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
            {
                return (false, null, "Invalid email or password");
            }

            // Verify password
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return (false, null, "Invalid email or password");
            }

            _logger.LogInformation($"User logged in: {user.Email}");

            // Generate tokens
            var accessToken = GenerateAccessToken(user);
            var refreshToken = GenerateRefreshToken(user);

            // Store refresh token in Redis
            await StoreRefreshTokenAsync(user.Id, refreshToken);

            return (true, new AuthResponse
            {
                UserId = user.Id,
                Email = user.Email,
                Name = user.Name,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = AccessTokenExpirationMinutes * 60
            }, null);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Login error: {ex.Message}");
            return (false, null, "An error occurred during login");
        }
    }

    public async Task<(bool Success, AuthResponse? Response, string? Error)> RefreshTokenAsync(RefreshTokenRequest request)
    {
        try
        {
            // Validate refresh token
            var principal = GetPrincipalFromExpiredToken(request.RefreshToken);
            if (principal == null)
            {
                return (false, null, "Invalid refresh token");
            }

            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return (false, null, "Invalid token claims");
            }

            // Check if refresh token is valid in Redis
            var isValid = await ValidateRefreshTokenAsync(userId, request.RefreshToken);
            if (!isValid)
            {
                return (false, null, "Refresh token has expired or been revoked");
            }

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return (false, null, "User not found");
            }

            // Generate new tokens
            var accessToken = GenerateAccessToken(user);
            var refreshToken = GenerateRefreshToken(user);

            // Update refresh token in Redis
            await StoreRefreshTokenAsync(user.Id, refreshToken);

            return (true, new AuthResponse
            {
                UserId = user.Id,
                Email = user.Email,
                Name = user.Name,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = AccessTokenExpirationMinutes * 60
            }, null);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Token refresh error: {ex.Message}");
            return (false, null, "An error occurred during token refresh");
        }
    }

    public async Task<bool> LogoutAsync(string token)
    {
        try
        {
            var principal = GetPrincipalFromExpiredToken(token);
            if (principal == null)
            {
                return false;
            }

            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return false;
            }

            // Invalidate refresh token in Redis
            var db = _redis.GetDatabase();
            await db.KeyDeleteAsync($"refresh_token:{userId}");

            _logger.LogInformation($"User logged out: {userId}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Logout error: {ex.Message}");
            return false;
        }
    }

    public async Task<(bool Success, string? Error)> RequestPasswordResetAsync(string email)
    {
        try
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                // Don't reveal if user exists
                return (true, null);
            }

            // Generate reset token
            var resetToken = Guid.NewGuid().ToString();
            var db = _redis.GetDatabase();
            await db.StringSetAsync($"password_reset:{resetToken}", user.Id.ToString(), TimeSpan.FromHours(1));

            _logger.LogInformation($"Password reset requested for: {email}");
            return (true, null);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Password reset request error: {ex.Message}");
            return (false, "An error occurred");
        }
    }

    public async Task<(bool Success, string? Error)> ConfirmPasswordResetAsync(PasswordResetConfirmRequest request)
    {
        try
        {
            // Validate new password
            var (isValid, errors) = _passwordValidator.ValidatePassword(request.NewPassword);
            if (!isValid)
            {
                return (false, string.Join(", ", errors));
            }

            // Get user ID from reset token
            var db = _redis.GetDatabase();
            var userIdStr = await db.StringGetAsync($"password_reset:{request.Token}");
            if (!userIdStr.HasValue || !Guid.TryParse(userIdStr.ToString(), out var userId))
            {
                return (false, "Invalid or expired reset token");
            }

            var user = await _dbContext.Users.Include(u => u.PasswordHistory)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return (false, "User not found");
            }

            // Check password reuse
            var recentPasswords = user.PasswordHistory
                .OrderByDescending(ph => ph.CreatedAt)
                .Take(PasswordHistoryLimit)
                .ToList();

            foreach (var oldPassword in recentPasswords)
            {
                if (BCrypt.Net.BCrypt.Verify(request.NewPassword, oldPassword.PasswordHash))
                {
                    return (false, "Cannot reuse a recent password");
                }
            }

            // Update password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.LastPasswordChangeAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            // Add to password history
            var passwordHistory = new PasswordHistory
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                PasswordHash = user.PasswordHash,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.PasswordHistories.Add(passwordHistory);
            await _dbContext.SaveChangesAsync();

            // Delete reset token
            await db.KeyDeleteAsync($"password_reset:{request.Token}");

            _logger.LogInformation($"Password reset confirmed for: {user.Email}");
            return (true, null);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Password reset confirmation error: {ex.Message}");
            return (false, "An error occurred");
        }
    }

    private string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:SecretKey"] ?? "your-secret-key-change-in-production"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim("subscription_tier", user.SubscriptionTier)
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "fitquest",
            audience: _configuration["Jwt:Audience"] ?? "fitquest-app",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateRefreshToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:RefreshSecretKey"] ?? "your-refresh-secret-key-change-in-production"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("token_type", "refresh")
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "fitquest",
            audience: _configuration["Jwt:Audience"] ?? "fitquest-app",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        try
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:RefreshSecretKey"] ?? "your-refresh-secret-key-change-in-production"));
            var tokenHandler = new JwtSecurityTokenHandler();

            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = _configuration["Jwt:Issuer"] ?? "fitquest",
                ValidateAudience = true,
                ValidAudience = _configuration["Jwt:Audience"] ?? "fitquest-app",
                ValidateLifetime = false // Allow expired tokens for refresh
            }, out SecurityToken securityToken);

            return principal;
        }
        catch
        {
            return null;
        }
    }

    private async Task StoreRefreshTokenAsync(Guid userId, string refreshToken)
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync($"refresh_token:{userId}", refreshToken, TimeSpan.FromDays(RefreshTokenExpirationDays));
    }

    private async Task<bool> ValidateRefreshTokenAsync(Guid userId, string refreshToken)
    {
        var db = _redis.GetDatabase();
        var storedToken = await db.StringGetAsync($"refresh_token:{userId}");
        return storedToken.HasValue && storedToken.ToString() == refreshToken;
    }
}
