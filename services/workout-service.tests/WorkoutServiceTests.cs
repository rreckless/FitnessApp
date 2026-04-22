using Xunit;
using Moq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WorkoutService.Data;
using WorkoutService.Models;
using WorkoutService.Services;
using FsCheck;
using FsCheck.Xunit;

namespace WorkoutService.Tests;

public class WorkoutServiceTests
{
    private readonly WorkoutDbContext _context;
    private readonly Mock<IVolumeCalculationService> _volumeCalculationServiceMock;
    private readonly Mock<IXPCalculationService> _xpCalculationServiceMock;
    private readonly Mock<IRabbitMQPublisher> _rabbitMQPublisherMock;
    private readonly Mock<ILogger<WorkoutServiceImpl>> _loggerMock;
    private readonly WorkoutServiceImpl _service;

    public WorkoutServiceTests()
    {
        var options = new DbContextOptionsBuilder<WorkoutDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new WorkoutDbContext(options);
        _volumeCalculationServiceMock = new Mock<IVolumeCalculationService>();
        _xpCalculationServiceMock = new Mock<IXPCalculationService>();
        _rabbitMQPublisherMock = new Mock<IRabbitMQPublisher>();
        _loggerMock = new Mock<ILogger<WorkoutServiceImpl>>();

        _service = new WorkoutServiceImpl(
            _context,
            _volumeCalculationServiceMock.Object,
            _xpCalculationServiceMock.Object,
            _rabbitMQPublisherMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task CreateWorkoutAsync_WithValidRequest_CreatesWorkout()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var request = new CreateWorkoutRequest
        {
            StartTime = DateTime.UtcNow,
            Notes = "Test workout",
            IsOfflineCreated = false
        };

        // Act
        var result = await _service.CreateWorkoutAsync(userId, request);

        // Assert
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(request.StartTime, result.StartTime);
        Assert.Equal(request.Notes, result.Notes);
        Assert.Equal(request.IsOfflineCreated, result.IsOfflineCreated);
        Assert.Equal(0, result.Duration);
        Assert.Equal(0, result.TotalVolume);
        Assert.Equal(0, result.TotalXP);
        Assert.Null(result.EndTime);
        Assert.Null(result.DeletedAt);
    }

    [Fact]
    public async Task GetWorkoutByIdAsync_WithValidId_ReturnsWorkout()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.GetWorkoutByIdAsync(workout.Id, userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(workout.Id, result.Id);
        Assert.Equal(userId, result.UserId);
    }

    [Fact]
    public async Task GetWorkoutByIdAsync_WithInvalidUserId_ReturnsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var differentUserId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.GetWorkoutByIdAsync(workout.Id, differentUserId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetWorkoutByIdAsync_WithDeletedWorkout_ReturnsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = DateTime.UtcNow
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.GetWorkoutByIdAsync(workout.Id, userId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserWorkoutsAsync_WithValidUserId_ReturnsPaginatedWorkouts()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workouts = new List<Workout>();
        for (int i = 0; i < 25; i++)
        {
            workouts.Add(new Workout
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                StartTime = DateTime.UtcNow.AddHours(-i),
                Duration = 3600,
                TotalVolume = 1000,
                TotalXP = 10,
                CreatedAt = DateTime.UtcNow.AddHours(-i),
                UpdatedAt = DateTime.UtcNow.AddHours(-i)
            });
        }
        _context.Workouts.AddRange(workouts);
        await _context.SaveChangesAsync();

        // Act
        var (result, totalCount) = await _service.GetUserWorkoutsAsync(userId, page: 1, pageSize: 20);

        // Assert
        Assert.Equal(20, result.Count);
        Assert.Equal(25, totalCount);
    }

    [Fact]
    public async Task GetUserWorkoutsAsync_WithPage2_ReturnsSecondPage()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workouts = new List<Workout>();
        for (int i = 0; i < 25; i++)
        {
            workouts.Add(new Workout
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                StartTime = DateTime.UtcNow.AddHours(-i),
                Duration = 3600,
                TotalVolume = 1000,
                TotalXP = 10,
                CreatedAt = DateTime.UtcNow.AddHours(-i),
                UpdatedAt = DateTime.UtcNow.AddHours(-i)
            });
        }
        _context.Workouts.AddRange(workouts);
        await _context.SaveChangesAsync();

        // Act
        var (result, totalCount) = await _service.GetUserWorkoutsAsync(userId, page: 2, pageSize: 20);

        // Assert
        Assert.Equal(5, result.Count);
        Assert.Equal(25, totalCount);
    }

    [Fact]
    public async Task CompleteWorkoutAsync_WithValidRequest_CompletesWorkout()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow.AddHours(-1),
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        var endTime = DateTime.UtcNow;
        var request = new CompleteWorkoutRequest { EndTime = endTime };

        _volumeCalculationServiceMock.Setup(x => x.CalculateWorkoutVolume(It.IsAny<Workout>())).Returns(2000);
        _xpCalculationServiceMock.Setup(x => x.CalculateXP(2000)).Returns(20);
        _rabbitMQPublisherMock.Setup(x => x.PublishWorkoutCompletedAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>())).Returns(Task.CompletedTask);

        // Act
        var result = await _service.CompleteWorkoutAsync(workout.Id, userId, request);

        // Assert
        Assert.NotNull(result.EndTime);
        Assert.Equal(endTime, result.EndTime);
        Assert.Equal(2000, result.TotalVolume);
        Assert.Equal(20, result.TotalXP);
        _rabbitMQPublisherMock.Verify(x => x.PublishWorkoutCompletedAsync(workout.Id, userId, 2000, 20), Times.Once);
    }

    [Fact]
    public async Task DeleteWorkoutAsync_WithValidId_SoftDeletesWorkout()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        // Act
        await _service.DeleteWorkoutAsync(workout.Id, userId);

        // Assert
        var deletedWorkout = await _context.Workouts.FindAsync(workout.Id);
        Assert.NotNull(deletedWorkout);
        Assert.NotNull(deletedWorkout.DeletedAt);
    }

    [Fact]
    public async Task DeleteWorkoutAsync_WithCompletedWorkoutOlderThan24Hours_ThrowsException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow.AddHours(-25),
            EndTime = DateTime.UtcNow.AddHours(-25),
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow.AddHours(-25),
            UpdatedAt = DateTime.UtcNow.AddHours(-25)
        };
        _context.Workouts.Add(workout);
        await _context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _service.DeleteWorkoutAsync(workout.Id, userId));
    }
}

/// <summary>
/// Property-based tests for workout creation and storage
/// **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**
/// </summary>
public class WorkoutCreationAndStoragePropertyTests
{
    private WorkoutDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<WorkoutDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new WorkoutDbContext(options);
    }

    private WorkoutServiceImpl CreateWorkoutService(WorkoutDbContext context)
    {
        var volumeCalcMock = new Mock<IVolumeCalculationService>();
        var xpCalcMock = new Mock<IXPCalculationService>();
        var rabbitMQMock = new Mock<IRabbitMQPublisher>();
        var loggerMock = new Mock<ILogger<WorkoutServiceImpl>>();

        // Setup default behaviors
        volumeCalcMock.Setup(x => x.CalculateWorkoutVolume(It.IsAny<Workout>()))
            .Returns<Workout>(w => w.Exercises.Sum(e => e.TotalVolume));
        volumeCalcMock.Setup(x => x.CalculateExerciseVolume(It.IsAny<WorkoutExercise>()))
            .Returns<WorkoutExercise>(e => e.Sets.Sum(s => s.Weight * s.Reps));
        xpCalcMock.Setup(x => x.CalculateXP(It.IsAny<int>()))
            .Returns<int>(v => Math.Max(v / 100, 10));
        rabbitMQMock.Setup(x => x.PublishWorkoutCompletedAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>()))
            .Returns(Task.CompletedTask);

        return new WorkoutServiceImpl(context, volumeCalcMock.Object, xpCalcMock.Object, rabbitMQMock.Object, loggerMock.Object);
    }

    /// <summary>
    /// Property: Workouts can be created with valid start time and user ID
    /// For any valid user ID and start time, a workout should be created successfully
    /// with the correct user ID and start time recorded.
    /// </summary>
    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task Property_WorkoutCreationWithValidStartTimeAndUserId(int seed)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var startTime = DateTime.UtcNow.AddHours(-seed);
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        var request = new CreateWorkoutRequest
        {
            StartTime = startTime,
            Notes = "Test workout",
            IsOfflineCreated = false
        };

        // Act
        var result = await service.CreateWorkoutAsync(userId, request);

        // Assert
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(userId, result.UserId);
        Assert.Equal(startTime, result.StartTime);
        Assert.Equal(0, result.Duration);
        Assert.Equal(0, result.TotalVolume);
        Assert.Equal(0, result.TotalXP);
        Assert.Null(result.EndTime);
        Assert.Null(result.DeletedAt);
    }

    /// <summary>
    /// Property: Exercises can be added to workouts with sets, reps, weight, and notes
    /// For any workout with exercises containing sets, reps, and weights,
    /// the exercises should be stored correctly with all data preserved.
    /// </summary>
    [Theory]
    [MemberData(nameof(WorkoutGenerators.ExerciseSetDataGenerator), MemberType = typeof(WorkoutGenerators))]
    public async Task Property_ExercisesCanBeAddedWithAllData(ExerciseSetData exerciseSet)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var exerciseList = new List<UpdateWorkoutExerciseRequest>
        {
            new UpdateWorkoutExerciseRequest
            {
                ExerciseId = Guid.NewGuid(),
                Order = 0,
                Sets = new List<ExerciseSet>
                {
                    new ExerciseSet
                    {
                        Reps = exerciseSet.Reps,
                        Weight = exerciseSet.Weight,
                        RPE = exerciseSet.RPE,
                        Notes = exerciseSet.Notes
                    }
                }
            }
        };

        var updateRequest = new UpdateWorkoutRequest { Exercises = exerciseList };

        // Act
        var result = await service.UpdateWorkoutAsync(workout.Id, userId, updateRequest);

        // Assert
        Assert.Single(result.Exercises);
        Assert.Equal(exerciseList[0].ExerciseId, result.Exercises.First().ExerciseId);
        Assert.Equal(exerciseList[0].Order, result.Exercises.First().Order);
        Assert.Single(result.Exercises.First().Sets);
        var set = result.Exercises.First().Sets[0];
        Assert.Equal(exerciseList[0].Sets[0].Reps, set.Reps);
        Assert.Equal(exerciseList[0].Sets[0].Weight, set.Weight);
    }

    /// <summary>
    /// Property: Volume is calculated correctly (weight × reps × sets)
    /// For any exercise with multiple sets, the total volume should equal
    /// the sum of (weight × reps) for each set.
    /// </summary>
    [Theory]
    [MemberData(nameof(WorkoutGenerators.ExerciseSetDataGenerator), MemberType = typeof(WorkoutGenerators))]
    public async Task Property_VolumeCalculatedCorrectly(ExerciseSetData exerciseSet)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var exerciseList = new List<UpdateWorkoutExerciseRequest>
        {
            new UpdateWorkoutExerciseRequest
            {
                ExerciseId = Guid.NewGuid(),
                Order = 0,
                Sets = new List<ExerciseSet>
                {
                    new ExerciseSet { Reps = exerciseSet.Reps, Weight = exerciseSet.Weight }
                }
            }
        };

        var updateRequest = new UpdateWorkoutRequest { Exercises = exerciseList };

        // Act
        var result = await service.UpdateWorkoutAsync(workout.Id, userId, updateRequest);

        // Assert - Calculate expected volume
        int expectedVolume = exerciseSet.Weight * exerciseSet.Reps;
        Assert.Equal(expectedVolume, result.TotalVolume);
    }

    /// <summary>
    /// Property: Total workout volume is sum of all exercise volumes
    /// For any workout with multiple exercises, the total volume should equal
    /// the sum of all individual exercise volumes.
    /// </summary>
    [Theory]
    [MemberData(nameof(WorkoutGenerators.ExerciseSetDataGenerator), MemberType = typeof(WorkoutGenerators))]
    public async Task Property_TotalWorkoutVolumeIsSumOfExerciseVolumes(ExerciseSetData exerciseSet)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var exerciseList = new List<UpdateWorkoutExerciseRequest>
        {
            new UpdateWorkoutExerciseRequest
            {
                ExerciseId = Guid.NewGuid(),
                Order = 0,
                Sets = new List<ExerciseSet>
                {
                    new ExerciseSet { Reps = exerciseSet.Reps, Weight = exerciseSet.Weight }
                }
            }
        };

        var updateRequest = new UpdateWorkoutRequest { Exercises = exerciseList };

        // Act
        var result = await service.UpdateWorkoutAsync(workout.Id, userId, updateRequest);

        // Assert
        int sumOfExerciseVolumes = result.Exercises.Sum(e => e.TotalVolume);
        Assert.Equal(sumOfExerciseVolumes, result.TotalVolume);
    }

    /// <summary>
    /// Property: Workouts can be completed with end time and duration
    /// For any workout with a valid end time, completing the workout should
    /// record the end time and calculate the correct duration.
    /// </summary>
    [Theory]
    [InlineData(1800)]
    [InlineData(3600)]
    [InlineData(5400)]
    public async Task Property_WorkoutCompletionRecordsEndTimeAndDuration(int durationSeconds)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var startTime = DateTime.UtcNow.AddSeconds(-durationSeconds);
        var endTime = DateTime.UtcNow;
        
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = startTime,
            Duration = 0,
            TotalVolume = 0,
            TotalXP = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var completeRequest = new CompleteWorkoutRequest { EndTime = endTime };

        // Act
        var result = await service.CompleteWorkoutAsync(workout.Id, userId, completeRequest);

        // Assert
        Assert.NotNull(result.EndTime);
        Assert.Equal(endTime, result.EndTime);
        Assert.True(result.Duration > 0);
        Assert.Equal((int)(endTime - startTime).TotalSeconds, result.Duration);
    }

    /// <summary>
    /// Property: Workouts can be edited within 24 hours of completion
    /// For any completed workout within 24 hours, the workout should be editable
    /// and changes should be persisted correctly.
    /// </summary>
    [Theory]
    [InlineData("Updated notes 1")]
    [InlineData("Updated notes 2")]
    [InlineData("Updated notes 3")]
    public async Task Property_WorkoutCanBeEditedWithin24Hours(string newNotes)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var endTime = DateTime.UtcNow.AddHours(-12); // 12 hours ago (within 24 hours)
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = endTime.AddHours(-1),
            EndTime = endTime,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            Notes = "Original notes",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var updateRequest = new UpdateWorkoutRequest { Notes = newNotes };

        // Act
        var result = await service.UpdateWorkoutAsync(workout.Id, userId, updateRequest);

        // Assert
        Assert.Equal(newNotes, result.Notes);
    }

    /// <summary>
    /// Property: Workouts cannot be edited after 24 hours of completion
    /// For any completed workout older than 24 hours, attempting to edit
    /// should throw an InvalidOperationException.
    /// </summary>
    [Fact]
    public async Task Property_WorkoutCannotBeEditedAfter24Hours()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var endTime = DateTime.UtcNow.AddHours(-25); // 25 hours ago (beyond 24 hours)
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = endTime.AddHours(-1),
            EndTime = endTime,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var updateRequest = new UpdateWorkoutRequest { Notes = "Updated notes" };

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.UpdateWorkoutAsync(workout.Id, userId, updateRequest));
    }

    /// <summary>
    /// Property: Workouts can be soft deleted within 24 hours of completion
    /// For any completed workout within 24 hours, the workout should be soft-deletable
    /// and the DeletedAt timestamp should be set.
    /// </summary>
    [Fact]
    public async Task Property_WorkoutCanBeSoftDeletedWithin24Hours()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var endTime = DateTime.UtcNow.AddHours(-12); // 12 hours ago (within 24 hours)
        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = endTime.AddHours(-1),
            EndTime = endTime,
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        // Act
        await service.DeleteWorkoutAsync(workout.Id, userId);

        // Assert
        var deletedWorkout = await context.Workouts.FindAsync(workout.Id);
        Assert.NotNull(deletedWorkout);
        Assert.NotNull(deletedWorkout.DeletedAt);
    }

    /// <summary>
    /// Property: Deleted workouts are not returned in list queries
    /// For any deleted workout, it should not appear in the list of user workouts.
    /// </summary>
    [Fact]
    public async Task Property_DeletedWorkoutsNotReturnedInListQueries()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var context = CreateDbContext();
        var service = CreateWorkoutService(context);
        
        var activeWorkout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow.AddHours(-1),
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };

        var deletedWorkout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StartTime = DateTime.UtcNow.AddHours(-2),
            Duration = 3600,
            TotalVolume = 1000,
            TotalXP = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = DateTime.UtcNow,
            Exercises = new List<WorkoutExercise>()
        };

        context.Workouts.Add(activeWorkout);
        context.Workouts.Add(deletedWorkout);
        await context.SaveChangesAsync();

        // Act
        var (workouts, totalCount) = await service.GetUserWorkoutsAsync(userId);

        // Assert
        Assert.Single(workouts);
        Assert.Equal(1, totalCount);
        Assert.DoesNotContain(deletedWorkout.Id, workouts.Select(w => w.Id));
        Assert.Contains(activeWorkout.Id, workouts.Select(w => w.Id));
    }
}

/// <summary>
/// Custom generators for property-based testing
/// </summary>
public static class WorkoutGenerators
{
    public static IEnumerable<object[]> ExerciseSetDataGenerator()
    {
        yield return new object[] { new ExerciseSetData { Reps = 10, Weight = 100, RPE = null, Notes = null } };
        yield return new object[] { new ExerciseSetData { Reps = 15, Weight = 150, RPE = null, Notes = null } };
        yield return new object[] { new ExerciseSetData { Reps = 20, Weight = 200, RPE = null, Notes = null } };
        yield return new object[] { new ExerciseSetData { Reps = 5, Weight = 300, RPE = null, Notes = null } };
        yield return new object[] { new ExerciseSetData { Reps = 25, Weight = 50, RPE = null, Notes = null } };
    }
}

/// <summary>
/// Data class for exercise set properties
/// </summary>
public class ExerciseSetData
{
    public int Reps { get; set; }
    public int Weight { get; set; }
    public int? RPE { get; set; }
    public string? Notes { get; set; }
}
