using Microsoft.EntityFrameworkCore;
using XpProgressionService.Data;
using XpProgressionService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IXpService, XpServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<XpDbContext>(options =>
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

var xpGroup = app.MapGroup("/xp").WithTags("XP & Progression").RequireAuthorization();

xpGroup.MapGet("users/{userId}", async (Guid userId, IXpService service) =>
{
    var userXP = await service.GetUserXPAsync(userId);
    return userXP != null ? Results.Ok(userXP) : Results.NotFound();
})
.WithName("GetUserXP")
.WithOpenApi();

xpGroup.MapGet("users/{userId}/muscle-groups", async (Guid userId, IXpService service) =>
{
    var ranks = await service.GetMuscleGroupRanksAsync(userId);
    return Results.Ok(ranks);
})
.WithName("GetMuscleGroupRanks")
.WithOpenApi();

xpGroup.MapPost("calculate", async (CalculateXPRequest request, IXpService service) =>
{
    var xp = await service.CalculateWorkoutXPAsync(request.TotalVolume, request.ExerciseTypes, request.CurrentStreak);
    return Results.Ok(new { xpEarned = xp });
})
.WithName("CalculateXP")
.WithOpenApi();

app.Run();

public record CalculateXPRequest(int TotalVolume, List<string> ExerciseTypes, int CurrentStreak);
