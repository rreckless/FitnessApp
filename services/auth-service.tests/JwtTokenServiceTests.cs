using AuthService.Services;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using Xunit;

namespace AuthService.Tests;

public class JwtTokenServiceTests
{
    private IJwtTokenService CreateTokenService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "test-secret-key-min-32-characters-long-for-security" },
                { "Jwt:Issuer", "fitquest" },
                { "Jwt:Audience", "fitquest-mobile" },
                { "Jwt:AccessTokenExpiryMinutes", "15" },
                { "Jwt:RefreshTokenExpiryDays", "7" }
            })
            .Build();

        return new JwtTokenService(config);
    }

    [Fact]
    public void GenerateAccessToken_CreatesValidToken()
    {
        // Arrange
        var service = CreateTokenService();
        var userId = Guid.NewGuid();
        var email = "test@example.com";
        var level = 5;

        // Act
        var token = service.GenerateAccessToken(userId, email, level);

        // Assert
        Assert.NotEmpty(token);
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadToken(token) as JwtSecurityToken;
        Assert.NotNull(jwtToken);
        Assert.Equal("fitquest", jwtToken.Issuer);
        Assert.Equal("fitquest-mobile", jwtToken.Audiences.First());
    }

    [Fact]
    public void GenerateAccessToken_IncludesCorrectClaims()
    {
        // Arrange
        var service = CreateTokenService();
        var userId = Guid.NewGuid();
        var email = "test@example.com";
        var level = 5;

        // Act
        var token = service.GenerateAccessToken(userId, email, level);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadToken(token) as JwtSecurityToken;
        Assert.NotNull(jwtToken);
        // Check for claims with full namespace names
        Assert.Contains(jwtToken.Claims, c => c.Type.EndsWith("nameidentifier") && c.Value == userId.ToString());
        Assert.Contains(jwtToken.Claims, c => c.Type.EndsWith("emailaddress") && c.Value == email);
        Assert.Contains(jwtToken.Claims, c => c.Type == "level" && c.Value == level.ToString());
    }

    [Fact]
    public void GenerateRefreshToken_CreatesUniqueTokens()
    {
        // Arrange
        var service = CreateTokenService();

        // Act
        var token1 = service.GenerateRefreshToken();
        var token2 = service.GenerateRefreshToken();

        // Assert
        Assert.NotEmpty(token1);
        Assert.NotEmpty(token2);
        Assert.NotEqual(token1, token2);
    }

    [Fact]
    public void ValidateToken_WithValidToken_ReturnsClaimsPrincipal()
    {
        // Arrange
        var service = CreateTokenService();
        var userId = Guid.NewGuid();
        var email = "test@example.com";
        var level = 5;
        var token = service.GenerateAccessToken(userId, email, level);

        // Act
        var principal = service.ValidateToken(token);

        // Assert
        Assert.NotNull(principal);
        Assert.Contains(principal.Claims, c => c.Type.EndsWith("nameidentifier") && c.Value == userId.ToString());
    }

    [Fact]
    public void ValidateToken_WithInvalidToken_ReturnsNull()
    {
        // Arrange
        var service = CreateTokenService();
        var invalidToken = "invalid.token.here";

        // Act
        var principal = service.ValidateToken(invalidToken);

        // Assert
        Assert.Null(principal);
    }

    [Fact]
    public void GetAccessTokenExpirySeconds_ReturnsCorrectValue()
    {
        // Arrange
        var service = CreateTokenService();

        // Act
        var expirySeconds = service.GetAccessTokenExpirySeconds();

        // Assert
        Assert.Equal(15 * 60, expirySeconds); // 15 minutes in seconds
    }
}
