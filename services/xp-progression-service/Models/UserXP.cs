namespace XPProgressionService.Models;

public class UserXP
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int TotalXP { get; set; }
    public int CurrentLevel { get; set; }
    public int XPToNextLevel { get; set; }
    public DateTime LastXPUpdate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
