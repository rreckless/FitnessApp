using Microsoft.EntityFrameworkCore;
using SyncService.Models;

namespace SyncService.Data;

public class SyncDbContext : DbContext
{
    public SyncDbContext(DbContextOptions<SyncDbContext> options) : base(options) { }

    public DbSet<SyncQueueEntry> SyncQueueEntries { get; set; } = null!;
    public DbSet<SyncConflict> SyncConflicts { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // SyncQueueEntry configuration
        modelBuilder.Entity<SyncQueueEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.Status });
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.EntityType, e.EntityId });
            entity.Property(e => e.Payload).HasColumnType("jsonb");
        });

        // SyncConflict configuration
        modelBuilder.Entity<SyncConflict>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.EntityType, e.EntityId });
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.LocalVersion).HasColumnType("jsonb");
            entity.Property(e => e.CloudVersion).HasColumnType("jsonb");
            entity.Property(e => e.ResolvedVersion).HasColumnType("jsonb");
        });
    }
}
