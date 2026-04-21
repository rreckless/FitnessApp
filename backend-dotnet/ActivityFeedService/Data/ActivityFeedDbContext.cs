using Microsoft.EntityFrameworkCore;
using ActivityFeedService.Models;

namespace ActivityFeedService.Data;

public class ActivityFeedDbContext : DbContext
{
    public ActivityFeedDbContext(DbContextOptions<ActivityFeedDbContext> options) : base(options) { }

    public DbSet<ActivityFeedEntry> ActivityFeedEntries { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ActivityFeedEntry>()
            .HasIndex(a => a.UserId);

        modelBuilder.Entity<ActivityFeedEntry>()
            .HasIndex(a => a.CreatedAt);

        modelBuilder.Entity<ActivityFeedEntry>()
            .HasIndex(a => new { a.UserId, a.CreatedAt });
    }
}
