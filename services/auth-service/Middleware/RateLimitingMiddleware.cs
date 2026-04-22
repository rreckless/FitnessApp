using StackExchange.Redis;

namespace AuthService.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConnectionMultiplexer _redis;
    private const int AuthEndpointLimit = 10; // requests per second
    private const int OtherEndpointLimit = 100; // requests per second

    public RateLimitingMiddleware(RequestDelegate next, IConnectionMultiplexer redis)
    {
        _next = next;
        _redis = redis;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var clientId = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = context.Request.Path.Value ?? "";

        var limit = path.StartsWith("/auth") ? AuthEndpointLimit : OtherEndpointLimit;
        var key = $"rate_limit:{clientId}:{path}";

        var db = _redis.GetDatabase();
        var currentCount = await db.StringGetAsync(key);

        if (currentCount.HasValue && int.Parse(currentCount.ToString()) >= limit)
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await context.Response.WriteAsJsonAsync(new { error = "Too many requests" });
            return;
        }

        var newCount = currentCount.HasValue ? int.Parse(currentCount.ToString()) + 1 : 1;
        await db.StringSetAsync(key, newCount.ToString(), TimeSpan.FromSeconds(1));

        await _next(context);
    }
}
