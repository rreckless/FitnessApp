using Microsoft.EntityFrameworkCore;
using UserProfileService.Models;

namespace UserProfileService.Data;

public class UserProfileDbContext : DbContext
{
    public UserProfileDbContext(DbContextOptions<UserProfileDbContext> options) : base(options) { }

    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
    public DbSet<UserPreferences> UserPreferences { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserProfile configuration
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.Preferences)
                .WithOne(p => p.UserProfile)
                .HasForeignKey<UserPreferences>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // UserPreferences configuration
        modelBuilder.Entity<UserPreferences>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
        });
    }
}
