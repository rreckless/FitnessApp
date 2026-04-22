using UserProfileService.Models;

namespace UserProfileService.Services;

public interface IUserProfileService
{
    Task<UserProfile?> GetUserProfileAsync(Guid userId);
    Task<UserProfile> CreateUserProfileAsync(Guid userId, string name, string email);
    Task<UserProfile> UpdateUserProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<UserPreferences?> GetUserPreferencesAsync(Guid userId);
    Task<UserPreferences> UpdateUserPreferencesAsync(Guid userId, UpdatePreferencesRequest request);
    Task<string> GenerateProfilePictureUploadUrlAsync(Guid userId, string fileName);
    Task UpdateProfilePictureUrlAsync(Guid userId, string pictureUrl);
}
