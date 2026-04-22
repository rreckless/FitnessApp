using Microsoft.EntityFrameworkCore;
using UserProfileService.Models;

namespace UserProfileService.Data;

public class UserProfileDbContext : DbContext
{
    public UserProfileDbContext(DbContextOptions<UserProfileDbContext> options) : base(options)
    {
    }

    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
    public DbSet<UserPreferences> UserPreferences { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserProfile configuration
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Bio).HasMaxLength(1000);
            entity.Property(e => e.ProfilePictureUrl).HasMaxLength(2048);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            
            // Create unique index on UserId
            entity.HasIndex(e => e.UserId).IsUnique();
        });

        // UserPreferences configuration
        modelBuilder.Entity<UserPreferences>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.FitnessGoals).IsRequired().HasMaxLength(500);
            entity.Property(e => e.ExperienceLevel).IsRequired().HasMaxLength(50);
            entity.Property(e => e.WorkoutFrequency).IsRequired();
            entity.Property(e => e.AvailableEquipment).IsRequired().HasMaxLength(500);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            
            // Create unique index on UserId
            entity.HasIndex(e => e.UserId).IsUnique();
        });
    }
}
