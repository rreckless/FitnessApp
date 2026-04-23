using AuthenticationService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthenticationService.Data;

public class AuthDbContext : DbContext
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<PasswordHistory> PasswordHistories { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>()
            .HasKey(u => u.Id);
        
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // PasswordHistory configuration
        modelBuilder.Entity<PasswordHistory>()
            .HasKey(ph => ph.Id);

        modelBuilder.Entity<PasswordHistory>()
            .HasOne(ph => ph.User)
            .WithMany(u => u.PasswordHistory)
            .HasForeignKey(ph => ph.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PasswordHistory>()
            .HasIndex(ph => new { ph.UserId, ph.CreatedAt });
    }
}
