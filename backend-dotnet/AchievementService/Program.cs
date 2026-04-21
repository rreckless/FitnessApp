using Microsoft.EntityFrameworkCore;
using AchievementService.Data;
using AchievementService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IAchievementService, AchievementServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AchievementDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
});

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

var achievementsGroup = app.MapGroup("/achievements").WithTags("Achievements");

// Get all achievements
achievementsGroup.MapGet("", async (IAchievementService service) =>
{
    var achievements = await service.GetAllAchievementsAsync();
    return Results.Ok(achievements);
})
.WithName("GetAllAchievements")
.WithOpenApi();

// Get user achievements
achievementsGroup.MapGet("users/{userId}", async (Guid userId, IAchievementService service) =>
{
    var achievements = await service.GetUserAchievementsAsync(userId);
    return Results.Ok(achievements);
})
.WithName("GetUserAchievements")
.WithOpenApi();

// Get unlocked achievements
achievementsGroup.MapGet("users/{userId}/unlocked", async (Guid userId, IAchievementService service) =>
{
    var achievements = await service.GetUnlockedAchievementsAsync(userId);
    return Results.Ok(achievements);
})
.WithName("GetUnlockedAchievements")
.WithOpenApi();

// Unlock achievement (internal endpoint)
achievementsGroup.MapPost("users/{userId}/unlock/{achievementId}", async (Guid userId, Guid achievementId, IAchievementService service) =>
{
    var result = await service.UnlockAchievementAsync(userId, achievementId);
    return Results.Ok(result);
})
.WithName("UnlockAchievement")
.WithOpenApi();

app.Run();
