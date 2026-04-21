using Microsoft.EntityFrameworkCore;
using BodyTrackingService.Models;

namespace BodyTrackingService.Data;

public class BodyTrackingDbContext : DbContext
{
    public BodyTrackingDbContext(DbContextOptions<BodyTrackingDbContext> options) : base(options) { }

    public DbSet<BodyWeight> BodyWeights { get; set; } = null!;
    public DbSet<BodyMeasurement> BodyMeasurements { get; set; } = null!;
    public DbSet<ProgressPhoto> ProgressPhotos { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<BodyWeight>()
            .HasIndex(bw => bw.UserId);

        modelBuilder.Entity<BodyWeight>()
            .HasIndex(bw => bw.RecordedAt);

        modelBuilder.Entity<BodyMeasurement>()
            .HasIndex(bm => bm.UserId);

        modelBuilder.Entity<BodyMeasurement>()
            .HasIndex(bm => bm.RecordedAt);

        modelBuilder.Entity<ProgressPhoto>()
            .HasIndex(pp => pp.UserId);

        modelBuilder.Entity<ProgressPhoto>()
            .HasIndex(pp => pp.RecordedAt);
    }
}
