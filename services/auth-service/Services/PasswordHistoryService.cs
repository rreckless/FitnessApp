using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPasswordHistoryService
{
    Task<bool> IsPasswordReusedAsync(Guid userId, string password, IPasswordHasher hasher);
    Task AddPasswordToHistoryAsync(Guid userId, string passwordHash);
    Task CleanupOldPasswordsAsync(Guid userId);
}

public class PasswordHistoryService : IPasswordHistoryService
{
    private const int MaxPasswordHistoryCount = 5;
    private readonly AuthDbContext _context;

    public PasswordHistoryService(AuthDbContext context)
    {
        _context = context;
    }

    public async Task<bool> IsPasswordReusedAsync(Guid userId, string password, IPasswordHasher hasher)
    {
        var passwordHistories = await _context.PasswordHistories
            .Where(ph => ph.UserId == userId)
            .OrderByDescending(ph => ph.CreatedAt)
            .Take(MaxPasswordHistoryCount)
            .ToListAsync();

        foreach (var history in passwordHistories)
        {
            if (hasher.VerifyPassword(password, history.PasswordHash))
            {
                return true;
            }
        }

        return false;
    }

    public async Task AddPasswordToHistoryAsync(Guid userId, string passwordHash)
    {
        var history = new PasswordHistory
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow
        };

        _context.PasswordHistories.Add(history);
        await _context.SaveChangesAsync();

        await CleanupOldPasswordsAsync(userId);
    }

    public async Task CleanupOldPasswordsAsync(Guid userId)
    {
        var oldPasswords = await _context.PasswordHistories
            .Where(ph => ph.UserId == userId)
            .OrderByDescending(ph => ph.CreatedAt)
            .Skip(MaxPasswordHistoryCount)
            .ToListAsync();

        if (oldPasswords.Any())
        {
            _context.PasswordHistories.RemoveRange(oldPasswords);
            await _context.SaveChangesAsync();
        }
    }
}
