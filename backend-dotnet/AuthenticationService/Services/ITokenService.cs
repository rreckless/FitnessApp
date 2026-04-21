namespace AuthenticationService.Services;

public interface ITokenService
{
    string GenerateAccessToken(Guid userId, string email);
    string GenerateRefreshToken();
    Task<TokenRefreshResult> RefreshTokenAsync(string refreshToken);
}

public class TokenRefreshResult
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public string? Message { get; set; }
}
