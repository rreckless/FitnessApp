namespace AuthenticationService.Services;

public interface IAuthenticationService
{
    Task<AuthResult> RegisterAsync(string email, string password, string name);
    Task<AuthResult> LoginAsync(string email, string password);
    Task LogoutAsync(string token);
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public Guid? UserId { get; set; }
}
