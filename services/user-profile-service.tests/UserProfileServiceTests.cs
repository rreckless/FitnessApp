using Xunit;
using Moq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using UserProfileService.Data;
using UserProfileService.Models;
using UserProfileService.Services;

namespace UserProfileService.Tests;

public class UserProfileServiceTests
{
    private UserProfileDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<UserProfileDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new UserProfileDbContext(options);
    }

    [Fact]
    public async Task CreateUserProfileAsync_WithValidData_CreatesProfile()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();
        var name = "John Doe";
        var email = "john@example.com";

        // Act
        var profile = await service.CreateUserProfileAsync(userId, name, email);

        // Assert
        Assert.NotNull(profile);
        Assert.Equal(userId, profile.UserId);
        Assert.Equal(name, profile.Name);
        Assert.Equal(email, profile.Email);
        Assert.NotEqual(Guid.Empty, profile.Id);
    }

    [Fact]
    public async Task GetUserProfileAsync_WithExistingProfile_ReturnsProfile()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();
        
        // Create a profile first
        await service.CreateUserProfileAsync(userId, "John Doe", "john@example.com");

        // Act
        var profile = await service.GetUserProfileAsync(userId);

        // Assert
        Assert.NotNull(profile);
        Assert.Equal(userId, profile.UserId);
        Assert.Equal("John Doe", profile.Name);
    }

    [Fact]
    public async Task GetUserProfileAsync_WithNonExistentProfile_ReturnsNull()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act
        var profile = await service.GetUserProfileAsync(userId);

        // Assert
        Assert.Null(profile);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_WithValidData_UpdatesProfile()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();
        
        // Create a profile first
        await service.CreateUserProfileAsync(userId, "John Doe", "john@example.com");

        // Act
        var updateRequest = new UpdateProfileRequest { Name = "Jane Doe", Bio = "Updated bio" };
        var updatedProfile = await service.UpdateUserProfileAsync(userId, updateRequest);

        // Assert
        Assert.NotNull(updatedProfile);
        Assert.Equal("Jane Doe", updatedProfile.Name);
        Assert.Equal("Updated bio", updatedProfile.Bio);
    }

    [Fact]
    public async Task UpdateUserPreferencesAsync_WithValidData_CreatesOrUpdatesPreferences()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act
        var updateRequest = new UpdatePreferencesRequest
        {
            FitnessGoals = new[] { "STRENGTH", "MUSCLE_GAIN" },
            ExperienceLevel = "INTERMEDIATE",
            WorkoutFrequency = 4,
            AvailableEquipment = new[] { "DUMBBELLS", "BARBELL" }
        };
        var preferences = await service.UpdateUserPreferencesAsync(userId, updateRequest);

        // Assert
        Assert.NotNull(preferences);
        Assert.Equal(userId, preferences.UserId);
        Assert.Equal("INTERMEDIATE", preferences.ExperienceLevel);
        Assert.Equal(4, preferences.WorkoutFrequency);
    }

    [Fact]
    public async Task UpdateUserPreferencesAsync_WithInvalidExperienceLevel_ThrowsException()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act & Assert
        var updateRequest = new UpdatePreferencesRequest
        {
            ExperienceLevel = "INVALID_LEVEL"
        };
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            service.UpdateUserPreferencesAsync(userId, updateRequest));
    }

    [Fact]
    public async Task UpdateUserPreferencesAsync_WithInvalidWorkoutFrequency_ThrowsException()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act & Assert
        var updateRequest = new UpdatePreferencesRequest
        {
            WorkoutFrequency = 10 // Invalid: must be 1-7
        };
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            service.UpdateUserPreferencesAsync(userId, updateRequest));
    }

    [Fact]
    public async Task CreateUserProfileAsync_WithDuplicateUserId_ThrowsException()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Create first profile
        await service.CreateUserProfileAsync(userId, "John Doe", "john@example.com");

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => 
            service.CreateUserProfileAsync(userId, "Jane Doe", "jane@example.com"));
    }

    [Fact]
    public async Task UpdateUserProfileAsync_WithNonExistentProfile_ThrowsKeyNotFoundException()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act & Assert
        var updateRequest = new UpdateProfileRequest { Name = "Jane Doe" };
        
        await Assert.ThrowsAsync<KeyNotFoundException>(() => 
            service.UpdateUserProfileAsync(userId, updateRequest));
    }

    [Fact]
    public async Task GetUserPreferencesAsync_WithExistingPreferences_ReturnsPreferences()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Create preferences first
        var updateRequest = new UpdatePreferencesRequest
        {
            FitnessGoals = new[] { "STRENGTH" },
            ExperienceLevel = "BEGINNER",
            WorkoutFrequency = 3,
            AvailableEquipment = new[] { "DUMBBELLS" }
        };
        await service.UpdateUserPreferencesAsync(userId, updateRequest);

        // Act
        var preferences = await service.GetUserPreferencesAsync(userId);

        // Assert
        Assert.NotNull(preferences);
        Assert.Equal(userId, preferences.UserId);
        Assert.Equal("BEGINNER", preferences.ExperienceLevel);
    }

    [Fact]
    public async Task GetUserPreferencesAsync_WithNonExistentPreferences_ReturnsNull()
    {
        // Arrange
        var context = CreateDbContext();
        var s3ServiceMock = new Mock<IS3Service>();
        var loggerMock = new Mock<ILogger<UserProfileService.Services.UserProfileService>>();
        
        var service = new UserProfileService.Services.UserProfileService(context, s3ServiceMock.Object, loggerMock.Object);
        var userId = Guid.NewGuid();

        // Act
        var preferences = await service.GetUserPreferencesAsync(userId);

        // Assert
        Assert.Null(preferences);
    }
}
