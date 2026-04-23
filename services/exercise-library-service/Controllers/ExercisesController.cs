using ExerciseLibraryService.Models;
using ExerciseLibraryService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ExerciseLibraryService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExercisesController : ControllerBase
{
    private readonly IExerciseService _exerciseService;
    private readonly ILogger<ExercisesController> _logger;

    public ExercisesController(IExerciseService exerciseService, ILogger<ExercisesController> logger)
    {
        _exerciseService = exerciseService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<ExerciseResponse>>> SearchExercises(
        [FromQuery] string? query,
        [FromQuery] MuscleGroup? muscleGroup,
        [FromQuery] Difficulty? difficulty,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            if (page < 1 || pageSize < 1 || pageSize > 100)
            {
                return BadRequest("Page must be >= 1 and pageSize must be between 1 and 100");
            }

            var request = new ExerciseSearchRequest
            {
                Query = query,
                MuscleGroup = muscleGroup,
                Difficulty = difficulty,
                Page = page,
                PageSize = pageSize
            };

            var result = await _exerciseService.SearchExercisesAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching exercises");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while searching exercises");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExerciseResponse>> GetExerciseById(Guid id)
    {
        try
        {
            var exercise = await _exerciseService.GetExerciseByIdAsync(id);
            if (exercise == null)
            {
                return NotFound($"Exercise with ID {id} not found");
            }

            return Ok(exercise);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercise {ExerciseId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving the exercise");
        }
    }

    [HttpGet("muscle-groups/{muscleGroup}")]
    public async Task<ActionResult<PaginatedResponse<ExerciseResponse>>> GetExercisesByMuscleGroup(
        MuscleGroup muscleGroup,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            if (page < 1 || pageSize < 1 || pageSize > 100)
            {
                return BadRequest("Page must be >= 1 and pageSize must be between 1 and 100");
            }

            var result = await _exerciseService.GetExercisesByMuscleGroupAsync(muscleGroup, page, pageSize);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercises for muscle group {MuscleGroup}", muscleGroup);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving exercises");
        }
    }

    [HttpPost("custom")]
    public async Task<ActionResult<ExerciseResponse>> CreateCustomExercise(
        [FromBody] CreateCustomExerciseRequest request,
        [FromHeader(Name = "X-User-Id")] string? userId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(userId) || !Guid.TryParse(userId, out var userGuid))
            {
                return Unauthorized("User ID is required and must be a valid GUID");
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("Exercise name is required");
            }

            if (string.IsNullOrWhiteSpace(request.Description))
            {
                return BadRequest("Exercise description is required");
            }

            var exercise = await _exerciseService.CreateCustomExerciseAsync(userGuid, request);
            return CreatedAtAction(nameof(GetExerciseById), new { id = exercise.Id }, exercise);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating custom exercise");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while creating the exercise");
        }
    }

    [HttpGet("users/{userId}/custom")]
    public async Task<ActionResult<PaginatedResponse<ExerciseResponse>>> GetUserCustomExercises(
        Guid userId,
        [FromHeader(Name = "X-User-Id")] string? requestingUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(requestingUserId) || !Guid.TryParse(requestingUserId, out var requestingUserGuid))
            {
                return Unauthorized("User ID is required and must be a valid GUID");
            }

            // Users can only view their own custom exercises
            if (requestingUserGuid != userId)
            {
                return Unauthorized("You can only view your own custom exercises");
            }

            if (page < 1 || pageSize < 1 || pageSize > 100)
            {
                return BadRequest("Page must be >= 1 and pageSize must be between 1 and 100");
            }

            var result = await _exerciseService.GetUserCustomExercisesAsync(userId, page, pageSize);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting custom exercises for user {UserId}", userId);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving custom exercises");
        }
    }

    [HttpGet("builtin/all")]
    public async Task<ActionResult<List<ExerciseResponse>>> GetAllBuiltInExercises()
    {
        try
        {
            var exercises = await _exerciseService.GetAllBuiltInExercisesAsync();
            return Ok(exercises);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all built-in exercises");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving exercises");
        }
    }
}
