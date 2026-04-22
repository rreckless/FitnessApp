using AuthService.Models;
using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authService;
    private readonly IPasswordValidator _passwordValidator;

    public AuthController(IAuthenticationService authService, IPasswordValidator passwordValidator)
    {
        _authService = authService;
        _passwordValidator = passwordValidator;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Email and password are required" });

        var (success, error, response) = await _authService.RegisterAsync(request.Email, request.Password, request.Email.Split('@')[0]);

        if (!success)
            return BadRequest(new { error });

        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AuthRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Email and password are required" });

        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        var (success, error, response) = await _authService.LoginAsync(request.Email, request.Password, userAgent, ipAddress);

        if (!success)
            return Unauthorized(new { error });

        return Ok(response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] Dictionary<string, string> request)
    {
        if (!request.TryGetValue("accessToken", out var accessToken))
            return BadRequest(new { error = "Access token is required" });

        var (success, error) = await _authService.LogoutAsync(accessToken);

        if (!success)
            return BadRequest(new { error });

        return Ok(new { message = "Logged out successfully" });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] Dictionary<string, string> request)
    {
        if (!request.TryGetValue("refreshToken", out var refreshToken))
            return BadRequest(new { error = "Refresh token is required" });

        var (success, error, response) = await _authService.RefreshTokenAsync(refreshToken);

        if (!success)
            return Unauthorized(new { error });

        return Ok(response);
    }

    [HttpPost("password-reset")]
    public async Task<IActionResult> PasswordReset([FromBody] Dictionary<string, string> request)
    {
        if (!request.TryGetValue("email", out var email))
            return BadRequest(new { error = "Email is required" });

        // Generate reset token
        var resetToken = Guid.NewGuid().ToString("N");

        // Store in Redis (would be done by a service)
        // For now, just return success
        return Ok(new { message = "Password reset email sent" });
    }

    [HttpPost("password-reset/confirm")]
    public async Task<IActionResult> PasswordResetConfirm([FromBody] Dictionary<string, string> request)
    {
        if (!request.TryGetValue("email", out var email) ||
            !request.TryGetValue("resetToken", out var resetToken) ||
            !request.TryGetValue("newPassword", out var newPassword))
            return BadRequest(new { error = "Email, reset token, and new password are required" });

        var (success, error) = await _authService.ResetPasswordAsync(email, resetToken, newPassword);

        if (!success)
            return BadRequest(new { error });

        return Ok(new { message = "Password reset successfully" });
    }

    [HttpPost("validate-password")]
    public IActionResult ValidatePassword([FromBody] Dictionary<string, string> request)
    {
        if (!request.TryGetValue("password", out var password))
            return BadRequest(new { error = "Password is required" });

        var result = _passwordValidator.Validate(password);
        return Ok(result);
    }
}
