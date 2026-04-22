using Microsoft.AspNetCore.Mvc;
using WorkoutService.Models;
using WorkoutService.Services;

namespace WorkoutService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkoutController : ControllerBase
{
    private readonly IWorkoutService _workoutService;
    private readonly ILogger<WorkoutController> _logger;

    public WorkoutController(IWorkoutService workoutService, ILogger<WorkoutController> logger)
    {
        _workoutService = workoutService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new workout
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<WorkoutResponse>> CreateWorkout([FromBody] CreateWorkoutRequest request)
    {
        try
        {
            // Get user ID from claims (in real implementation, extract from JWT token)
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            var workout = await _workoutService.CreateWorkoutAsync(userId, request);
            return CreatedAtAction(nameof(GetWorkout), new { id = workout.Id }, MapToResponse(workout));
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating workout: {ex.Message}");
            return StatusCode(500, new { error = "Failed to create workout" });
        }
    }

    /// <summary>
    /// Get a specific workout by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<WorkoutResponse>> GetWorkout(Guid id)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            var workout = await _workoutService.GetWorkoutWithExercisesAsync(id, userId);
            if (workout == null)
                return NotFound($"Workout {id} not found");

            return Ok(MapToResponse(workout));
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting workout: {ex.Message}");
            return StatusCode(500, new { error = "Failed to get workout" });
        }
    }

    /// <summary>
    /// Get all workouts for the current user (paginated)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetWorkouts([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            if (page < 1 || pageSize < 1 || pageSize > 100)
                return BadRequest("Invalid page or pageSize parameters");

            var (workouts, totalCount) = await _workoutService.GetUserWorkoutsAsync(userId, page, pageSize);

            return Ok(new
            {
                data = workouts.Select(MapToResponse),
                pagination = new
                {
                    page,
                    pageSize,
                    totalCount,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting workouts: {ex.Message}");
            return StatusCode(500, new { error = "Failed to get workouts" });
        }
    }

    /// <summary>
    /// Update a workout
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<WorkoutResponse>> UpdateWorkout(Guid id, [FromBody] UpdateWorkoutRequest request)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            var workout = await _workoutService.UpdateWorkoutAsync(id, userId, request);
            return Ok(MapToResponse(workout));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning($"Invalid operation: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error updating workout: {ex.Message}");
            return StatusCode(500, new { error = "Failed to update workout" });
        }
    }

    /// <summary>
    /// Complete a workout
    /// </summary>
    [HttpPost("{id}/complete")]
    public async Task<ActionResult<WorkoutResponse>> CompleteWorkout(Guid id, [FromBody] CompleteWorkoutRequest request)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            var workout = await _workoutService.CompleteWorkoutAsync(id, userId, request);
            return Ok(MapToResponse(workout));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning($"Invalid operation: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error completing workout: {ex.Message}");
            return StatusCode(500, new { error = "Failed to complete workout" });
        }
    }

    /// <summary>
    /// Delete a workout (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkout(Guid id)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == Guid.Empty)
                return Unauthorized("User ID not found in token");

            await _workoutService.DeleteWorkoutAsync(id, userId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning($"Invalid operation: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting workout: {ex.Message}");
            return StatusCode(500, new { error = "Failed to delete workout" });
        }
    }

    private Guid GetUserIdFromClaims()
    {
        // In a real implementation, extract from JWT token claims
        // For now, return a placeholder that should be replaced with actual JWT parsing
        var userIdClaim = User.FindFirst("sub")?.Value ?? User.FindFirst("userId")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
            return userId;

        return Guid.Empty;
    }

    private WorkoutResponse MapToResponse(Workout workout)
    {
        return new WorkoutResponse
        {
            Id = workout.Id,
            UserId = workout.UserId,
            StartTime = workout.StartTime,
            EndTime = workout.EndTime,
            Duration = workout.Duration,
            TotalVolume = workout.TotalVolume,
            TotalXP = workout.TotalXP,
            Notes = workout.Notes,
            IsOfflineCreated = workout.IsOfflineCreated,
            SyncedAt = workout.SyncedAt,
            CreatedAt = workout.CreatedAt,
            UpdatedAt = workout.UpdatedAt,
            Exercises = workout.Exercises?.Select(e => new WorkoutExerciseResponse
            {
                Id = e.Id,
                ExerciseId = e.ExerciseId,
                Order = e.Order,
                Sets = e.Sets,
                TotalVolume = e.TotalVolume
            }).ToList() ?? new List<WorkoutExerciseResponse>()
        };
    }
}
