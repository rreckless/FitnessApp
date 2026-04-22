using Microsoft.AspNetCore.Mvc;
using StreakService.Models;
using StreakService.Services;

namespace StreakService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StreaksController : ControllerBase
{
    private readonly IStreakService _streakService;
    private readonly ILogger<StreaksController> _logger;

    public StreaksController(IStreakService streakService, ILogger<StreaksController> logger)
    {
        _streakService = streakService;
        _logger = logger;
    }

    /// <summary>
    /// Increment streak for a user after workout completion
    /// </summary>
    [HttpPost("increment")]
    public async Task<ActionResult<StreakResponse>> IncrementStreak([FromBody] StreakIncrementRequest request)
    {
        try
        {
            if (request.UserId == Guid.Empty)
            {
                return BadRequest("UserId is required");
            }

            var result = await _streakService.IncrementStreakAsync(request.UserId, request.WorkoutDate);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error incrementing streak");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get current and longest streak for a user
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<ActionResult<StreakResponse>> GetStreak(Guid userId)
    {
        try
        {
            if (userId == Guid.Empty)
            {
                return BadRequest("UserId is required");
            }

            var result = await _streakService.GetStreakAsync(userId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, $"Streak not found for user {userId}");
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting streak");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get milestone history for a user
    /// </summary>
    [HttpGet("{userId}/milestones")]
    public async Task<ActionResult<List<StreakMilestone>>> GetMilestones(Guid userId)
    {
        try
        {
            if (userId == Guid.Empty)
            {
                return BadRequest("UserId is required");
            }

            var result = await _streakService.GetMilestonesAsync(userId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting milestones");
            return StatusCode(500, "Internal server error");
        }
    }
}
