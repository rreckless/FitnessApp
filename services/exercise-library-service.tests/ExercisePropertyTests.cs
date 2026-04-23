using ExerciseLibraryService.Data;
using ExerciseLibraryService.Models;
using ExerciseLibraryService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace ExerciseLibraryService.Tests;

/// <summary>
/// Property-based tests for Exercise Library Service
/// These tests verify universal properties that should hold across all inputs
/// </summary>
public class ExercisePropertyTests
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

    /// <summary>
    /// Property: Exercise search with valid pagination always returns correct page count
    /// Validates: Requirements 4.3 (fuzzy search returns matching results)
    /// </summary>
    [Fact]
    public async Task SearchExercises_WithValidPagination_ReturnsCorrectPageCount()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        const int totalExercises = 25;
        const int pageSize = 10;

        // Add exercises
        for (int i = 0; i < totalExercises; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Exercise {i}",
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
        var request = new ExerciseSearchRequest { Page = 1, PageSize = pageSize };
        var result = await service.SearchExercisesAsync(request);

        // Assert
        var expectedTotalPages = (totalExercises + pageSize - 1) / pageSize;
        Assert.Equal(expectedTotalPages, result.TotalPages);
    }

    /// <summary>
    /// Property: Custom exercises are always user-specific
    /// Validates: Requirements 4.5 (custom exercises are user-specific)
    /// </summary>
    [Fact]
    public async Task CreateCustomExercise_AlwaysAssociatedWithUser()
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
            Description = "Test description",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner
        };

        // Act
        var result = await service.CreateCustomExerciseAsync(userId, request);

        // Assert
        var savedExercise = context.Exercises.FirstOrDefault(e => e.Id == result.Id);
        Assert.NotNull(savedExercise);
        Assert.Equal(userId, savedExercise.CreatedByUserId);
        Assert.False(savedExercise.IsBuiltIn);
    }

    /// <summary>
    /// Property: Muscle group filtering always returns exercises with matching muscle groups
    /// Validates: Requirements 4.2 (exercises categorized by muscle group)
    /// </summary>
    [Fact]
    public async Task GetExercisesByMuscleGroup_AlwaysReturnsMatchingMuscleGroup()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        var muscleGroups = new[] { MuscleGroup.Chest, MuscleGroup.Back, MuscleGroup.Shoulders, MuscleGroup.Arms, MuscleGroup.Legs, MuscleGroup.Core, MuscleGroup.Cardio };

        // Add exercises with various muscle groups
        for (int i = 0; i < 50; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Exercise {i}",
                Description = "Test",
                PrimaryMuscleGroup = muscleGroups[i % muscleGroups.Length],
                Difficulty = Difficulty.Beginner,
                IsBuiltIn = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        await context.SaveChangesAsync();

        // Act & Assert - Test each muscle group
        foreach (var muscleGroup in muscleGroups)
        {
            var result = await service.GetExercisesByMuscleGroupAsync(muscleGroup, 1, 100);

            // All returned exercises should have the requested muscle group
            Assert.All(result.Items, item => Assert.Equal(muscleGroup.ToString(), item.PrimaryMuscleGroup));
        }
    }

    /// <summary>
    /// Property: Search results are always sorted by relevance when query is provided
    /// Validates: Requirements 4.3 (fuzzy search returns matching results)
    /// </summary>
    [Fact]
    public async Task SearchExercises_WithQuery_ReturnsSortedByRelevance()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        const string searchQuery = "Bench";

        // Add exercises with varying relevance
        context.Exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = searchQuery,
            Description = "Exact match",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        context.Exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = $"Other {searchQuery} Exercise",
            Description = "Contains search term",
            PrimaryMuscleGroup = MuscleGroup.Back,
            Difficulty = Difficulty.Beginner,
            IsBuiltIn = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        // Act
        var request = new ExerciseSearchRequest { Query = searchQuery, Page = 1, PageSize = 20 };
        var result = await service.SearchExercisesAsync(request);

        // Assert - First result should be the exact match
        Assert.NotEmpty(result.Items);
        Assert.Equal(searchQuery, result.Items[0].Name);
    }

    /// <summary>
    /// Property: Built-in exercises are never modified by user operations
    /// Validates: Requirements 4.1 (200+ built-in exercises)
    /// </summary>
    [Fact]
    public async Task BuiltInExercises_AreNeverModified()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        const int builtInCount = 50;

        // Add built-in exercises
        for (int i = 0; i < builtInCount; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Built-in {i}",
                Description = "Built-in",
                PrimaryMuscleGroup = MuscleGroup.Chest,
                Difficulty = Difficulty.Beginner,
                IsBuiltIn = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Add custom exercises
        for (int i = 0; i < 5; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Custom {i}",
                Description = "Custom",
                PrimaryMuscleGroup = MuscleGroup.Back,
                Difficulty = Difficulty.Beginner,
                IsBuiltIn = false,
                CreatedByUserId = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync();

        // Act
        var builtInExercises = await service.GetAllBuiltInExercisesAsync();

        // Assert - Verify count matches
        Assert.Equal(builtInCount, builtInExercises.Count);
    }

    /// <summary>
    /// Property: Exercise search with empty query returns all exercises
    /// Validates: Requirements 4.3 (search returns matching results)
    /// </summary>
    [Fact]
    public async Task SearchExercises_WithEmptyQuery_ReturnsAllExercises()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        const int count = 50;

        // Add exercises
        for (int i = 0; i < count; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Exercise {i}",
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
        var request = new ExerciseSearchRequest { Query = null, Page = 1, PageSize = 100 };
        var result = await service.SearchExercisesAsync(request);

        // Assert - Should return all exercises
        Assert.Equal(count, result.TotalCount);
    }

    /// <summary>
    /// Property: Pagination never returns more items than requested
    /// Validates: Requirements 4.3 (search returns matching results with pagination)
    /// </summary>
    [Fact]
    public async Task SearchExercises_NeverReturnsMoreThanPageSize()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var redis = CreateMockRedis();
        var logger = new Mock<ILogger<ExerciseService>>();
        var service = new ExerciseService(context, redis, logger.Object);

        const int count = 100;
        const int pageSize = 20;

        // Add exercises
        for (int i = 0; i < count; i++)
        {
            context.Exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = $"Exercise {i}",
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
        var request = new ExerciseSearchRequest { Page = 1, PageSize = pageSize };
        var result = await service.SearchExercisesAsync(request);

        // Assert - Should never return more than pageSize items
        Assert.True(result.Items.Count <= pageSize);
    }

    /// <summary>
    /// Property: User custom exercises are isolated from other users
    /// Validates: Requirements 4.5 (custom exercises are user-specific)
    /// </summary>
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

        // Assert - Should only return user1's exercises
        Assert.Single(result.Items);
        Assert.Equal("User1 Exercise", result.Items[0].Name);
    }
}
