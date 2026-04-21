namespace ActivityFeedService.Models;

public class ActivityFeedEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ActivityType ActivityType { get; set; }
    public Guid? RelatedEntityId { get; set; }
    public string Metadata { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public enum ActivityType
{
    WorkoutCompleted,
    LevelUp,
    AchievementUnlocked,
    StreakMilestone,
    FriendAdded
}
