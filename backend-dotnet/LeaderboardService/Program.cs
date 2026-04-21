using LeaderboardService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<ILeaderboardService, LeaderboardServiceImpl>();

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

var leaderboardGroup = app.MapGroup("/leaderboards").WithTags("Leaderboards");

leaderboardGroup.MapGet("global", async (ILeaderboardService service) =>
{
    var leaderboard = await service.GetGlobalLeaderboardAsync();
    return Results.Ok(leaderboard);
})
.WithName("GetGlobalLeaderboard")
.WithOpenApi();

leaderboardGroup.MapGet("friends", async (Guid userId, ILeaderboardService service) =>
{
    var leaderboard = await service.GetFriendsLeaderboardAsync(userId);
    return Results.Ok(leaderboard);
})
.RequireAuthorization()
.WithName("GetFriendsLeaderboard")
.WithOpenApi();

leaderboardGroup.MapGet("weekly", async (ILeaderboardService service) =>
{
    var leaderboard = await service.GetWeeklyLeaderboardAsync();
    return Results.Ok(leaderboard);
})
.WithName("GetWeeklyLeaderboard")
.WithOpenApi();

leaderboardGroup.MapGet("{type}/position/{userId}", async (string type, Guid userId, ILeaderboardService service) =>
{
    var position = await service.GetUserPositionAsync(userId, type);
    return position != null ? Results.Ok(position) : Results.NotFound();
})
.WithName("GetUserPosition")
.WithOpenApi();

app.Run();
