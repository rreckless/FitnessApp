using StackExchange.Redis;

namespace AuthService.Middleware;

public class BruteForceProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConnectionMultiplexer _redis;
    private const int MaxFailedAttempts = 5;
    private const int LockoutDurationMinutes = 15;

    public BruteForceProtectionMiddleware(RequestDelegate next, IConnectionMultiplexer redis)
    {
        _next = next;
        _redis = redis;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only apply to login endpoint
        if (!context.Request.Path.Value?.Contains("/auth/login", StringComparison.OrdinalIgnoreCase) ?? true)
        {
            await _next(context);
            return;
        }

        // Read the request body
        var originalBodyStream = context.Request.Body;
        using (var memoryStream = new MemoryStream())
        {
            await context.Request.Body.CopyToAsync(memoryStream);
            memoryStream.Position = 0;
            context.Request.Body = memoryStream;

            // Parse email from request
            var reader = new StreamReader(memoryStream);
            var body = await reader.ReadToEndAsync();
            memoryStream.Position = 0;

            string? email = null;
            try
            {
                var json = System.Text.Json.JsonDocument.Parse(body);
                email = json.RootElement.GetProperty("email").GetString();
            }
            catch
            {
                // If we can't parse, just continue
            }

            if (!string.IsNullOrEmpty(email))
            {
                var db = _redis.GetDatabase();
                var lockKey = $"account_lock:{email}";
                var isLocked = await db.StringGetAsync(lockKey);

                if (isLocked.HasValue)
                {
                    context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.Response.WriteAsJsonAsync(new { error = "Account temporarily locked due to too many failed login attempts" });
                    return;
                }
            }

            context.Request.Body = originalBodyStream;
        }

        await _next(context);
    }
}
