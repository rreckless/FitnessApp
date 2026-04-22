using Microsoft.EntityFrameworkCore;
using WorkoutService.Data;
using WorkoutService.Models;

namespace WorkoutService.Services;

public interface IWorkoutService
{
    Task<Workout> CreateWorkoutAsync(Guid userId, CreateWorkoutRequest request);
    Task<Workout?> GetWorkoutByIdAsync(Guid workoutId, Guid userId);
    Task<(List<Workout> workouts, int totalCount)> GetUserWorkoutsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<Workout> UpdateWorkoutAsync(Guid workoutId, Guid userId, UpdateWorkoutRequest request);
    Task<Workout> CompleteWorkoutAsync(Guid workoutId, Guid userId, CompleteWorkoutRequest request);
    Task DeleteWorkoutAsync(Guid workoutId, Guid userId);
    Task<Workout?> GetWorkoutWithExercisesAsync(Guid workoutId, Guid userId);
}

public class WorkoutServiceImpl : IWorkoutService
{
    private readonly WorkoutDbContext _context;
    private readonly IVolumeCalculationService _volumeCalculationService;
    private readonly IXPCalculationService _xpCalculationService;
    private readonly IRabbitMQPublisher _rabbitMQPublisher;
    private readonly ILogger<WorkoutServiceImpl> _logger;

    public WorkoutServiceImpl(
        WorkoutDbContext context,
        IVolumeCalculationService volumeCalculationService,
        IXPCalculationService xpCalculationService,
        IRabbitMQPublisher rabbitMQPublisher,
        ILogger<WorkoutServiceImpl> logger)
    {
        _context = context;
        _volumeCalculationService = volumeCalculationService;
        _xpCalculationService = xpCalculationService;
        _rabbitMQPublisher = rabbitMQPublisher;
        _logger = logger;
    }

    public async Task<Workout> CreateWorkoutAsync(Guid userId, CreateWorkoutRequest request)
    {
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = request.StartTime,
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            Notes = request.Notes,
            IsOfflineCreated = request.IsOfflineCreated,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        _logger.LogInformation($"Created workout {workout.Id} for user {userId}");
        return workout;
    }

    public async Task<Workout?> GetWorkoutByIdAsync(Guid workoutId, Guid userId)
    {
        return await _context.Workouts
            .Where(w => w.Id == workoutId && w.UserId == userId && w.DeletedAt == null)
            .FirstOrDefaultAsync();
    }

    public async Task<(List<Workout> workouts, int totalCount)> GetUserWorkoutsAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        var query = _context.Workouts
            .Where(w => w.UserId == userId && w.DeletedAt == null)
            .OrderByDescending(w => w.CreatedAt);

        var totalCount = await query.CountAsync();
        var workouts = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(w => w.Exercises)
            .ToListAsync();

        return (workouts, totalCount);
    }

    public async Task<Workout> UpdateWorkoutAsync(Guid workoutId, Guid userId, UpdateWorkoutRequest request)
    {
        var workout = await GetWorkoutWithExercisesAsync(workoutId, userId);
        if (workout == null)
            throw new InvalidOperationException($"Workout {workoutId} not found");

        // Check if workout is within 24 hours of completion
        if (workout.EndTime.HasValue && DateTime.UtcNow - workout.EndTime.Value > TimeSpan.FromHours(24))
            throw new InvalidOperationException("Cannot edit workout more than 24 hours after completion");

        if (request.StartTime.HasValue)
            workout.StartTime = request.StartTime.Value;

        if (request.EndTime.HasValue)
            workout.EndTime = request.EndTime.Value;

        if (request.Notes != null)
            workout.Notes = request.Notes;

        if (request.Exercises != null)
        {
            // Clear existing exercises
            _context.WorkoutExercises.RemoveRange(workout.Exercises);

            // Add new exercises
            foreach (var exerciseRequest in request.Exercises)
            {
                var workoutExercise = new WorkoutExercise
                {
                    Id = Guid.NewGuid(),
                    WorkoutId = workoutId,
                    ExerciseId = exerciseRequest.ExerciseId,
                    Order = exerciseRequest.Order,
                    Sets = exerciseRequest.Sets,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                workoutExercise.TotalVolume = _volumeCalculationService.CalculateExerciseVolume(workoutExercise);
                _context.WorkoutExercises.Add(workoutExercise);
            }

            // Recalculate total volume and XP
            workout.TotalVolume = _volumeCalculationService.CalculateWorkoutVolume(workout);
            workout.TotalXP = _xpCalculationService.CalculateXP(workout.TotalVolume);
        }

        // Recalculate duration if end time is set
        if (workout.EndTime.HasValue)
        {
            workout.Duration = (int)(workout.EndTime.Value - workout.StartTime).TotalSeconds;
        }

        workout.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation($"Updated workout {workoutId}");
        return workout;
    }

    public async Task<Workout> CompleteWorkoutAsync(Guid workoutId, Guid userId, CompleteWorkoutRequest request)
    {
        var workout = await GetWorkoutWithExercisesAsync(workoutId, userId);
        if (workout == null)
            throw new InvalidOperationException($"Workout {workoutId} not found");

        workout.EndTime = request.EndTime;
        workout.Duration = (int)(request.EndTime - workout.StartTime).TotalSeconds;
        workout.TotalVolume = _volumeCalculationService.CalculateWorkoutVolume(workout);
        workout.TotalXP = _xpCalculationService.CalculateXP(workout.TotalVolume);

        if (request.Notes != null)
            workout.Notes = request.Notes;

        workout.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Publish WorkoutCompleted event
        await _rabbitMQPublisher.PublishWorkoutCompletedAsync(
            workout.Id,
            workout.UserId,
            workout.TotalVolume,
            workout.TotalXP);

        _logger.LogInformation($"Completed workout {workoutId} with {workout.TotalVolume} volume and {workout.TotalXP} XP");
        return workout;
    }

    public async Task DeleteWorkoutAsync(Guid workoutId, Guid userId)
    {
        var workout = await GetWorkoutByIdAsync(workoutId, userId);
        if (workout == null)
            throw new InvalidOperationException($"Workout {workoutId} not found");

        // Check if workout is within 24 hours of completion
        if (workout.EndTime.HasValue && DateTime.UtcNow - workout.EndTime.Value > TimeSpan.FromHours(24))
            throw new InvalidOperationException("Cannot delete workout more than 24 hours after completion");

        // Soft delete
        workout.DeletedAt = DateTime.UtcNow;
        workout.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation($"Deleted workout {workoutId}");
    }

    public async Task<Workout?> GetWorkoutWithExercisesAsync(Guid workoutId, Guid userId)
    {
        return await _context.Workouts
            .Where(w => w.Id == workoutId && w.UserId == userId && w.DeletedAt == null)
            .Include(w => w.Exercises)
            .FirstOrDefaultAsync();
    }
}
