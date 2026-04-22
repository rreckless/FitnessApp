using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;

namespace XPProgressionService.Services;

public interface IMuscleGroupRankService
{
    Task<MuscleGroupRank> GetMuscleGroupRankAsync(Guid userId, MuscleGroup muscleGroup);
    Task<List<MuscleGroupRank>> GetAllMuscleGroupRanksAsync(Guid userId);
    Task<MuscleGroupRank> UpdateMuscleGroupVolumeAsync(Guid userId, MuscleGroup muscleGroup, int volumeAdded);
    Task<bool> CheckRankUpAsync(Guid userId, MuscleGroup muscleGroup);
}

public class MuscleGroupRankService : IMuscleGroupRankService
{
    private readonly XPDbContext _context;
    private readonly ILogger<MuscleGroupRankService> _logger;

    // Rank thresholds (cumulative volume in lbs)
    private static readonly Dictionary<int, int> RankThresholds = new()
    {
        { 1, 0 },
        { 2, 5000 },
        { 3, 15000 },
        { 4, 30000 },
        { 5, 50000 },
        { 6, 75000 },
        { 7, 105000 },
        { 8, 140000 },
        { 9, 180000 },
        { 10, 225000 }
    };

    public MuscleGroupRankService(XPDbContext context, ILogger<MuscleGroupRankService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<MuscleGroupRank> GetMuscleGroupRankAsync(Guid userId, MuscleGroup muscleGroup)
    {
        var rank = await _context.MuscleGroupRanks
            .FirstOrDefaultAsync(r => r.UserId == userId && r.MuscleGroup == muscleGroup);

        if (rank == null)
        {
            // Initialize new muscle group rank at Rank 1 with 0 volume
            rank = new MuscleGroupRank
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MuscleGroup = muscleGroup,
                Rank = 1,
                TotalVolume = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.MuscleGroupRanks.Add(rank);
            await _context.SaveChangesAsync();
            _logger.LogInformation($"Initialized rank for user {userId}, muscle group {muscleGroup}");
        }

        return rank;
    }

    public async Task<List<MuscleGroupRank>> GetAllMuscleGroupRanksAsync(Guid userId)
    {
        var ranks = await _context.MuscleGroupRanks
            .Where(r => r.UserId == userId)
            .ToListAsync();

        // Ensure all muscle groups are initialized
        foreach (MuscleGroup muscleGroup in Enum.GetValues(typeof(MuscleGroup)))
        {
            if (!ranks.Any(r => r.MuscleGroup == muscleGroup))
            {
                await GetMuscleGroupRankAsync(userId, muscleGroup);
            }
        }

        return await _context.MuscleGroupRanks
            .Where(r => r.UserId == userId)
            .ToListAsync();
    }

    public async Task<MuscleGroupRank> UpdateMuscleGroupVolumeAsync(Guid userId, MuscleGroup muscleGroup, int volumeAdded)
    {
        var rank = await GetMuscleGroupRankAsync(userId, muscleGroup);
        int rankBefore = rank.Rank;

        // Add volume
        rank.TotalVolume += volumeAdded;
        rank.UpdatedAt = DateTime.UtcNow;

        // Check for rank up
        await ProcessRankUpAsync(rank);

        await _context.SaveChangesAsync();
        _logger.LogInformation($"Updated volume for user {userId}, muscle group {muscleGroup}. Total volume: {rank.TotalVolume}, Rank: {rank.Rank}");

        return rank;
    }

    public async Task<bool> CheckRankUpAsync(Guid userId, MuscleGroup muscleGroup)
    {
        var rank = await GetMuscleGroupRankAsync(userId, muscleGroup);
        var nextRankThreshold = GetNextRankThreshold(rank.Rank);
        return rank.TotalVolume >= nextRankThreshold;
    }

    private async Task ProcessRankUpAsync(MuscleGroupRank rank)
    {
        // Check for rank ups (can rank up multiple times)
        while (true)
        {
            var nextRankThreshold = GetNextRankThreshold(rank.Rank);
            if (rank.TotalVolume >= nextRankThreshold && rank.Rank < 10)
            {
                rank.Rank++;
                _logger.LogInformation($"User {rank.UserId} ranked up to rank {rank.Rank} for muscle group {rank.MuscleGroup}");
            }
            else
            {
                break;
            }
        }
    }

    private int GetRankThreshold(int rank)
    {
        return RankThresholds.TryGetValue(rank, out var threshold) ? threshold : 0;
    }

    private int GetNextRankThreshold(int currentRank)
    {
        int nextRank = currentRank + 1;
        return RankThresholds.TryGetValue(nextRank, out var threshold) ? threshold : int.MaxValue;
    }
}
