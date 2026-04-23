using SyncService.Models;
using Microsoft.EntityFrameworkCore;

namespace SyncService.Data;

/// <summary>
/// Database context for the Sync Service.
/// </summary>
public class SyncDbContext : DbContext
{
    /// <summary>
    /// Initializes a new instance of the SyncDbContext class.
    /// </summary>
    public SyncDbContext(DbContextOptions<SyncDbContext> options) : base(options)
    {
    }

    /// <summary>
    /// DbSet for sync queue entries.
    /// </summary>
    public DbSet<SyncQueue> SyncQueues { get; set; } = null!;

    /// <summary>
    /// Configures the database model.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure SyncQueue table
        modelBuilder.Entity<SyncQueue>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.Operation).IsRequired();
            entity.Property(e => e.EntityType).IsRequired();
            entity.Property(e => e.EntityId).IsRequired();
            entity.Property(e => e.Payload).IsRequired();
            entity.Property(e => e.Status).IsRequired();
            entity.Property(e => e.RetryCount).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Create indexes for common queries
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => new { e.UserId, e.Status });
            entity.HasIndex(e => e.CreatedAt);
        });
    }
}
