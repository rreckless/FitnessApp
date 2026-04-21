using Microsoft.EntityFrameworkCore;
using StreakTrackingService.Models;

namespace StreakTrackingService.Data;

public class StreakDbContext : DbContext
{
    public StreakDbContext(DbContextOptions<StreakDbContext> options) : base(options) { }

    public DbSet<UserStreak> UserStreaks { get; set; } = null!;
    public DbSet<StreakMilestone> StreakMilestones { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<UserStreak>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasIndex(e => e.LastWorkoutDate);
        });

        modelBuilder.Entity<StreakMilestone>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.Days }).IsUnique();
            entity.HasIndex(e => e.AchievedAt);
        });
    }
}
