using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Caching.Distributed;
using AuthenticationService.Data;

namespace AuthenticationService.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;
    private readonly IDistributedCache _cache;
    private readonly AuthDbContext _dbContext;

    public TokenService(IConfiguration configuration, IDistributedCache cache, AuthDbContext dbContext)
    {
        _configuration = configuration;
        _cache = cache;
        _dbContext = dbContext;
    }

    public string GenerateAccessToken(Guid userId, string email)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!));
        var credentials = new SigningCredentials(secretKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim("sub", userId.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(int.Parse(jwtSettings["ExpirationMinutes"]!)),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }
    }

    public async Task<TokenRefreshResult> RefreshTokenAsync(string refreshToken)
    {
        var token = _dbContext.RefreshTokens.FirstOrDefault(t => t.Token == refreshToken);
        
        if (token == null || token.ExpiresAt < DateTime.UtcNow)
        {
            return new TokenRefreshResult { Success = false, Message = "Invalid or expired refresh token" };
        }

        var user = token.User;
        var newAccessToken = GenerateAccessToken(user.Id, user.Email);
        var newRefreshToken = GenerateRefreshToken();

        token.Token = newRefreshToken;
        token.ExpiresAt = DateTime.UtcNow.AddDays(int.Parse(_configuration.GetSection("JwtSettings")["RefreshTokenExpirationDays"]!));
        
        _dbContext.RefreshTokens.Update(token);
        await _dbContext.SaveChangesAsync();

        return new TokenRefreshResult
        {
            Success = true,
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken
        };
    }
}
