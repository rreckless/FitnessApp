using Microsoft.EntityFrameworkCore;
using PremiumSubscriptionService.Data;
using PremiumSubscriptionService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<ISubscriptionService, SubscriptionServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<SubscriptionDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddAuthentication("Bearer");
builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

var subscriptionGroup = app.MapGroup("/subscription").WithTags("Subscription");

subscriptionGroup.MapGet("status", async (ISubscriptionService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var subscription = await service.GetSubscriptionAsync(userId);
    return Results.Ok(subscription);
})
.RequireAuthorization()
.WithName("GetSubscriptionStatus")
.WithOpenApi();

subscriptionGroup.MapPost("upgrade", async (UpgradeRequest request, ISubscriptionService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var subscription = await service.UpgradeAsync(userId, request.PaymentMethodId);
    return Results.Ok(subscription);
})
.RequireAuthorization()
.WithName("UpgradeSubscription")
.WithOpenApi();

subscriptionGroup.MapPost("cancel", async (ISubscriptionService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var subscription = await service.CancelAsync(userId);
    return Results.Ok(subscription);
})
.RequireAuthorization()
.WithName("CancelSubscription")
.WithOpenApi();

subscriptionGroup.MapPost("webhook", async (ISubscriptionService service, HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();
    var result = await service.HandleStripeWebhookAsync(body);
    return Results.Ok(result);
})
.WithName("StripeWebhook")
.WithOpenApi();

app.Run();

public record UpgradeRequest(string PaymentMethodId);
