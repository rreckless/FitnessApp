using Microsoft.EntityFrameworkCore;
using PremiumSubscriptionService.Data;
using PremiumSubscriptionService.Models;

namespace PremiumSubscriptionService.Services;

public class SubscriptionServiceImpl : ISubscriptionService
{
    private readonly SubscriptionDbContext _dbContext;
    private readonly ILogger<SubscriptionServiceImpl> _logger;

    public SubscriptionServiceImpl(SubscriptionDbContext dbContext, ILogger<SubscriptionServiceImpl> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<Subscription> GetSubscriptionAsync(Guid userId)
    {
        var subscription = await _dbContext.Subscriptions.FirstOrDefaultAsync(s => s.UserId == userId);
        
        if (subscription == null)
        {
            subscription = new Subscription
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Tier = SubscriptionTier.Free,
                StartDate = DateTime.UtcNow,
                AutoRenew = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.Subscriptions.Add(subscription);
            await _dbContext.SaveChangesAsync();
        }

        return subscription;
    }

    public async Task<Subscription> UpgradeAsync(Guid userId, string stripePaymentMethodId)
    {
        var subscription = await GetSubscriptionAsync(userId);
        
        subscription.Tier = SubscriptionTier.Premium;
        subscription.StartDate = DateTime.UtcNow;
        subscription.EndDate = DateTime.UtcNow.AddMonths(1);
        subscription.AutoRenew = true;
        subscription.UpdatedAt = DateTime.UtcNow;

        _dbContext.Subscriptions.Update(subscription);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Subscription upgraded: {UserId}", userId);
        return subscription;
    }

    public async Task<Subscription> CancelAsync(Guid userId)
    {
        var subscription = await GetSubscriptionAsync(userId);
        
        subscription.Tier = SubscriptionTier.Free;
        subscription.EndDate = DateTime.UtcNow;
        subscription.AutoRenew = false;
        subscription.UpdatedAt = DateTime.UtcNow;

        _dbContext.Subscriptions.Update(subscription);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Subscription cancelled: {UserId}", userId);
        return subscription;
    }

    public async Task<bool> IsPremiumAsync(Guid userId)
    {
        var subscription = await GetSubscriptionAsync(userId);
        return subscription.Tier == SubscriptionTier.Premium && 
               (subscription.EndDate == null || subscription.EndDate > DateTime.UtcNow);
    }

    public async Task<Subscription> HandleStripeWebhookAsync(string eventJson)
    {
        _logger.LogInformation("Stripe webhook received");
        
        // In a real implementation, parse the Stripe event and update subscription
        // For now, just return a dummy subscription
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Tier = SubscriptionTier.Premium,
            StartDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        return subscription;
    }
}
