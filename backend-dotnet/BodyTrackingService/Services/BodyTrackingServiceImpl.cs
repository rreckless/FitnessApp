using Microsoft.EntityFrameworkCore;
using BodyTrackingService.Data;
using BodyTrackingService.Models;

namespace BodyTrackingService.Services;

public class BodyTrackingServiceImpl : IBodyTrackingService
{
    private readonly BodyTrackingDbContext _dbContext;
    private readonly ILogger<BodyTrackingServiceImpl> _logger;

    public BodyTrackingServiceImpl(BodyTrackingDbContext dbContext, ILogger<BodyTrackingServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<BodyWeight> LogWeightAsync(Guid userId, float weight, string? notes)
    {
        var bodyWeight = new BodyWeight
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Weight = weight,
            Notes = notes,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.BodyWeights.Add(bodyWeight);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Weight logged: {UserId} - {Weight}", userId, weight);
        return bodyWeight;
    }

    public async Task<List<BodyWeight>> GetWeightHistoryAsync(Guid userId, DateTime? startDate = null, DateTime? endDate = null)
    {
        var query = _dbContext.BodyWeights.Where(bw => bw.UserId == userId);

        if (startDate.HasValue)
            query = query.Where(bw => bw.RecordedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(bw => bw.RecordedAt <= endDate.Value);

        return await query.OrderByDescending(bw => bw.RecordedAt).ToListAsync();
    }

    public async Task<BodyMeasurement> LogMeasurementsAsync(Guid userId, LogMeasurementsRequest request)
    {
        var measurement = new BodyMeasurement
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Chest = request.Chest,
            Waist = request.Waist,
            Hips = request.Hips,
            Arms = request.Arms,
            Thighs = request.Thighs,
            Notes = request.Notes,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.BodyMeasurements.Add(measurement);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Measurements logged: {UserId}", userId);
        return measurement;
    }

    public async Task<List<BodyMeasurement>> GetMeasurementHistoryAsync(Guid userId, DateTime? startDate = null, DateTime? endDate = null)
    {
        var query = _dbContext.BodyMeasurements.Where(bm => bm.UserId == userId);

        if (startDate.HasValue)
            query = query.Where(bm => bm.RecordedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(bm => bm.RecordedAt <= endDate.Value);

        return await query.OrderByDescending(bm => bm.RecordedAt).ToListAsync();
    }

    public async Task<ProgressPhoto> UploadPhotoAsync(Guid userId, string imageUrl, string thumbnailUrl, string? notes)
    {
        var photo = new ProgressPhoto
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ImageUrl = imageUrl,
            ThumbnailUrl = thumbnailUrl,
            Notes = notes,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.ProgressPhotos.Add(photo);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Photo uploaded: {UserId}", userId);
        return photo;
    }

    public async Task<List<ProgressPhoto>> GetPhotoGalleryAsync(Guid userId)
    {
        return await _dbContext.ProgressPhotos
            .Where(pp => pp.UserId == userId)
            .OrderByDescending(pp => pp.RecordedAt)
            .ToListAsync();
    }

    public async Task DeletePhotoAsync(Guid photoId)
    {
        var photo = await _dbContext.ProgressPhotos.FindAsync(photoId);
        if (photo == null)
            throw new KeyNotFoundException("Photo not found");

        _dbContext.ProgressPhotos.Remove(photo);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Photo deleted: {PhotoId}", photoId);
    }
}
