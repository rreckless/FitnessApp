using Microsoft.EntityFrameworkCore;
using XPProgressionService.Models;

namespace XPProgressionService.Data;

public class XPDbContext : DbContext
{
    public XPDbContext(DbContextOptions<XPDbContext> options) : base(options)
    {
    }

    public DbSet<UserXP> UserXPs { get; set; } = null!;
    public DbSet<MuscleGroupRank> MuscleGroupRanks { get; set; } = null!;
    public DbSet<ProgressionHistory> ProgressionHistories { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserXP configuration
        modelBuilder.Entity<UserXP>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.TotalXP).HasDefaultValue(0);
            entity.Property(e => e.CurrentLevel).HasDefaultValue(1);
            entity.Property(e => e.XPToNextLevel).HasDefaultValue(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // MuscleGroupRank configuration
        modelBuilder.Entity<MuscleGroupRank>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.MuscleGroup }).IsUnique();
            entity.Property(e => e.Rank).HasDefaultValue(1);
            entity.Property(e => e.TotalVolume).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // ProgressionHistory configuration
        modelBuilder.Entity<ProgressionHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });
    }
}
