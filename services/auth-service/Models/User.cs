namespace AuthService.Models;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public string ProfilePictureUrl { get; set; } = string.Empty;
    public int Level { get; set; } = 1;
    public int TotalXP { get; set; } = 0;
    public int CurrentStreak { get; set; } = 0;
    public int LongestStreak { get; set; } = 0;
    public DateTime LastPasswordChangeAt { get; set; }
    public string SubscriptionTier { get; set; } = "FREE"; // FREE, PREMIUM
    public DateTime? SubscriptionExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime LastSyncAt { get; set; }
    public ICollection<PasswordHistory> PasswordHistory { get; set; } = new List<PasswordHistory>();
}
