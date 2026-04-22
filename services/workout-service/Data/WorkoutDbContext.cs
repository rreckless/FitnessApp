using Microsoft.EntityFrameworkCore;
using WorkoutService.Models;

namespace WorkoutService.Data;

public class WorkoutDbContext : DbContext
{
    public WorkoutDbContext(DbContextOptions<WorkoutDbContext> options) : base(options)
    {
    }

    public DbSet<Workout> Workouts { get; set; }
    public DbSet<WorkoutExercise> WorkoutExercises { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Workout configuration
        modelBuilder.Entity<Workout>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.StartTime).IsRequired();
            entity.Property(e => e.Duration).IsRequired();
            entity.Property(e => e.TotalVolume).IsRequired();
            entity.Property(e => e.TotalXP).IsRequired();
            entity.Property(e => e.IsOfflineCreated).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Indexes for common queries
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => e.DeletedAt); // for soft delete queries

            // Relationships
            entity.HasMany(e => e.Exercises)
                .WithOne(ex => ex.Workout)
                .HasForeignKey(ex => ex.WorkoutId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // WorkoutExercise configuration
        modelBuilder.Entity<WorkoutExercise>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.WorkoutId).IsRequired();
            entity.Property(e => e.ExerciseId).IsRequired();
            entity.Property(e => e.Order).IsRequired();
            entity.Property(e => e.TotalVolume).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Store Sets as JSON
            entity.Property(e => e.Sets)
                .HasColumnType("jsonb");

            // Indexes
            entity.HasIndex(e => e.WorkoutId);
            entity.HasIndex(e => e.ExerciseId);
        });
    }
}
