using Microsoft.EntityFrameworkCore;
using GpsRouteService.Models;

namespace GpsRouteService.Data;

public class GpsDbContext : DbContext
{
    public GpsDbContext(DbContextOptions<GpsDbContext> options) : base(options) { }

    public DbSet<GpsRoute> GpsRoutes { get; set; } = null!;
    public DbSet<GpsPoint> GpsPoints { get; set; } = null!;
    public DbSet<RouteRating> RouteRatings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<GpsRoute>()
            .HasIndex(gr => gr.UserId);

        modelBuilder.Entity<GpsRoute>()
            .HasIndex(gr => gr.Difficulty);

        modelBuilder.Entity<GpsPoint>()
            .HasIndex(gp => gp.WorkoutId);

        modelBuilder.Entity<GpsPoint>()
            .HasIndex(gp => gp.Timestamp);

        modelBuilder.Entity<RouteRating>()
            .HasIndex(rr => rr.RouteId);

        modelBuilder.Entity<RouteRating>()
            .HasIndex(rr => rr.UserId);

        modelBuilder.Entity<RouteRating>()
            .HasIndex(rr => new { rr.RouteId, rr.UserId })
            .IsUnique();
    }
}
