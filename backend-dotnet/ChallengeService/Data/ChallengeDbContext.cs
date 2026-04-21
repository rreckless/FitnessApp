using Microsoft.EntityFrameworkCore;
using ChallengeService.Models;

namespace ChallengeService.Data;

public class ChallengeDbContext : DbContext
{
    public ChallengeDbContext(DbContextOptions<ChallengeDbContext> options) : base(options) { }

    public DbSet<Challenge> Challenges { get; set; } = null!;
    public DbSet<ChallengeProgress> ChallengeProgress { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Challenge>()
            .HasIndex(c => c.CreatorId);

        modelBuilder.Entity<Challenge>()
            .HasIndex(c => c.Type);

        modelBuilder.Entity<Challenge>()
            .HasIndex(c => c.EndDate);

        modelBuilder.Entity<ChallengeProgress>()
            .HasIndex(cp => cp.ChallengeId);

        modelBuilder.Entity<ChallengeProgress>()
            .HasIndex(cp => cp.UserId);

        modelBuilder.Entity<ChallengeProgress>()
            .HasIndex(cp => new { cp.ChallengeId, cp.UserId })
            .IsUnique();
    }
}
