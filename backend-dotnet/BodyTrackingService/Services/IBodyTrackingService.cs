using BodyTrackingService.Models;

namespace BodyTrackingService.Services;

public interface IBodyTrackingService
{
    Task<BodyWeight> LogWeightAsync(Guid userId, float weight, string? notes);
    Task<List<BodyWeight>> GetWeightHistoryAsync(Guid userId, DateTime? startDate = null, DateTime? endDate = null);
    Task<BodyMeasurement> LogMeasurementsAsync(Guid userId, LogMeasurementsRequest request);
    Task<List<BodyMeasurement>> GetMeasurementHistoryAsync(Guid userId, DateTime? startDate = null, DateTime? endDate = null);
    Task<ProgressPhoto> UploadPhotoAsync(Guid userId, string imageUrl, string thumbnailUrl, string? notes);
    Task<List<ProgressPhoto>> GetPhotoGalleryAsync(Guid userId);
    Task DeletePhotoAsync(Guid photoId);
}

public record LogMeasurementsRequest(
    float? Chest,
    float? Waist,
    float? Hips,
    float? Arms,
    float? Thighs,
    string? Notes
);
