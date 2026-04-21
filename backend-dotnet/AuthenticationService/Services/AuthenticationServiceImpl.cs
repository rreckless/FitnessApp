using BCrypt.Net;
using AuthenticationService.Data;
using AuthenticationService.Models;
using Microsoft.Extensions.Caching.Distributed;

namespace AuthenticationService.Services;

public class AuthenticationServiceImpl : IAuthenticationService
{
    private readonly AuthDbContext _dbContext;
    private readonly ITokenService _tokenService;
    private readonly IDistributedCache _cache;
    private readonly IConfiguration _configuration;

    public AuthenticationServiceImpl(AuthDbContext dbContext, ITokenService tokenService, IDistributedCache cache, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _tokenService = tokenService;
        _cache = cache;
        _configuration = configuration;
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, string name)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(name))
        {
            return new AuthResult { Success = false, Message = "Email, password, and name are required" };
        }

        var existingUser = _dbContext.Users.FirstOrDefault(u => u.Email == email);
        if (existingUser != null)
        {
            return new AuthResult { Success = false, Message = "User with this email already exists" };
        }

        var passwordHash = BCrypt.HashPassword(password);
        var user = new AuthUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = passwordHash,
            Name = name,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        var accessToken = _tokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshToken = _tokenService.GenerateRefreshToken();

        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(int.Parse(_configuration.GetSection("JwtSettings")["RefreshTokenExpirationDays"]!)),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        return new AuthResult
        {
            Success = true,
            Message = "User registered successfully",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            UserId = user.Id
        };
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return new AuthResult { Success = false, Message = "Email and password are required" };
        }

        var user = _dbContext.Users.FirstOrDefault(u => u.Email == email);
        if (user == null || !BCrypt.Verify(password, user.PasswordHash))
        {
            return new AuthResult { Success = false, Message = "Invalid email or password" };
        }

        var accessToken = _tokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshToken = _tokenService.GenerateRefreshToken();

        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(int.Parse(_configuration.GetSection("JwtSettings")["RefreshTokenExpirationDays"]!)),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        return new AuthResult
        {
            Success = true,
            Message = "Login successful",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            UserId = user.Id
        };
    }

    public async Task LogoutAsync(string token)
    {
        var cacheKey = $"blacklist:{token}";
        await _cache.SetStringAsync(cacheKey, "true", new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
        });
    }
}
