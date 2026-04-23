namespace AuthenticationService.DTOs;

public class AuthResponse
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
}

public class PasswordValidationResponse
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class ErrorResponse
{
    public string Message { get; set; } = string.Empty;
    public List<string>? Details { get; set; }
}
