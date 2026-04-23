using ExerciseLibraryService.Data;
using ExerciseLibraryService.Models;
using ExerciseLibraryService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace ExerciseLibraryService.Tests;

public class ExerciseServiceTests
{
    private ExerciseDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ExerciseDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ExerciseDbContext(options);
    }

    private IConnectionMultiplexer CreateMockRedis()
    {
        var mockRedis = new Mock<IConnectionMultiplexer>();
        var mockDb = new Mock<IDatabase>();
        mockRedis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
        return mockRedis.Object;
    }

    [Fact]
    public async Task SearchExercises_WithQuery_ReturnsMatchingExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var exercise1 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Barbell Bench Press",
            Description = "Chest exercise",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var exercise2 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Dumbbell Curls",
            Description = "Arm exercise",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(exercise1, exercise2);
        await context.SaveChangesAsync();

        // Act
        var request = new ExerciseSearchRequest { Query = "Bench", Page = 1, PageSize = 20 };
        var result = await service.SearchExercisesAsync(request);

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("Barbell Bench Press", result.Items[0].Name);
    }

    [Fact]
    public async Task SearchExercises_WithMuscleGroup_ReturnsFilteredExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var chestExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Bench Press",
            Description = "Chest exercise",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var armExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Curls",
            Description = "Arm exercise",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(chestExercise, armExercise);
        await context.SaveChangesAsync();

        // Act
        var request = new ExerciseSearchRequest { MuscleGroup = MuscleGroup.Chest, Page = 1, PageSize = 20 };
        var result = await service.SearchExercisesAsync(request);

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("Bench Press", result.Items[0].Name);
    }

    [Fact]
    public async Task SearchExercises_WithDifficulty_ReturnsFilteredExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var beginnerExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Push-ups",
            Description = "Beginner exercise",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var advancedExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Deadlift",
            Description = "Advanced exercise",
            PrimaryMuscleGroup = MuscleGroup.Back,
            Difficulty = Difficulty.Advanced,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(beginnerExercise, advancedExercise);
        await context.SaveChangesAsync();

        // Act
        var request = new ExerciseSearchRequest { Difficulty = Difficulty.Beginner, Page = 1, PageSize = 20 };
        var result = await service.SearchExercisesAsync(request);

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("Push-ups", result.Items[0].Name);
    }

    [Fact]
    public async Task GetExerciseById_WithValidId_ReturnsExercise()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var exerciseId = Guid.NewGuid();
        var exercise = new Exercise
        {
            Id = exerciseId,
            Name = "Bench Press",
            Description = "Chest exercise",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetExerciseByIdAsync(exerciseId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Bench Press", result.Name);
    }

    [Fact]
    public async Task GetExerciseById_WithInvalidId_ReturnsNull()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        // Act
        var result = await service.GetExerciseByIdAsync(Guid.NewGuid());

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetExercisesByMuscleGroup_ReturnsAllExercisesForMuscleGroup()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var exercise1 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Bench Press",
            Description = "Primary chest",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var exercise2 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Incline Press",
            Description = "Chest and shoulders",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders },
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var exercise3 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Curls",
            Description = "Secondary chest",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Chest },
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(exercise1, exercise2, exercise3);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetExercisesByMuscleGroupAsync(MuscleGroup.Chest, 1, 20);

        // Assert
        Assert.Equal(3, result.Items.Count); // All three exercises involve chest
    }

    [Fact]
    public async Task CreateCustomExercise_WithValidData_CreatesExercise()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var userId = Guid.NewGuid();
        var request = new CreateCustomExerciseRequest
        {
            Name = "My Custom Exercise",
            Description = "Custom description",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells }
        };

        // Act
        var result = await service.CreateCustomExerciseAsync(userId, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("My Custom Exercise", result.Name);
        Assert.False(result.IsBuiltIn);

        // Verify it was saved to database
        var savedExercise = await context.Exercises.FirstOrDefaultAsync(e => e.Id == result.Id);
        Assert.NotNull(savedExercise);
        Assert.Equal(userId, savedExercise.CreatedByUserId);
    }

    [Fact]
    public async Task GetUserCustomExercises_ReturnsOnlyUserExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        var exercise1 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "User1 Exercise",
            Description = "Custom",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = false,
            CreatedByUserId = userId1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var exercise2 = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "User2 Exercise",
            Description = "Custom",
            PrimaryMuscleGroup = MuscleGroup.Back,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = false,
            CreatedByUserId = userId2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(exercise1, exercise2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetUserCustomExercisesAsync(userId1, 1, 20);

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("User1 Exercise", result.Items[0].Name);
    }

    [Fact]
    public async Task GetAllBuiltInExercises_ReturnsOnlyBuiltInExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var builtInExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Built-in Exercise",
            Description = "Built-in",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var customExercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Custom Exercise",
            Description = "Custom",
            PrimaryMuscleGroup = MuscleGroup.Back,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = false,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.AddRange(builtInExercise, customExercise);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetAllBuiltInExercisesAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("Built-in Exercise", result[0].Name);
    }

    [Fact]
    public async Task SearchExercises_WithPagination_ReturnsPaginatedResults()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        // Add 25 exercises
        for (int i = 0; i < 25; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Exercise {i:D2}",
                Description = "Test",
                PrimaryMuscleGroup = MuscleGroup.Chest,
                Difficulty = Difficulty.Beginner,
                IsBuiltIn = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        await context.SaveChangesAsync();

        // Act
        var page1 = await service.SearchExercisesAsync(new ExerciseSearchRequest { Page = 1, PageSize = 10 });
        var page2 = await service.SearchExercisesAsync(new ExerciseSearchRequest { Page = 2, PageSize = 10 });
        var page3 = await service.SearchExercisesAsync(new ExerciseSearchRequest { Page = 3, PageSize = 10 });

        // Assert
        Assert.Equal(10, page1.Items.Count);
        Assert.Equal(10, page2.Items.Count);
        Assert.Equal(5, page3.Items.Count);
        Assert.Equal(25, page1.TotalCount);
        Assert.Equal(3, page1.TotalPages);
    }

    [Fact]
    public async Task SearchExercises_WithSecondaryMuscleGroup_ReturnsExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Incline Press",
            Description = "Chest and shoulders",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders },
            Difficulty = Difficulty.Intermediate,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        // Act - Search by secondary muscle group
        var result = await service.GetExercisesByMuscleGroupAsync(MuscleGroup.Shoulders, 1, 20);

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("Incline Press", result.Items[0].Name);
    }
}
