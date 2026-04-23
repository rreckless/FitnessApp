using System.Text.RegularExpressions;

namespace AuthenticationService.Services;

public interface IPasswordValidator
{
    (bool IsValid, List<string> Errors) ValidatePassword(string password);
}

public class PasswordValidator : IPasswordValidator
{
    private const int MinimumLength = 12;

    public (bool IsValid, List<string> Errors) ValidatePassword(string password)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(password))
        {
            errors.Add("Password cannot be empty");
            return (false, errors);
        }

        if (password.Length < MinimumLength)
        {
            errors.Add($"Password must be at least {MinimumLength} characters long");
        }

        if (!Regex.IsMatch(password, @"[A-Z]"))
        {
            errors.Add("Password must contain at least one uppercase letter");
        }

        if (!Regex.IsMatch(password, @"[a-z]"))
        {
            errors.Add("Password must contain at least one lowercase letter");
        }

        if (!Regex.IsMatch(password, @"[0-9]"))
        {
            errors.Add("Password must contain at least one number");
        }

        if (!Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':"",.<>?/\\|`~]"))
        {
            errors.Add("Password must contain at least one special character");
        }

        return (errors.Count == 0, errors);
    }
}
