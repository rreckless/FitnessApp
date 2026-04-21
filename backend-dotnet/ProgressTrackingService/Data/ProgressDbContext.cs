using Microsoft.EntityFrameworkCore;
using ProgressTrackingService.Models;

namespace ProgressTrackingService.Data;

public class ProgressDbContext : DbContext
{
    public ProgressDbContext(DbContextOptions<ProgressDbContext> options) : base(options) { }

    public DbSet<PersonalRecord> PersonalRecords { get; set; } = null!;
    public DbSet<VolumeData> VolumeData { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PersonalRecord>()
            .HasIndex(pr => pr.UserId);

        modelBuilder.Entity<PersonalRecord>()
            .HasIndex(pr => pr.ExerciseId);

        modelBuilder.Entity<PersonalRecord>()
            .HasIndex(pr => new { pr.UserId, pr.ExerciseId });

        modelBuilder.Entity<VolumeData>()
            .HasIndex(vd => vd.UserId);

        modelBuilder.Entity<VolumeData>()
            .HasIndex(vd => vd.Date);

        modelBuilder.Entity<VolumeData>()
            .HasIndex(vd => new { vd.UserId, vd.Date });
    }
}
