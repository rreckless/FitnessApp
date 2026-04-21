using Microsoft.EntityFrameworkCore;
using PremiumSubscriptionService.Models;

namespace PremiumSubscriptionService.Data;

public class SubscriptionDbContext : DbContext
{
    public SubscriptionDbContext(DbContextOptions<SubscriptionDbContext> options) : base(options) { }

    public DbSet<Subscription> Subscriptions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Subscription>()
            .HasIndex(s => s.UserId)
            .IsUnique();

        modelBuilder.Entity<Subscription>()
            .HasIndex(s => s.Tier);

        modelBuilder.Entity<Subscription>()
            .HasIndex(s => s.EndDate);
    }
}
