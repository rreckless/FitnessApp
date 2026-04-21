namespace BodyTrackingService.Models;

public class BodyWeight
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public float Weight { get; set; }
    public string? Notes { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class BodyMeasurement
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public float? Chest { get; set; }
    public float? Waist { get; set; }
    public float? Hips { get; set; }
    public float? Arms { get; set; }
    public float? Thighs { get; set; }
    public string? Notes { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ProgressPhoto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
