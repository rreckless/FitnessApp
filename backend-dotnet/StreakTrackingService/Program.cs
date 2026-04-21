using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using StreakTrackingService.Data;
using StreakTrackingService.Services;
using FitQuest.EventBus.Abstractions;
using FitQuest.EventBus.Implementations;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<IStreakService, StreakServiceImpl>();

// Add DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<StreakDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Event Bus
var rabbitMQSettings = builder.Configuration.GetSection("RabbitMQ");
builder.Services.AddSingleton<IEventBus>(sp =>
    new RabbitMQEventBus(
        rabbitMQSettings["HostName"] ?? "localhost",
        int.Parse(rabbitMQSettings["Port"] ?? "5672"),
        rabbitMQSettings["UserName"] ?? "guest",
        rabbitMQSettings["Password"] ?? "guest",
        sp.GetRequiredService<ILogger<RabbitMQEventBus>>()
    )
);

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
var streakGroup = app.MapGroup("/users/{userId}/streak").WithTags("Streak Tracking");

streakGroup.MapGet("/", async (Guid userId, IStreakService streakService) =>
{
    var streak = await streakService.GetStreakAsync(userId);
    return Results.Ok(streak);
})
.WithName("GetStreak")
.WithOpenApi();

streakGroup.MapPost("/update", async (Guid userId, UpdateStreakRequest request, IStreakService streakService) =>
{
    try
    {
        var result = await streakService.UpdateStreakAsync(userId, request.WorkoutId);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.RequireAuthorization()
.WithName("UpdateStreak")
.WithOpenApi();

streakGroup.MapGet("/milestones", async (Guid userId, IStreakService streakService) =>
{
    var milestones = await streakService.GetMilestonesAsync(userId);
    return Results.Ok(milestones);
})
.WithName("GetMilestones")
.WithOpenApi();

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();

public record UpdateStreakRequest(Guid WorkoutId);
