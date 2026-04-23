using ExerciseLibraryService.Data;
using ExerciseLibraryService.Models;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Text.Json;

namespace ExerciseLibraryService.Services;

public interface IExerciseService
{
    Task<PaginatedResponse<ExerciseResponse>> SearchExercisesAsync(ExerciseSearchRequest request);
    Task<ExerciseResponse?> GetExerciseByIdAsync(Guid id);
    Task<PaginatedResponse<ExerciseResponse>> GetExercisesByMuscleGroupAsync(MuscleGroup muscleGroup, int page = 1, int pageSize = 20);
    Task<ExerciseResponse> CreateCustomExerciseAsync(Guid userId, CreateCustomExerciseRequest request);
    Task<PaginatedResponse<ExerciseResponse>> GetUserCustomExercisesAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<List<ExerciseResponse>> GetAllBuiltInExercisesAsync();
}

public class ExerciseService : IExerciseService
{
    private readonly ExerciseDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ExerciseService> _logger;
    private const string CACHE_KEY_PREFIX = "exercises:";
    private const string CACHE_TTL_SECONDS = "604800"; // 1 week

    public ExerciseService(ExerciseDbContext context, IConnectionMultiplexer redis, ILogger<ExerciseService> logger)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
    }

    public async Task<PaginatedResponse<ExerciseResponse>> SearchExercisesAsync(ExerciseSearchRequest request)
    {
        try
        {
            var query = _context.Exercises.AsQueryable();

            // Filter by muscle group if specified
            if (request.MuscleGroup.HasValue)
            {
                query = query.Where(e => e.PrimaryMuscleGroup == request.MuscleGroup.Value ||
                                        e.SecondaryMuscleGroups.Contains(request.MuscleGroup.Value));
            }

            // Filter by difficulty if specified
            if (request.Difficulty.HasValue)
            {
                query = query.Where(e => e.Difficulty == request.Difficulty.Value);
            }

            // Fuzzy search on query if provided
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchTerm = request.Query.ToLower();
                query = query.Where(e => e.Name.ToLower().Contains(searchTerm) ||
                                        e.Description.ToLower().Contains(searchTerm));

                // Sort by relevance (name match first, then description)
                query = query.OrderByDescending(e => e.Name.ToLower().StartsWith(searchTerm))
                            .ThenByDescending(e => e.Name.ToLower().Contains(searchTerm));
            }
            else
            {
                query = query.OrderBy(e => e.Name);
            }

            var totalCount = await query.CountAsync();
            var skip = (request.Page - 1) * request.PageSize;

            var exercises = await query
                .Skip(skip)
                .Take(request.PageSize)
                .ToListAsync();

            var responses = exercises.Select(MapToResponse).ToList();

            return new PaginatedResponse<ExerciseResponse>
            {
                Items = responses,
                Page = request.Page,
                PageSize = request.PageSize,
                TotalCount = totalCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching exercises");
            throw;
        }
    }

    public async Task<ExerciseResponse?> GetExerciseByIdAsync(Guid id)
    {
        try
        {
            // Try to get from cache first
            var db = _redis.GetDatabase();
            var cacheKey = $"{CACHE_KEY_PREFIX}{id}";
            var cachedValue = await db.StringGetAsync(cacheKey);

            if (cachedValue.HasValue)
            {
                _logger.LogInformation("Exercise {ExerciseId} retrieved from cache", id);
                return JsonSerializer.Deserialize<ExerciseResponse>(cachedValue.ToString());
            }

            // Get from database
            var exercise = await _context.Exercises.FirstOrDefaultAsync(e => e.Id == id);
            if (exercise == null)
            {
                return null;
            }

            var response = MapToResponse(exercise);

            // Cache the result
            await db.StringSetAsync(cacheKey, JsonSerializer.Serialize(response), TimeSpan.FromSeconds(int.Parse(CACHE_TTL_SECONDS)));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercise {ExerciseId}", id);
            throw;
        }
    }

    public async Task<PaginatedResponse<ExerciseResponse>> GetExercisesByMuscleGroupAsync(MuscleGroup muscleGroup, int page = 1, int pageSize = 20)
    {
        try
        {
            var query = _context.Exercises
                .Where(e => e.PrimaryMuscleGroup == muscleGroup || e.SecondaryMuscleGroups.Contains(muscleGroup))
                .OrderBy(e => e.Name);

            var totalCount = await query.CountAsync();
            var skip = (page - 1) * pageSize;

            var exercises = await query
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync();

            var responses = exercises.Select(MapToResponse).ToList();

            return new PaginatedResponse<ExerciseResponse>
            {
                Items = responses,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercises for muscle group {MuscleGroup}", muscleGroup);
            throw;
        }
    }

    public async Task<ExerciseResponse> CreateCustomExerciseAsync(Guid userId, CreateCustomExerciseRequest request)
    {
        try
        {
            var exercise = new Exercise
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                Description = request.Description,
                PrimaryMuscleGroup = request.PrimaryMuscleGroup,
                SecondaryMuscleGroups = request.SecondaryMuscleGroups,
                Difficulty = request.Difficulty,
                Equipment = request.Equipment,
                FormTips = request.FormTips,
                VideoUrl = request.VideoUrl,
                IsBuiltIn = false,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Exercises.Add(exercise);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Custom exercise {ExerciseId} created by user {UserId}", exercise.Id, userId);

            return MapToResponse(exercise);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating custom exercise for user {UserId}", userId);
            throw;
        }
    }

    public async Task<PaginatedResponse<ExerciseResponse>> GetUserCustomExercisesAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        try
        {
            var query = _context.Exercises
                .Where(e => e.CreatedByUserId == userId)
                .OrderByDescending(e => e.CreatedAt);

            var totalCount = await query.CountAsync();
            var skip = (page - 1) * pageSize;

            var exercises = await query
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync();

            var responses = exercises.Select(MapToResponse).ToList();

            return new PaginatedResponse<ExerciseResponse>
            {
                Items = responses,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting custom exercises for user {UserId}", userId);
            throw;
        }
    }

    public async Task<List<ExerciseResponse>> GetAllBuiltInExercisesAsync()
    {
        try
        {
            // Try to get from cache first
            var db = _redis.GetDatabase();
            var cacheKey = $"{CACHE_KEY_PREFIX}all_builtin";
            var cachedValue = await db.StringGetAsync(cacheKey);

            if (cachedValue.HasValue)
            {
                _logger.LogInformation("All built-in exercises retrieved from cache");
                return JsonSerializer.Deserialize<List<ExerciseResponse>>(cachedValue.ToString()) ?? new();
            }

            // Get from database
            var exercises = await _context.Exercises
                .Where(e => e.IsBuiltIn)
                .OrderBy(e => e.Name)
                .ToListAsync();

            var responses = exercises.Select(MapToResponse).ToList();

            // Cache the result
            await db.StringSetAsync(cacheKey, JsonSerializer.Serialize(responses), TimeSpan.FromSeconds(int.Parse(CACHE_TTL_SECONDS)));

            return responses;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all built-in exercises");
            throw;
        }
    }

    private ExerciseResponse MapToResponse(Exercise exercise)
    {
        return new ExerciseResponse
        {
            Id = exercise.Id,
            Name = exercise.Name,
            Description = exercise.Description,
            PrimaryMuscleGroup = exercise.PrimaryMuscleGroup.ToString(),
            SecondaryMuscleGroups = exercise.SecondaryMuscleGroups.Select(m => m.ToString()).ToList(),
            Difficulty = exercise.Difficulty.ToString(),
            Equipment = exercise.Equipment.Select(e => e.ToString()).ToList(),
            FormTips = exercise.FormTips,
            VideoUrl = exercise.VideoUrl,
            IsBuiltIn = exercise.IsBuiltIn,
            CreatedAt = exercise.CreatedAt
        };
    }
}
