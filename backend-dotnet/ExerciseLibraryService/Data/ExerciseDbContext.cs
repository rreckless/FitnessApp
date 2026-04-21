using Microsoft.EntityFrameworkCore;
using ExerciseLibraryService.Models;

namespace ExerciseLibraryService.Data;

public class ExerciseDbContext : DbContext
{
    public ExerciseDbContext(DbContextOptions<ExerciseDbContext> options) : base(options) { }

    public DbSet<Exercise> Exercises { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Exercise>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.PrimaryMuscleGroup);
            entity.HasIndex(e => e.IsCustom);
            entity.HasIndex(e => e.CreatedByUserId);
            entity.Property(e => e.SecondaryMuscleGroups).HasColumnType("jsonb");
            entity.Property(e => e.Equipment).HasColumnType("jsonb");
            entity.Property(e => e.FormTips).HasColumnType("jsonb");
        });
    }
}
