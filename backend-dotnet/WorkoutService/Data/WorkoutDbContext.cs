using Microsoft.EntityFrameworkCore;
using WorkoutService.Models;

namespace WorkoutService.Data;

public class WorkoutDbContext : DbContext
{
    public WorkoutDbContext(DbContextOptions<WorkoutDbContext> options) : base(options) { }

    public DbSet<Workout> Workouts { get; set; } = null!;
    public DbSet<WorkoutExercise> WorkoutExercises { get; set; } = null!;
    public DbSet<WorkoutSet> WorkoutSets { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Workout>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.DeletedAt).IsRequired(false);
            entity.HasMany(e => e.Exercises)
                .WithOne(ex => ex.Workout)
                .HasForeignKey(ex => ex.WorkoutId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkoutExercise>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.WorkoutId);
            entity.HasMany(e => e.Sets)
                .WithOne(s => s.WorkoutExercise)
                .HasForeignKey(s => s.WorkoutExerciseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkoutSet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.WorkoutExerciseId);
        });
    }
}
