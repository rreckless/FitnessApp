using GpsRouteService.Models;

namespace GpsRouteService.Services;

public interface IGpsRouteService
{
    Task<GpsRoute> CreateRouteAsync(Guid userId, CreateRouteRequest request);
    Task<List<GpsRoute>> GetRoutesAsync(int page = 1, int pageSize = 20);
    Task<GpsRoute?> GetRouteAsync(Guid id);
    Task<List<GpsPoint>> GetGpsDataAsync(Guid workoutId);
    Task<GpsPoint> RecordGpsPointAsync(Guid workoutId, double lat, double lng, double? elevation, float accuracy);
    Task<RouteRating> RateRouteAsync(Guid routeId, Guid userId, int rating, string? review);
}

public record CreateRouteRequest(
    string Name,
    string Description,
    double Distance,
    int EstimatedTime,
    RouteDifficulty Difficulty
);
