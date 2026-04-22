using System.Security.Cryptography;
using System.Text;

namespace AuthService.Services;

public interface IDeviceFingerprintService
{
    string GenerateFingerprint(string userAgent, string ipAddress);
    string ExtractDeviceType(string userAgent);
}

public class DeviceFingerprintService : IDeviceFingerprintService
{
    public string GenerateFingerprint(string userAgent, string ipAddress)
    {
        var combined = $"{userAgent}:{ipAddress}";
        using (var sha256 = SHA256.Create())
        {
            var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(combined));
            return Convert.ToBase64String(hashedBytes);
        }
    }

    public string ExtractDeviceType(string userAgent)
    {
        if (string.IsNullOrEmpty(userAgent))
            return "Unknown";

        if (userAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase))
            return "iPhone";
        if (userAgent.Contains("iPad", StringComparison.OrdinalIgnoreCase))
            return "iPad";
        if (userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase))
            return "Android";
        if (userAgent.Contains("Windows", StringComparison.OrdinalIgnoreCase))
            return "Windows";
        if (userAgent.Contains("Mac", StringComparison.OrdinalIgnoreCase))
            return "Mac";
        if (userAgent.Contains("Linux", StringComparison.OrdinalIgnoreCase))
            return "Linux";

        return "Unknown";
    }
}
