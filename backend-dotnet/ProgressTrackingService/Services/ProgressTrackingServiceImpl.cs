using Microsoft.EntityFrameworkCore;
using ProgressTrackingService.Data;
using ProgressTrackingService.Models;

namespace ProgressTrackingService.Services;

public class ProgressTrackingServiceImpl : IProgressTrackingService
{
    private readonly ProgressDbContext _dbContext;
    private readonly ILogger<ProgressTrackingServiceImpl> _logger;

    public ProgressTrackingServiceImpl(ProgressDbContext dbContext, ILogger<ProgressTrackingServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<PersonalRecord> RecordPRAsync(Guid userId, Guid exerciseId, int weight, int reps)
    {
        var existing = await _dbContext.PersonalRecords
            .Where(pr => pr.UserId == userId && pr.ExerciseId == exerciseId)
            .OrderByDescending(pr => pr.Weight)
            .ThenByDescending(pr => pr.Reps)
            .FirstOrDefaultAsync();

        if (existing != null && existing.Weight >= weight && existing.Reps >= reps)
        {
            return existing;
        }

        var pr = new PersonalRecord
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ExerciseId = exerciseId,
            Weight = weight,
            Reps = reps,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PersonalRecords.Add(pr);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("PR recorded: {UserId} - {ExerciseId} - {Weight}x{Reps}", userId, exerciseId, weight, reps);
        return pr;
    }

    public async Task<List<PersonalRecord>> GetPRsAsync(Guid userId)
    {
        return await _dbContext.PersonalRecords
            .Where(pr => pr.UserId == userId)
            .OrderByDescending(pr => pr.Weight)
            .ToListAsync();
    }

    public async Task<PersonalRecord?> GetExercisePRAsync(Guid userId, Guid exerciseId)
    {
        return await _dbContext.PersonalRecords
            .Where(pr => pr.UserId == userId && pr.ExerciseId == exerciseId)
            .OrderByDescending(pr => pr.Weight)
            .ThenByDescending(pr => pr.Reps)
            .FirstOrDefaultAsync();
    }

    public async Task<VolumeData?> GetVolumeDataAsync(Guid userId, DateTime date)
    {
        var dateOnly = date.Date;
        return await _dbContext.VolumeData
            .FirstOrDefaultAsync(vd => vd.UserId == userId && vd.Date == dateOnly);
    }

    public async Task<List<VolumeData>> GetVolumeRangeAsync(Guid userId, DateTime startDate, DateTime endDate)
    {
        return await _dbContext.VolumeData
            .Where(vd => vd.UserId == userId && vd.Date >= startDate.Date && vd.Date <= endDate.Date)
            .OrderBy(vd => vd.Date)
            .ToListAsync();
    }

    public async Task UpdateVolumeAsync(Guid userId, DateTime date, int volume)
    {
        var dateOnly = date.Date;
        var existing = await _dbContext.VolumeData
            .FirstOrDefaultAsync(vd => vd.UserId == userId && vd.Date == dateOnly);

        if (existing != null)
        {
            existing.DailyVolume = volume;
            existing.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            var volumeData = new VolumeData
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Date = dateOnly,
                DailyVolume = volume,
                WeeklyVolume = 0,
                MonthlyVolume = 0,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.VolumeData.Add(volumeData);
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Volume updated: {UserId} - {Date} - {Volume}", userId, dateOnly, volume);
    }
}
