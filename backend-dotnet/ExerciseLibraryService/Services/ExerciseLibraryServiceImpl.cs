using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using ExerciseLibraryService.Data;
using ExerciseLibraryService.Models;

namespace ExerciseLibraryService.Services;

public class ExerciseLibraryServiceImpl : IExerciseLibraryService
{
    private readonly ExerciseDbContext _dbContext;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ExerciseLibraryServiceImpl> _logger;

    public ExerciseLibraryServiceImpl(
        ExerciseDbContext dbContext,
        IDistributedCache cache,
        ILogger<ExerciseLibraryServiceImpl> logger)
    {
        _dbContext = dbContext;
        _cache = cache;
        _logger = logger;
    }

    public async Task<List<Exercise>> SearchExercisesAsync(string? query, string? muscleGroup, int limit = 50)
    {
        try
        {
            var cacheKey = $"exercises:search:{query}:{muscleGroup}:{limit}";
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cached))
            {
                _logger.LogInformation("Exercise search cache hit for query '{Query}'", query);
                return JsonSerializer.Deserialize<List<Exercise>>(cached) ?? new List<Exercise>();
            }

            var queryable = _dbContext.Exercises.AsQueryable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                var searchTerm = query.ToLower();
                queryable = queryable.Where(e => e.Name.ToLower().Contains(searchTerm) ||
                                                 e.Description.ToLower().Contains(searchTerm));
            }

            if (!string.IsNullOrWhiteSpace(muscleGroup))
            {
                queryable = queryable.Where(e => e.PrimaryMuscleGroup == muscleGroup ||
                                                 e.SecondaryMuscleGroups.Contains(muscleGroup));
            }

            var results = await queryable.Take(limit).ToListAsync();

            // Cache for 1 week
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(results), cacheOptions);

            _logger.LogInformation("Found {Count} exercises for query '{Query}' and muscle group '{MuscleGroup}'",
                results.Count, query, muscleGroup);

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching exercises");
            throw;
        }
    }

    public async Task<Exercise?> GetExerciseAsync(Guid id)
    {
        try
        {
            var cacheKey = $"exercise:{id}";
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cached))
            {
                _logger.LogInformation("Exercise cache hit for id {Id}", id);
                return JsonSerializer.Deserialize<Exercise>(cached);
            }

            var exercise = await _dbContext.Exercises.FirstOrDefaultAsync(e => e.Id == id);

            if (exercise != null)
            {
                var cacheOptions = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7)
                };
                await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(exercise), cacheOptions);
            }

            return exercise;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercise {Id}", id);
            throw;
        }
    }

    public async Task<List<Exercise>> GetExercisesByMuscleGroupAsync(string muscleGroup)
    {
        try
        {
            var cacheKey = $"exercises:muscle-group:{muscleGroup}";
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cached))
            {
                _logger.LogInformation("Muscle group cache hit for {MuscleGroup}", muscleGroup);
                return JsonSerializer.Deserialize<List<Exercise>>(cached) ?? new List<Exercise>();
            }

            var exercises = await _dbContext.Exercises
                .Where(e => e.PrimaryMuscleGroup == muscleGroup ||
                           e.SecondaryMuscleGroups.Contains(muscleGroup))
                .ToListAsync();

            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(exercises), cacheOptions);

            _logger.LogInformation("Found {Count} exercises for muscle group {MuscleGroup}",
                exercises.Count, muscleGroup);

            return exercises;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting exercises for muscle group {MuscleGroup}", muscleGroup);
            throw;
        }
    }

    public async Task<Exercise> CreateCustomExerciseAsync(Guid userId, CreateExerciseRequest request)
    {
        try
        {
            var exercise = new Exercise
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                Description = request.Description,
                PrimaryMuscleGroup = request.PrimaryMuscleGroup,
                SecondaryMuscleGroups = JsonSerializer.Serialize(request.SecondaryMuscleGroups ?? new List<string>()),
                Difficulty = request.Difficulty ?? "BEGINNER",
                Equipment = JsonSerializer.Serialize(request.Equipment ?? new List<string>()),
                FormTips = JsonSerializer.Serialize(request.FormTips ?? new List<string>()),
                VideoUrl = request.VideoUrl,
                IsCustom = true,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.Exercises.Add(exercise);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Created custom exercise {ExerciseId} for user {UserId}", exercise.Id, userId);

            return exercise;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating custom exercise for user {UserId}", userId);
            throw;
        }
    }

    public async Task<List<Exercise>> GetAllExercisesAsync()
    {
        try
        {
            const string cacheKey = "exercises:all";
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cached))
            {
                _logger.LogInformation("All exercises cache hit");
                return JsonSerializer.Deserialize<List<Exercise>>(cached) ?? new List<Exercise>();
            }

            var exercises = await _dbContext.Exercises.ToListAsync();

            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(exercises), cacheOptions);

            _logger.LogInformation("Retrieved {Count} exercises", exercises.Count);

            return exercises;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all exercises");
            throw;
        }
    }
}
