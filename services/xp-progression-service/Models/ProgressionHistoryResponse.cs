namespace XPProgressionService.Models;

public class ProgressionHistoryResponse
{
    public int XPEarned { get; set; }
    public int TotalXPAfter { get; set; }
    public int LevelBefore { get; set; }
    public int LevelAfter { get; set; }
    public string EventType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
