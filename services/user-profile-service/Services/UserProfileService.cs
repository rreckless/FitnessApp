using Microsoft.EntityFrameworkCore;
using UserProfileService.Data;
using UserProfileService.Models;
using System.Text.Json;

namespace UserProfileService.Services;

public class UserProfileService : IUserProfileService
{
    private readonly UserProfileDbContext _context;
    private readonly IS3Service _s3Service;
    private readonly ILogger<UserProfileService> _logger;

    public UserProfileService(
        UserProfileDbContext context,
        IS3Service s3Service,
        ILogger<UserProfileService> logger)
    {
        _context = context;
        _s3Service = s3Service;
        _logger = logger;
    }

    public async Task<UserProfile?> GetUserProfileAsync(Guid userId)
    {
        try
        {
            return await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user profile for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserProfile> CreateUserProfileAsync(Guid userId, string name, string email)
    {
        try
        {
            // Check if profile already exists
            var existingProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);
            
            if (existingProfile != null)
            {
                throw new InvalidOperationException($"Profile already exists for user {userId}");
            }

            var profile = new UserProfile
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Name = name,
                Email = email,
                Bio = string.Empty,
                ProfilePictureUrl = string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.UserProfiles.Add(profile);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created user profile for userId: {UserId}", userId);
            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user profile for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserProfile> UpdateUserProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        try
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                throw new KeyNotFoundException($"Profile not found for user {userId}");
            }

            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                profile.Name = request.Name;
            }

            if (request.Bio != null)
            {
                profile.Bio = request.Bio;
            }

            profile.UpdatedAt = DateTime.UtcNow;

            _context.UserProfiles.Update(profile);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated user profile for userId: {UserId}", userId);
            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserPreferences?> GetUserPreferencesAsync(Guid userId)
    {
        try
        {
            return await _context.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user preferences for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserPreferences> UpdateUserPreferencesAsync(Guid userId, UpdatePreferencesRequest request)
    {
        try
        {
            var preferences = await _context.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (preferences == null)
            {
                // Create new preferences if they don't exist
                preferences = new UserPreferences
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.UserPreferences.Add(preferences);
            }

            if (request.FitnessGoals != null)
            {
                preferences.FitnessGoals = JsonSerializer.Serialize(request.FitnessGoals);
            }

            if (!string.IsNullOrWhiteSpace(request.ExperienceLevel))
            {
                ValidateExperienceLevel(request.ExperienceLevel);
                preferences.ExperienceLevel = request.ExperienceLevel;
            }

            if (request.WorkoutFrequency.HasValue)
            {
                if (request.WorkoutFrequency.Value < 1 || request.WorkoutFrequency.Value > 7)
                {
                    throw new ArgumentException("Workout frequency must be between 1 and 7 days per week");
                }
                preferences.WorkoutFrequency = request.WorkoutFrequency.Value;
            }

            if (request.AvailableEquipment != null)
            {
                preferences.AvailableEquipment = JsonSerializer.Serialize(request.AvailableEquipment);
            }

            preferences.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated user preferences for userId: {UserId}", userId);
            return preferences;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user preferences for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<string> GenerateProfilePictureUploadUrlAsync(Guid userId, string fileName)
    {
        try
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                throw new KeyNotFoundException($"Profile not found for user {userId}");
            }

            var uploadUrl = await _s3Service.GeneratePresignedUploadUrlAsync(userId, fileName);
            _logger.LogInformation("Generated upload URL for user profile picture for userId: {UserId}", userId);
            return uploadUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating upload URL for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task UpdateProfilePictureUrlAsync(Guid userId, string pictureUrl)
    {
        try
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                throw new KeyNotFoundException($"Profile not found for user {userId}");
            }

            profile.ProfilePictureUrl = pictureUrl;
            profile.UpdatedAt = DateTime.UtcNow;

            _context.UserProfiles.Update(profile);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated profile picture URL for userId: {UserId}", userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile picture URL for userId: {UserId}", userId);
            throw;
        }
    }

    private void ValidateExperienceLevel(string level)
    {
        var validLevels = new[] { "BEGINNER", "INTERMEDIATE", "ADVANCED" };
        if (!validLevels.Contains(level))
        {
            throw new ArgumentException($"Invalid experience level. Must be one of: {string.Join(", ", validLevels)}");
        }
    }
}
