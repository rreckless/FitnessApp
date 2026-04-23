using ExerciseLibraryService.Models;
using Microsoft.EntityFrameworkCore;

namespace ExerciseLibraryService.Data;

public class ExerciseDbContext : DbContext
{
    public ExerciseDbContext(DbContextOptions<ExerciseDbContext> options) : base(options)
    {
    }

    public DbSet<Exercise> Exercises { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Exercise>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired();
            entity.Property(e => e.PrimaryMuscleGroup).IsRequired();
            entity.Property(e => e.Difficulty).IsRequired();
            entity.Property(e => e.IsBuiltIn).IsRequired().HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Convert enums to strings for storage
            entity.Property(e => e.PrimaryMuscleGroup)
                .HasConversion<string>();
            entity.Property(e => e.Difficulty)
                .HasConversion<string>();

            // Convert lists to JSON
            entity.Property(e => e.SecondaryMuscleGroups)
                .HasConversion(
                    v => string.Join(",", v.Select(e => e.ToString())),
                    v => v.Split(",", StringSplitOptions.RemoveEmptyEntries)
                        .Select(e => Enum.Parse<MuscleGroup>(e))
                        .ToList());

            entity.Property(e => e.Equipment)
                .HasConversion(
                    v => string.Join(",", v.Select(e => e.ToString())),
                    v => v.Split(",", StringSplitOptions.RemoveEmptyEntries)
                        .Select(e => Enum.Parse<Equipment>(e))
                        .ToList());

            entity.Property(e => e.FormTips)
                .HasConversion(
                    v => string.Join("|", v),
                    v => v.Split("|", StringSplitOptions.RemoveEmptyEntries).ToList());

            // Create indexes for common queries
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.PrimaryMuscleGroup);
            entity.HasIndex(e => e.IsBuiltIn);
            entity.HasIndex(e => e.CreatedByUserId);
        });
    }
}
