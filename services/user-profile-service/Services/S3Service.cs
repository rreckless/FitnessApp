using Amazon.S3;
using Amazon.S3.Model;

namespace UserProfileService.Services;

public class S3Service : IS3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly IConfiguration _configuration;
    private readonly ILogger<S3Service> _logger;
    private readonly string _bucketName;
    private readonly int _presignedUrlExpirationMinutes;

    public S3Service(
        IAmazonS3 s3Client,
        IConfiguration configuration,
        ILogger<S3Service> logger)
    {
        _s3Client = s3Client;
        _configuration = configuration;
        _logger = logger;
        _bucketName = configuration["AWS:S3:BucketName"] ?? "fitquest-profiles";
        _presignedUrlExpirationMinutes = int.Parse(configuration["AWS:S3:PresignedUrlExpirationMinutes"] ?? "15");
    }

    public async Task<string> GeneratePresignedUploadUrlAsync(Guid userId, string fileName)
    {
        try
        {
            // Validate file name
            if (string.IsNullOrWhiteSpace(fileName))
            {
                throw new ArgumentException("File name cannot be empty");
            }

            // Generate S3 key
            var s3Key = $"profiles/{userId}/{Guid.NewGuid()}_{fileName}";

            // Create presigned URL request
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = s3Key,
                Expires = DateTime.UtcNow.AddMinutes(_presignedUrlExpirationMinutes),
                Verb = HttpVerb.PUT,
                ContentType = GetContentType(fileName)
            };

            var url = _s3Client.GetPreSignedURL(request);
            _logger.LogInformation("Generated presigned upload URL for userId: {UserId}, key: {S3Key}", userId, s3Key);
            return await Task.FromResult(url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating presigned upload URL for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<string> GetProfilePictureUrlAsync(Guid userId, string fileName)
    {
        try
        {
            var s3Key = $"profiles/{userId}/{fileName}";

            // Create presigned URL request for GET
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = s3Key,
                Expires = DateTime.UtcNow.AddDays(7), // 7-day expiration for viewing
                Verb = HttpVerb.GET
            };

            var url = _s3Client.GetPreSignedURL(request);
            _logger.LogInformation("Generated presigned download URL for userId: {UserId}, key: {S3Key}", userId, s3Key);
            return await Task.FromResult(url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating presigned download URL for userId: {UserId}", userId);
            throw;
        }
    }

    private string GetContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }
}
