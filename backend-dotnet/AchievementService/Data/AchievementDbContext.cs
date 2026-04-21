using Microsoft.EntityFrameworkCore;
using AchievementService.Models;

namespace AchievementService.Data;

public class AchievementDbContext : DbContext
{
    public AchievementDbContext(DbContextOptions<AchievementDbContext> options) : base(options) { }

    public DbSet<Achievement> Achievements { get; set; } = null!;
    public DbSet<UserAchievement> UserAchievements { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Achievement>()
            .HasIndex(a => a.Category);

        modelBuilder.Entity<Achievement>()
            .HasIndex(a => a.Rarity);

        modelBuilder.Entity<UserAchievement>()
            .HasIndex(ua => ua.UserId);

        modelBuilder.Entity<UserAchievement>()
            .HasIndex(ua => ua.AchievementId);

        modelBuilder.Entity<UserAchievement>()
            .HasIndex(ua => new { ua.UserId, ua.AchievementId })
            .IsUnique();

        // Seed achievements
        SeedAchievements(modelBuilder);
    }

    private void SeedAchievements(ModelBuilder modelBuilder)
    {
        var achievements = new List<Achievement>();
        var id = 1;

        // Strength achievements
        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "First Lift",
            Description = "Complete your first workout",
            Rarity = AchievementRarity.Common,
            Category = AchievementCategory.Strength,
            XPReward = 25,
            UnlockCondition = "workouts_completed >= 1",
            IconUrl = "https://example.com/icons/first-lift.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Iron Will",
            Description = "Reach 100 total workouts",
            Rarity = AchievementRarity.Rare,
            Category = AchievementCategory.Strength,
            XPReward = 50,
            UnlockCondition = "workouts_completed >= 100",
            IconUrl = "https://example.com/icons/iron-will.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Muscle Master",
            Description = "Reach 500 total workouts",
            Rarity = AchievementRarity.Epic,
            Category = AchievementCategory.Strength,
            XPReward = 100,
            UnlockCondition = "workouts_completed >= 500",
            IconUrl = "https://example.com/icons/muscle-master.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Legendary Lifter",
            Description = "Reach 1000 total workouts",
            Rarity = AchievementRarity.Legendary,
            Category = AchievementCategory.Strength,
            XPReward = 250,
            UnlockCondition = "workouts_completed >= 1000",
            IconUrl = "https://example.com/icons/legendary-lifter.png",
            CreatedAt = DateTime.UtcNow
        });

        // Consistency achievements
        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Week Warrior",
            Description = "Maintain a 7-day streak",
            Rarity = AchievementRarity.Common,
            Category = AchievementCategory.Consistency,
            XPReward = 25,
            UnlockCondition = "streak >= 7",
            IconUrl = "https://example.com/icons/week-warrior.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Month Master",
            Description = "Maintain a 30-day streak",
            Rarity = AchievementRarity.Rare,
            Category = AchievementCategory.Consistency,
            XPReward = 50,
            UnlockCondition = "streak >= 30",
            IconUrl = "https://example.com/icons/month-master.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Century Club",
            Description = "Maintain a 100-day streak",
            Rarity = AchievementRarity.Epic,
            Category = AchievementCategory.Consistency,
            XPReward = 100,
            UnlockCondition = "streak >= 100",
            IconUrl = "https://example.com/icons/century-club.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Unstoppable",
            Description = "Maintain a 365-day streak",
            Rarity = AchievementRarity.Legendary,
            Category = AchievementCategory.Consistency,
            XPReward = 250,
            UnlockCondition = "streak >= 365",
            IconUrl = "https://example.com/icons/unstoppable.png",
            CreatedAt = DateTime.UtcNow
        });

        // Social achievements
        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Social Butterfly",
            Description = "Add 10 friends",
            Rarity = AchievementRarity.Common,
            Category = AchievementCategory.Social,
            XPReward = 25,
            UnlockCondition = "friends >= 10",
            IconUrl = "https://example.com/icons/social-butterfly.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Popular",
            Description = "Add 50 friends",
            Rarity = AchievementRarity.Rare,
            Category = AchievementCategory.Social,
            XPReward = 50,
            UnlockCondition = "friends >= 50",
            IconUrl = "https://example.com/icons/popular.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Community Leader",
            Description = "Add 100 friends",
            Rarity = AchievementRarity.Epic,
            Category = AchievementCategory.Social,
            XPReward = 100,
            UnlockCondition = "friends >= 100",
            IconUrl = "https://example.com/icons/community-leader.png",
            CreatedAt = DateTime.UtcNow
        });

        achievements.Add(new Achievement
        {
            Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
            Name = "Influencer",
            Description = "Add 500 friends",
            Rarity = AchievementRarity.Legendary,
            Category = AchievementCategory.Social,
            XPReward = 250,
            UnlockCondition = "friends >= 500",
            IconUrl = "https://example.com/icons/influencer.png",
            CreatedAt = DateTime.UtcNow
        });

        // Exploration achievements
        for (int i = 0; i < 20; i++)
        {
            achievements.Add(new Achievement
            {
                Id = Guid.Parse($"00000000-0000-0000-0000-{id++:000000000000}"),
                Name = $"Explorer {i + 1}",
                Description = $"Exploration achievement {i + 1}",
                Rarity = (AchievementRarity)(i % 4),
                Category = AchievementCategory.Exploration,
                XPReward = 25 + (i * 5),
                UnlockCondition = $"exploration_points >= {(i + 1) * 100}",
                IconUrl = $"https://example.com/icons/explorer-{i + 1}.png",
                CreatedAt = DateTime.UtcNow
            });
        }

        modelBuilder.Entity<Achievement>().HasData(achievements);
    }
}
