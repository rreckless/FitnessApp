using Microsoft.EntityFrameworkCore;
using GpsRouteService.Data;
using GpsRouteService.Models;

namespace GpsRouteService.Services;

public class GpsRouteServiceImpl : IGpsRouteService
{
    private readonly GpsDbContext _dbContext;
    private readonly ILogger<GpsRouteServiceImpl> _logger;

    public GpsRouteServiceImpl(GpsDbContext dbContext, ILogger<GpsRouteServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<GpsRoute> CreateRouteAsync(Guid userId, CreateRouteRequest request)
    {
        var route = new GpsRoute
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = request.Name,
            Description = request.Description,
            Distance = request.Distance,
            EstimatedTime = request.EstimatedTime,
            Difficulty = request.Difficulty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.GpsRoutes.Add(route);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Route created: {RouteId}", route.Id);
        return route;
    }

    public async Task<List<GpsRoute>> GetRoutesAsync(int page = 1, int pageSize = 20)
    {
        var skip = (page - 1) * pageSize;
        return await _dbContext.GpsRoutes
            .OrderByDescending(gr => gr.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<GpsRoute?> GetRouteAsync(Guid id)
    {
        return await _dbContext.GpsRoutes.FindAsync(id);
    }

    public async Task<List<GpsPoint>> GetGpsDataAsync(Guid workoutId)
    {
        return await _dbContext.GpsPoints
            .Where(gp => gp.WorkoutId == workoutId)
            .OrderBy(gp => gp.Timestamp)
            .ToListAsync();
    }

    public async Task<GpsPoint> RecordGpsPointAsync(Guid workoutId, double lat, double lng, double? elevation, float accuracy)
    {
        var point = new GpsPoint
        {
            Id = Guid.NewGuid(),
            WorkoutId = workoutId,
            Latitude = lat,
            Longitude = lng,
            Elevation = elevation,
            Accuracy = accuracy,
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.GpsPoints.Add(point);
        await _dbContext.SaveChangesAsync();

        return point;
    }

    public async Task<RouteRating> RateRouteAsync(Guid routeId, Guid userId, int rating, string? review)
    {
        var existing = await _dbContext.RouteRatings
            .FirstOrDefaultAsync(rr => rr.RouteId == routeId && rr.UserId == userId);

        if (existing != null)
        {
            existing.Rating = rating;
            existing.Review = review;
        }
        else
        {
            existing = new RouteRating
            {
                Id = Guid.NewGuid(),
                RouteId = routeId,
                UserId = userId,
                Rating = rating,
                Review = review,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.RouteRatings.Add(existing);
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Route rated: {RouteId} - {Rating}", routeId, rating);
        return existing;
    }
}
