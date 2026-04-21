namespace PremiumSubscriptionService.Models;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public SubscriptionTier Tier { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripeCustomerId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool AutoRenew { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum SubscriptionTier
{
    Free,
    Premium
}
