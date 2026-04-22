namespace XPProgressionService.Models;

public class UserXPResponse
{
    public Guid UserId { get; set; }
    public int TotalXP { get; set; }
    public int CurrentLevel { get; set; }
    public int XPToNextLevel { get; set; }
    public DateTime LastXPUpdate { get; set; }
}
