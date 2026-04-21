using SocialService.Models;

namespace SocialService.Services;

public interface ISocialService
{
    Task<FriendRequest> SendFriendRequestAsync(Guid senderId, Guid receiverId);
    Task<Friendship> AcceptFriendRequestAsync(Guid requestId);
    Task DeclineFriendRequestAsync(Guid requestId);
    Task RemoveFriendAsync(Guid userId1, Guid userId2);
    Task<List<UserProfile>> GetFriendsAsync(Guid userId);
    Task<List<UserProfile>> SearchUsersAsync(string query, int limit = 20);
    Task<int> GetFriendCountAsync(Guid userId);
    Task<bool> AreFriendsAsync(Guid userId1, Guid userId2);
}
