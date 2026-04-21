using Microsoft.EntityFrameworkCore;
using WorkoutService.Data;
using WorkoutService.Models;

namespace WorkoutService.Services;

public class WorkoutServiceImpl : IWorkoutService
{
    private readonly WorkoutDbContext _dbContext;

    public WorkoutServiceImpl(WorkoutDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Workout> CreateWorkoutAsync(Guid userId, dynamic request)
    {
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = request.StartTime,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsOfflineCreated = false
        };

        _dbContext.Workouts.Add(workout);
        await _dbContext.SaveChangesAsync();

        return workout;
    }

    public async Task<List<Workout>> GetUserWorkoutsAsync(Guid userId)
    {
        return await _dbContext.Workouts
            .Where(w => w.UserId == userId && w.DeletedAt == null)
            .Include(w => w.Exercises)
            .ThenInclude(e => e.Sets)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();
    }

    public async Task<Workout?> GetWorkoutAsync(Guid id)
    {
        return await _dbContext.Workouts
            .Include(w => w.Exercises)
            .ThenInclude(e => e.Sets)
            .FirstOrDefaultAsync(w => w.Id == id && w.DeletedAt == null);
    }

    public async Task<Workout?> UpdateWorkoutAsync(Guid id, dynamic request)
    {
        var workout = await _dbContext.Workouts.FindAsync(id);
        if (workout == null || workout.DeletedAt != null)
            return null;

        workout.StartTime = request.StartTime;
        workout.UpdatedAt = DateTime.UtcNow;

        _dbContext.Workouts.Update(workout);
        await _dbContext.SaveChangesAsync();

        return workout;
    }

    public async Task DeleteWorkoutAsync(Guid id)
    {
        var workout = await _dbContext.Workouts.FindAsync(id);
        if (workout != null)
        {
            workout.DeletedAt = DateTime.UtcNow;
            _dbContext.Workouts.Update(workout);
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task<bool> CompleteWorkoutAsync(Guid id)
    {
        var workout = await _dbContext.Workouts.FindAsync(id);
        if (workout == null)
            return false;

        workout.EndTime = DateTime.UtcNow;
        workout.Duration = (int)(workout.EndTime.Value - workout.StartTime).TotalSeconds;
        workout.UpdatedAt = DateTime.UtcNow;

        _dbContext.Workouts.Update(workout);
        await _dbContext.SaveChangesAsync();

        return true;
    }
}

public class ExerciseServiceImpl : IExerciseService
{
    public async Task<List<dynamic>> GetExercisesAsync()
    {
        return await Task.FromResult(new List<dynamic>());
    }

    public async Task<dynamic?> GetExerciseAsync(Guid id)
    {
        return await Task.FromResult<dynamic?>(null);
    }
}
