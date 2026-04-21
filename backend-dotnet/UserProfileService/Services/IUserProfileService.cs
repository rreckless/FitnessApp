using UserProfileService.Models;

namespace UserProfileService.Services;

public interface IUserProfileService
{
    Task<UserProfile?> GetProfileAsync(Guid userId);
    Task<UserProfile> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<UserPreferences?> GetPreferencesAsync(Guid userId);
    Task<UserPreferences> UpdatePreferencesAsync(Guid userId, UpdatePreferencesRequest request);
    Task<string> UploadAvatarAsync(Guid userId, Stream fileStream, string fileName);
    Task<List<UserProfile>> SearchUsersAsync(string query, int limit = 10);
}

public record UpdateProfileRequest(
    string? Name,
    string? Bio,
    bool? IsPublic
);

public record UpdatePreferencesRequest(
    List<string>? FitnessGoals,
    string? ExperienceLevel,
    int? WorkoutFrequency,
    List<string>? AvailableEquipment
);

public record UserProfileResponse(
    Guid Id,
    string Email,
    string Name,
    string? Bio,
    string? ProfilePictureUrl,
    int Level,
    int TotalXP,
    int CurrentStreak,
    int LongestStreak,
    bool IsPublic,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record UserPreferencesResponse(
    Guid UserId,
    List<string> FitnessGoals,
    string ExperienceLevel,
    int WorkoutFrequency,
    List<string> AvailableEquipment
);
