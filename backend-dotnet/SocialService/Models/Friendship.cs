namespace SocialService.Models;

public class Friendship
{
    public Guid Id { get; set; }
    public Guid UserId1 { get; set; }
    public Guid UserId2 { get; set; }
    public FriendshipStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum FriendshipStatus
{
    Pending,
    Accepted,
    Blocked
}

public class FriendRequest
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public Guid ReceiverId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserProfile
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public int Level { get; set; }
    public int TotalXP { get; set; }
}
