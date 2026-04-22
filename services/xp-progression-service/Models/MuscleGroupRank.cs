namespace XPProgressionService.Models;

public enum MuscleGroup
{
    Chest,
    Back,
    Shoulders,
    Arms,
    Legs,
    Core
}

public class MuscleGroupRank
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public MuscleGroup MuscleGroup { get; set; }
    public int Rank { get; set; }
    public int TotalVolume { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
