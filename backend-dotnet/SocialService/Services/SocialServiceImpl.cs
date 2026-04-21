using Microsoft.EntityFrameworkCore;
using SocialService.Data;
using SocialService.Models;

namespace SocialService.Services;

public class SocialServiceImpl : ISocialService
{
    private readonly SocialDbContext _dbContext;
    private readonly ILogger<SocialServiceImpl> _logger;

    public SocialServiceImpl(SocialDbContext dbContext, ILogger<SocialServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<FriendRequest> SendFriendRequestAsync(Guid senderId, Guid receiverId)
    {
        if (senderId == receiverId)
            throw new InvalidOperationException("Cannot send friend request to yourself");

        // Check if already friends
        var existing = await _dbContext.Friendships
            .FirstOrDefaultAsync(f =>
                (f.UserId1 == senderId && f.UserId2 == receiverId ||
                 f.UserId1 == receiverId && f.UserId2 == senderId) &&
                f.Status == FriendshipStatus.Accepted);

        if (existing != null)
            throw new InvalidOperationException("Already friends");

        // Check if request already exists
        var existingRequest = await _dbContext.FriendRequests
            .FirstOrDefaultAsync(f => f.SenderId == senderId && f.ReceiverId == receiverId);

        if (existingRequest != null)
            throw new InvalidOperationException("Friend request already sent");

        var request = new FriendRequest
        {
            Id = Guid.NewGuid(),
            SenderId = senderId,
            ReceiverId = receiverId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.FriendRequests.Add(request);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Friend request sent from {SenderId} to {ReceiverId}", senderId, receiverId);
        return request;
    }

    public async Task<Friendship> AcceptFriendRequestAsync(Guid requestId)
    {
        var request = await _dbContext.FriendRequests.FindAsync(requestId);
        if (request == null)
            throw new KeyNotFoundException("Friend request not found");

        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            UserId1 = request.SenderId,
            UserId2 = request.ReceiverId,
            Status = FriendshipStatus.Accepted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Friendships.Add(friendship);
        _dbContext.FriendRequests.Remove(request);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Friend request accepted: {FriendshipId}", friendship.Id);
        return friendship;
    }

    public async Task DeclineFriendRequestAsync(Guid requestId)
    {
        var request = await _dbContext.FriendRequests.FindAsync(requestId);
        if (request == null)
            throw new KeyNotFoundException("Friend request not found");

        _dbContext.FriendRequests.Remove(request);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Friend request declined: {RequestId}", requestId);
    }

    public async Task RemoveFriendAsync(Guid userId1, Guid userId2)
    {
        var friendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f =>
                (f.UserId1 == userId1 && f.UserId2 == userId2 ||
                 f.UserId1 == userId2 && f.UserId2 == userId1) &&
                f.Status == FriendshipStatus.Accepted);

        if (friendship == null)
            throw new KeyNotFoundException("Friendship not found");

        _dbContext.Friendships.Remove(friendship);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Friendship removed between {UserId1} and {UserId2}", userId1, userId2);
    }

    public async Task<List<UserProfile>> GetFriendsAsync(Guid userId)
    {
        var friendIds = await _dbContext.Friendships
            .Where(f =>
                (f.UserId1 == userId || f.UserId2 == userId) &&
                f.Status == FriendshipStatus.Accepted)
            .Select(f => f.UserId1 == userId ? f.UserId2 : f.UserId1)
            .ToListAsync();

        var friends = await _dbContext.UserProfiles
            .Where(u => friendIds.Contains(u.Id))
            .ToListAsync();

        return friends;
    }

    public async Task<List<UserProfile>> SearchUsersAsync(string query, int limit = 20)
    {
        var lowerQuery = query.ToLower();
        var results = await _dbContext.UserProfiles
            .Where(u => u.Name.ToLower().Contains(lowerQuery) ||
                        u.Email.ToLower().Contains(lowerQuery))
            .Take(limit)
            .ToListAsync();

        return results;
    }

    public async Task<int> GetFriendCountAsync(Guid userId)
    {
        return await _dbContext.Friendships
            .CountAsync(f =>
                (f.UserId1 == userId || f.UserId2 == userId) &&
                f.Status == FriendshipStatus.Accepted);
    }

    public async Task<bool> AreFriendsAsync(Guid userId1, Guid userId2)
    {
        return await _dbContext.Friendships
            .AnyAsync(f =>
                (f.UserId1 == userId1 && f.UserId2 == userId2 ||
                 f.UserId1 == userId2 && f.UserId2 == userId1) &&
                f.Status == FriendshipStatus.Accepted);
    }
}
