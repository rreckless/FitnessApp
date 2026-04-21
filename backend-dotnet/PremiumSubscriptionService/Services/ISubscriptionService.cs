using PremiumSubscriptionService.Models;

namespace PremiumSubscriptionService.Services;

public interface ISubscriptionService
{
    Task<Subscription> GetSubscriptionAsync(Guid userId);
    Task<Subscription> UpgradeAsync(Guid userId, string stripePaymentMethodId);
    Task<Subscription> CancelAsync(Guid userId);
    Task<bool> IsPremiumAsync(Guid userId);
    Task<Subscription> HandleStripeWebhookAsync(string eventJson);
}
