using Microsoft.EntityFrameworkCore;
using StreakService.Models;

namespace StreakService.Data;

public class StreakDbContext : DbContext
{
    public StreakDbContext(DbContextOptions<StreakDbContext> options) : base(options)
    {
    }

    public DbSet<StreakTracking> StreakTrackings { get; set; }
    public DbSet<StreakMilestone> StreakMilestones { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // StreakTracking configuration
        modelBuilder.Entity<StreakTracking>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.CurrentStreak).IsRequired().HasDefaultValue(0);
            entity.Property(e => e.LongestStreak).IsRequired().HasDefaultValue(0);
            entity.Property(e => e.LastWorkoutDate).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Indexes for performance
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasIndex(e => e.LastWorkoutDate);
        });

        // StreakMilestone configuration
        modelBuilder.Entity<StreakMilestone>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.Days).IsRequired();
            entity.Property(e => e.XPReward).IsRequired();
            entity.Property(e => e.AchievedAt).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();

            // Indexes for performance
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.Days }).IsUnique();
        });
    }
}
