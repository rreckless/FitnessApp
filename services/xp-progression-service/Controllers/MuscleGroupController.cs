using Microsoft.AspNetCore.Mvc;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MuscleGroupController : ControllerBase
{
    private readonly IMuscleGroupRankService _muscleGroupRankService;
    private readonly ILogger<MuscleGroupController> _logger;

    public MuscleGroupController(
        IMuscleGroupRankService muscleGroupRankService,
        ILogger<MuscleGroupController> logger)
    {
        _muscleGroupRankService = muscleGroupRankService;
        _logger = logger;
    }

    /// <summary>
    /// Get muscle group ranks for a user
    /// </summary>
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<List<MuscleGroupRankResponse>>> GetMuscleGroupRanks(Guid userId)
    {
        try
        {
            var ranks = await _muscleGroupRankService.GetAllMuscleGroupRanksAsync(userId);
            var response = ranks.Select(r => new MuscleGroupRankResponse
            {
                MuscleGroup = r.MuscleGroup.ToString(),
                Rank = r.Rank,
                TotalVolume = r.TotalVolume
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting muscle group ranks for user {userId}: {ex.Message}");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Get specific muscle group rank for a user
    /// </summary>
    [HttpGet("users/{userId}/{muscleGroup}")]
    public async Task<ActionResult<MuscleGroupRankResponse>> GetMuscleGroupRank(Guid userId, string muscleGroup)
    {
        try
        {
            if (!Enum.TryParse<MuscleGroup>(muscleGroup, ignoreCase: true, out var parsedMuscleGroup))
            {
                return BadRequest(new { error = "Invalid muscle group" });
            }

            var rank = await _muscleGroupRankService.GetMuscleGroupRankAsync(userId, parsedMuscleGroup);
            var response = new MuscleGroupRankResponse
            {
                MuscleGroup = rank.MuscleGroup.ToString(),
                Rank = rank.Rank,
                TotalVolume = rank.TotalVolume
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting muscle group rank for user {userId}: {ex.Message}");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}
