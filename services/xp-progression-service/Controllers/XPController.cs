using Microsoft.AspNetCore.Mvc;
using XPProgressionService.Data;
using XPProgressionService.Models;
using XPProgressionService.Services;

namespace XPProgressionService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class XPController : ControllerBase
{
    private readonly IXPProgressionService _xpProgressionService;
    private readonly IMuscleGroupRankService _muscleGroupRankService;
    private readonly IXPCalculationService _xpCalculationService;
    private readonly XPDbContext _context;
    private readonly ILogger<XPController> _logger;

    public XPController(
        IXPProgressionService xpProgressionService,
        IMuscleGroupRankService muscleGroupRankService,
        IXPCalculationService xpCalculationService,
        XPDbContext context,
        ILogger<XPController> logger)
    {
        _xpProgressionService = xpProgressionService;
        _muscleGroupRankService = muscleGroupRankService;
        _xpCalculationService = xpCalculationService;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get XP and level info for a user
    /// </summary>
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<UserXPResponse>> GetUserXP(Guid userId)
    {
        try
        {
            var userXP = await _xpProgressionService.GetUserXPAsync(userId);
            var response = new UserXPResponse
            {
                UserId = userId,
                TotalXP = userXP.TotalXP,
                CurrentLevel = userXP.CurrentLevel,
                XPToNextLevel = userXP.XPToNextLevel,
                LastXPUpdate = userXP.LastXPUpdate
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting XP for user {userId}: {ex.Message}");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Calculate XP for a workout (internal endpoint)
    /// </summary>
    [HttpPost("calculate")]
    public ActionResult<int> CalculateXP([FromBody] CalculateXPRequest request)
    {
        try
        {
            if (request.TotalVolume < 0)
            {
                return BadRequest(new { error = "Total volume must be non-negative" });
            }

            var difficulty = Enum.Parse<ExerciseDifficulty>(request.Difficulty, ignoreCase: true);
            var xp = _xpCalculationService.CalculateXP(request.TotalVolume, difficulty, request.StreakDays);

            return Ok(new { xp = xp });
        }
        catch (ArgumentException)
        {
            return BadRequest(new { error = "Invalid difficulty value. Must be Compound, Isolation, or Cardio" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error calculating XP: {ex.Message}");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}
