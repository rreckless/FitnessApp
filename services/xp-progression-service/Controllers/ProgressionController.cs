using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using XPProgressionService.Data;
using XPProgressionService.Models;

namespace XPProgressionService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProgressionController : ControllerBase
{
    private readonly XPDbContext _context;
    private readonly ILogger<ProgressionController> _logger;

    public ProgressionController(XPDbContext context, ILogger<ProgressionController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get progression history for a user
    /// </summary>
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<List<ProgressionHistoryResponse>>> GetProgressionHistory(Guid userId, int page = 1, int pageSize = 50)
    {
        try
        {
            if (page < 1 || pageSize < 1 || pageSize > 100)
            {
                return BadRequest(new { error = "Invalid page or pageSize" });
            }

            var history = await _context.ProgressionHistories
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(h => new ProgressionHistoryResponse
                {
                    XPEarned = h.XPEarned,
                    TotalXPAfter = h.TotalXPAfter,
                    LevelBefore = h.LevelBefore,
                    LevelAfter = h.LevelAfter,
                    EventType = h.EventType,
                    CreatedAt = h.CreatedAt
                })
                .ToListAsync();

            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting progression history for user {userId}: {ex.Message}");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}
