namespace AuthenticationService.Models;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Level { get; set; } = 1;
    public int TotalXP { get; set; } = 0;
    public int CurrentStreak { get; set; } = 0;
    public int LongestStreak { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSyncAt { get; set; } = DateTime.UtcNow;
    public string SubscriptionTier { get; set; } = "FREE";
    public DateTime? SubscriptionExpiresAt { get; set; }
    public DateTime LastPasswordChangeAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<PasswordHistory> PasswordHistory { get; set; } = new List<PasswordHistory>();
}
