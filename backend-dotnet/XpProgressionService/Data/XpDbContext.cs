using Microsoft.EntityFrameworkCore;
using XpProgressionService.Models;

namespace XpProgressionService.Data;

public class XpDbContext : DbContext
{
    public XpDbContext(DbContextOptions<XpDbContext> options) : base(options) { }

    public DbSet<UserXP> UserXPs { get; set; } = null!;
    public DbSet<MuscleGroupRank> MuscleGroupRanks { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<UserXP>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
        });

        modelBuilder.Entity<MuscleGroupRank>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.MuscleGroup }).IsUnique();
        });
    }
}
