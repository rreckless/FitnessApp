using Microsoft.EntityFrameworkCore;
using SocialService.Models;

namespace SocialService.Data;

public class SocialDbContext : DbContext
{
    public SocialDbContext(DbContextOptions<SocialDbContext> options) : base(options) { }

    public DbSet<Friendship> Friendships { get; set; } = null!;
    public DbSet<FriendRequest> FriendRequests { get; set; } = null!;
    public DbSet<UserProfile> UserProfiles { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Friendship indexes
        modelBuilder.Entity<Friendship>()
            .HasIndex(f => new { f.UserId1, f.UserId2 })
            .IsUnique();

        modelBuilder.Entity<Friendship>()
            .HasIndex(f => f.UserId1);

        modelBuilder.Entity<Friendship>()
            .HasIndex(f => f.UserId2);

        modelBuilder.Entity<Friendship>()
            .HasIndex(f => f.Status);

        // FriendRequest indexes
        modelBuilder.Entity<FriendRequest>()
            .HasIndex(f => f.SenderId);

        modelBuilder.Entity<FriendRequest>()
            .HasIndex(f => f.ReceiverId);

        modelBuilder.Entity<FriendRequest>()
            .HasIndex(f => new { f.SenderId, f.ReceiverId })
            .IsUnique();

        // UserProfile indexes
        modelBuilder.Entity<UserProfile>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<UserProfile>()
            .HasIndex(u => u.Name);
    }
}
