namespace GpsRouteService.Models;

public class GpsRoute
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double Distance { get; set; }
    public int EstimatedTime { get; set; }
    public RouteDifficulty Difficulty { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class GpsPoint
{
    public Guid Id { get; set; }
    public Guid WorkoutId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? Elevation { get; set; }
    public float Accuracy { get; set; }
    public DateTime Timestamp { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RouteRating
{
    public Guid Id { get; set; }
    public Guid RouteId { get; set; }
    public Guid UserId { get; set; }
    public int Rating { get; set; }
    public string? Review { get; set; }
    public DateTime CreatedAt { get; set; }
}

public enum RouteDifficulty
{
    Easy,
    Moderate,
    Hard
}
