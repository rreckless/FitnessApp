using ProgressTrackingService.Models;

namespace ProgressTrackingService.Services;

public interface IProgressTrackingService
{
    Task<PersonalRecord> RecordPRAsync(Guid userId, Guid exerciseId, int weight, int reps);
    Task<List<PersonalRecord>> GetPRsAsync(Guid userId);
    Task<PersonalRecord?> GetExercisePRAsync(Guid userId, Guid exerciseId);
    Task<VolumeData?> GetVolumeDataAsync(Guid userId, DateTime date);
    Task<List<VolumeData>> GetVolumeRangeAsync(Guid userId, DateTime startDate, DateTime endDate);
    Task UpdateVolumeAsync(Guid userId, DateTime date, int volume);
}
