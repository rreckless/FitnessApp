using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using SyncService.Data;
using SyncService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<ISyncService, SyncServiceImpl>();
builder.Services.AddHostedService<SyncQueueProcessorService>();

// Add DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<SyncDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add JWT authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];
var issuer = jwtSettings["Issuer"];
var audience = jwtSettings["Audience"];

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!)),
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddLogging();

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

// Map endpoints
var syncGroup = app.MapGroup("/sync").WithTags("Sync");

syncGroup.MapPost("/pull", async (Guid userId, long lastSyncTimestamp, ISyncService syncService) =>
{
    var result = await syncService.PullChangesAsync(userId, lastSyncTimestamp);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("PullChanges")
.WithOpenApi();

syncGroup.MapPost("/push", async (Guid userId, List<SyncQueueEntryRequest> changes, ISyncService syncService) =>
{
    var entries = changes.Select(c => new SyncService.Models.SyncQueueEntry
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Operation = c.Operation,
        EntityType = c.EntityType,
        EntityId = c.EntityId,
        Payload = c.Payload,
        Timestamp = c.Timestamp,
        Status = "PENDING",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    }).ToList();

    var result = await syncService.PushChangesAsync(userId, entries);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("PushChanges")
.WithOpenApi();

syncGroup.MapGet("/status", async (Guid userId, ISyncService syncService) =>
{
    var status = await syncService.GetSyncStatusAsync(userId);
    return Results.Ok(status);
})
.RequireAuthorization()
.WithName("GetSyncStatus")
.WithOpenApi();

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();

public record SyncQueueEntryRequest(
    string Operation,
    string EntityType,
    Guid EntityId,
    string Payload,
    long Timestamp
);
