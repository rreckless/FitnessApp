using StackExchange.Redis;

namespace AuthService.Services;

public interface ITokenBlacklistService
{
    Task AddTokenToBlacklistAsync(string token, int expirySeconds);
    Task<bool> IsTokenBlacklistedAsync(string token);
}

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly IConnectionMultiplexer _redis;
    private const string BlacklistKeyPrefix = "token:blacklist:";

    public TokenBlacklistService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task AddTokenToBlacklistAsync(string token, int expirySeconds)
    {
        var db = _redis.GetDatabase();
        var key = $"{BlacklistKeyPrefix}{token}";
        await db.StringSetAsync(key, "blacklisted", TimeSpan.FromSeconds(expirySeconds));
    }

    public async Task<bool> IsTokenBlacklistedAsync(string token)
    {
        var db = _redis.GetDatabase();
        var key = $"{BlacklistKeyPrefix}{token}";
        var value = await db.StringGetAsync(key);
        return value.HasValue;
    }
}
