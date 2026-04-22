using System.Text.RegularExpressions;
using AuthService.Models;

namespace AuthService.Services;

public interface IPasswordValidator
{
    PasswordValidationResult Validate(string password);
}

public class PasswordValidator : IPasswordValidator
{
    private const int MinimumLength = 12;
    private const string SpecialCharacters = "!@#$%^&*";

    public PasswordValidationResult Validate(string password)
    {
        var result = new PasswordValidationResult { IsValid = true };

        if (string.IsNullOrEmpty(password))
        {
            result.IsValid = false;
            result.Errors.Add("Password is required");
            return result;
        }

        if (password.Length < MinimumLength)
        {
            result.IsValid = false;
            result.Errors.Add($"Password must be at least {MinimumLength} characters");
        }

        if (!Regex.IsMatch(password, @"[A-Z]"))
        {
            result.IsValid = false;
            result.Errors.Add("Password must contain at least one uppercase letter");
        }

        if (!Regex.IsMatch(password, @"[a-z]"))
        {
            result.IsValid = false;
            result.Errors.Add("Password must contain at least one lowercase letter");
        }

        if (!Regex.IsMatch(password, @"[0-9]"))
        {
            result.IsValid = false;
            result.Errors.Add("Password must contain at least one number");
        }

        var specialCharPattern = $"[{Regex.Escape(SpecialCharacters)}]";
        if (!Regex.IsMatch(password, specialCharPattern))
        {
            result.IsValid = false;
            result.Errors.Add($"Password must contain at least one special character ({SpecialCharacters})");
        }

        return result;
    }
}
