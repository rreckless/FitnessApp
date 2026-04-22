namespace UserProfileService.Services;

public interface IS3Service
{
    Task<string> GeneratePresignedUploadUrlAsync(Guid userId, string fileName);
    Task<string> GetProfilePictureUrlAsync(Guid userId, string fileName);
}
