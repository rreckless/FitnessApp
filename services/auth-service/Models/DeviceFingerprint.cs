namespace AuthService.Models;

public class DeviceFingerprint
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Fingerprint { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime LastUsedAt { get; set; }
}
