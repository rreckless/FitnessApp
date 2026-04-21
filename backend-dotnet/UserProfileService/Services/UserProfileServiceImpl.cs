using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Amazon.S3;
using Amazon.S3.Transfer;
using UserProfileService.Data;
using UserProfileService.Models;

namespace UserProfileService.Services;

public class UserProfileServiceImpl : IUserProfileService
{
    private readonly UserProfileDbContext _dbContext;
    private readonly IDistributedCache _cache;
    private readonly IAmazonS3 _s3Client;
    private readonly IConfiguration _configuration;
    private readonly ILogger<UserProfileServiceImpl> _logger;

    public UserProfileServiceImpl(
        UserProfileDbContext dbContext,
        IDistributedCache cache,
        IAmazonS3 s3Client,
        IConfiguration configuration,
        ILogger<UserProfileServiceImpl> logger)
    {
        _dbContext = dbContext;
        _cache = cache;
        _s3Client = s3Client;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<UserProfile?> GetProfileAsync(Guid userId)
    {
        // Try cache first
        var cacheKey = $"profile:{userId}";
        var cachedProfile = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cachedProfile))
        {
            _logger.LogInformation("Profile cache hit for user {UserId}", userId);
            return JsonSerializer.Deserialize<UserProfile>(cachedProfile);
        }

        // Get from database
        var profile = await _dbContext.UserProfiles
            .Include(p => p.Preferences)
            .FirstOrDefaultAsync(p => p.Id == userId);

        if (profile != null)
        {
            // Cache for 1 hour
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(profile), cacheOptions);
        }

        return profile;
    }

    public async Task<UserProfile> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var profile = await _dbContext.UserProfiles.FirstOrDefaultAsync(p => p.Id == userId);
        if (profile == null)
        {
            throw new InvalidOperationException($"User profile {userId} not found");
        }

        if (!string.IsNullOrEmpty(request.Name))
            profile.Name = request.Name;

        if (request.Bio != null)
            profile.Bio = request.Bio;

        if (request.IsPublic.HasValue)
            profile.IsPublic = request.IsPublic.Value;

        profile.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        // Invalidate cache
        var cacheKey = $"profile:{userId}";
        await _cache.RemoveAsync(cacheKey);

        _logger.LogInformation("Updated profile for user {UserId}", userId);
        return profile;
    }

    public async Task<UserPreferences?> GetPreferencesAsync(Guid userId)
    {
        return await _dbContext.UserPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId);
    }

    public async Task<UserPreferences> UpdatePreferencesAsync(Guid userId, UpdatePreferencesRequest request)
    {
        var preferences = await _dbContext.UserPreferences
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
            _dbContext.UserPreferences.Add(preferences);
        }

        if (request.FitnessGoals != null)
            preferences.FitnessGoals = JsonSerializer.Serialize(request.FitnessGoals);

        if (!string.IsNullOrEmpty(request.ExperienceLevel))
            preferences.ExperienceLevel = request.ExperienceLevel;

        if (request.WorkoutFrequency.HasValue)
            preferences.WorkoutFrequency = request.WorkoutFrequency.Value;

        if (request.AvailableEquipment != null)
            preferences.AvailableEquipment = JsonSerializer.Serialize(request.AvailableEquipment);

        preferences.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Updated preferences for user {UserId}", userId);
        return preferences;
    }

    public async Task<string> UploadAvatarAsync(Guid userId, Stream fileStream, string fileName)
    {
        var profile = await _dbContext.UserProfiles.FirstOrDefaultAsync(p => p.Id == userId);
        if (profile == null)
        {
            throw new InvalidOperationException($"User profile {userId} not found");
        }

        // Validate file
        if (fileStream.Length > 5 * 1024 * 1024) // 5MB max
        {
            throw new InvalidOperationException("File size exceeds 5MB limit");
        }

        var bucketName = _configuration["S3:BucketName"] ?? "fitquest-profiles";
        var key = $"avatars/{userId}/{Guid.NewGuid()}-{fileName}";

        try
        {
            using (var fileTransferUtility = new TransferUtility(_s3Client))
            {
                await fileTransferUtility.UploadAsync(fileStream, bucketName, key);
            }

            var s3Url = $"https://{bucketName}.s3.amazonaws.com/{key}";
            profile.ProfilePictureUrl = s3Url;
            profile.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            // Invalidate cache
            var cacheKey = $"profile:{userId}";
            await _cache.RemoveAsync(cacheKey);

            _logger.LogInformation("Uploaded avatar for user {UserId} to {Url}", userId, s3Url);
            return s3Url;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload avatar for user {UserId}", userId);
            throw;
        }
    }

    public async Task<List<UserProfile>> SearchUsersAsync(string query, int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(query))
            return new List<UserProfile>();

        var searchTerm = query.ToLower();
        var results = await _dbContext.UserProfiles
            .Where(p => p.IsPublic && (
                p.Name.ToLower().Contains(searchTerm) ||
                p.Email.ToLower().Contains(searchTerm)
            ))
            .Take(limit)
            .ToListAsync();

        _logger.LogInformation("Searched for users with query '{Query}', found {Count} results", query, results.Count);
        return results;
    }
}
