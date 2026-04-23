using SyncService.Models;
using SyncService.Services;
using Microsoft.AspNetCore.Mvc;

namespace SyncService.Controllers;

/// <summary>
/// Controller for sync operations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly ISyncService _syncService;
    private readonly ILogger<SyncController> _logger;

    /// <summary>
    /// Initializes a new instance of the SyncController class.
    /// </summary>
    public SyncController(ISyncService syncService, ILogger<SyncController> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    /// <summary>
    /// Pushes local changes to the cloud.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The sync push request.</param>
    /// <returns>The sync response.</returns>
    [HttpPost("push")]
    public async Task<ActionResult<SyncResponse>> Push(
        [FromQuery] Guid userId,
        [FromBody] SyncPushRequest request)
    {
        if (userId == Guid.Empty)
        {
            _logger.LogWarning("Invalid user ID provided");
            return BadRequest(new { error = "User ID is required" });
        }

        if (request == null || request.Items == null)
        {
            _logger.LogWarning("Invalid sync push request");
            return BadRequest(new { error = "Request body is required" });
        }

        try
        {
            var response = await _syncService.PushAsync(userId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pushing sync for user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    /// <summary>
    /// Pulls changes from the cloud.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The sync pull request.</param>
    /// <returns>The sync pull response.</returns>
    [HttpPost("pull")]
    public async Task<ActionResult<SyncPullResponse>> Pull(
        [FromQuery] Guid userId,
        [FromBody] SyncPullRequest request)
    {
        if (userId == Guid.Empty)
        {
            _logger.LogWarning("Invalid user ID provided");
            return BadRequest(new { error = "User ID is required" });
        }

        if (request == null)
        {
            _logger.LogWarning("Invalid sync pull request");
            return BadRequest(new { error = "Request body is required" });
        }

        try
        {
            var response = await _syncService.PullAsync(userId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pulling sync for user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    /// <summary>
    /// Gets the sync status for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>The sync status response.</returns>
    [HttpGet("status")]
    public async Task<ActionResult<SyncStatusResponse>> GetStatus([FromQuery] Guid userId)
    {
        if (userId == Guid.Empty)
        {
            _logger.LogWarning("Invalid user ID provided");
            return BadRequest(new { error = "User ID is required" });
        }

        try
        {
            var response = await _syncService.GetStatusAsync(userId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sync status for user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }
}
