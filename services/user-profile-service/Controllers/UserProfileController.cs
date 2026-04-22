using Microsoft.AspNetCore.Mvc;
using UserProfileService.Models;
using UserProfileService.Services;

namespace UserProfileService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserProfileController : ControllerBase
{
    private readonly IUserProfileService _userProfileService;
    private readonly ILogger<UserProfileController> _logger;

    public UserProfileController(
        IUserProfileService userProfileService,
        ILogger<UserProfileController> logger)
    {
        _userProfileService = userProfileService;
        _logger = logger;
    }

    /// <summary>
    /// Get user profile by user ID
    /// </summary>
    [HttpGet("{userId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfile>> GetUserProfile(Guid userId)
    {
        try
        {
            var profile = await _userProfileService.GetUserProfileAsync(userId);
            if (profile == null)
            {
                return NotFound(new { message = $"Profile not found for user {userId}" });
            }

            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user profile");
            return StatusCode(StatusCodes.Status500InternalServerError, 
                new { message = "An error occurred while retrieving the profile" });
        }
    }

    /// <summary>
    /// Update user profile
    /// </summary>
    [HttpPut("{userId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfile>> UpdateUserProfile(Guid userId, [FromBody] UpdateProfileRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body cannot be empty" });
            }

            var profile = await _userProfileService.UpdateUserProfileAsync(userId, request);
            return Ok(profile);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "An error occurred while updating the profile" });
        }
    }

    /// <summary>
    /// Get user preferences
    /// </summary>
    [HttpGet("{userId}/preferences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserPreferences>> GetUserPreferences(Guid userId)
    {
        try
        {
            var preferences = await _userProfileService.GetUserPreferencesAsync(userId);
            if (preferences == null)
            {
                return NotFound(new { message = $"Preferences not found for user {userId}" });
            }

            return Ok(preferences);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user preferences");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "An error occurred while retrieving preferences" });
        }
    }

    /// <summary>
    /// Update user preferences
    /// </summary>
    [HttpPut("{userId}/preferences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserPreferences>> UpdateUserPreferences(Guid userId, [FromBody] UpdatePreferencesRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body cannot be empty" });
            }

            var preferences = await _userProfileService.UpdateUserPreferencesAsync(userId, request);
            return Ok(preferences);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user preferences");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "An error occurred while updating preferences" });
        }
    }

    /// <summary>
    /// Generate presigned URL for profile picture upload
    /// </summary>
    [HttpPost("{userId}/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> GenerateAvatarUploadUrl(Guid userId, [FromQuery] string fileName)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return BadRequest(new { message = "File name is required" });
            }

            var uploadUrl = await _userProfileService.GenerateProfilePictureUploadUrlAsync(userId, fileName);
            return Ok(new { uploadUrl });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating avatar upload URL");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "An error occurred while generating upload URL" });
        }
    }

    /// <summary>
    /// Update profile picture URL after upload
    /// </summary>
    [HttpPut("{userId}/avatar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAvatarUrl(Guid userId, [FromBody] object request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body cannot be empty" });
            }

            // Extract pictureUrl from request
            var requestDict = request as Dictionary<string, object>;
            if (requestDict == null || !requestDict.ContainsKey("pictureUrl"))
            {
                return BadRequest(new { message = "pictureUrl is required" });
            }

            var pictureUrl = requestDict["pictureUrl"].ToString();
            if (string.IsNullOrWhiteSpace(pictureUrl))
            {
                return BadRequest(new { message = "pictureUrl cannot be empty" });
            }

            await _userProfileService.UpdateProfilePictureUrlAsync(userId, pictureUrl);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating avatar URL");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "An error occurred while updating avatar URL" });
        }
    }
}
