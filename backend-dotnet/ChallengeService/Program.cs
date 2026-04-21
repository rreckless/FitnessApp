using Microsoft.EntityFrameworkCore;
using ChallengeService.Data;
using ChallengeService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IChallengeService, ChallengeServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ChallengeDbContext>(options =>
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

var challengesGroup = app.MapGroup("/challenges").WithTags("Challenges").RequireAuthorization();

challengesGroup.MapPost("", async (CreateChallengeRequest request, IChallengeService service, HttpContext context) =>
{
    var creatorId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.CreateChallengeAsync(creatorId, request);
    return Results.Created($"/challenges/{result.Id}", result);
})
.WithName("CreateChallenge")
.WithOpenApi();

challengesGroup.MapGet("", async (IChallengeService service, int page = 1) =>
{
    var challenges = await service.GetChallengesAsync(page);
    return Results.Ok(challenges);
})
.WithName("GetChallenges")
.WithOpenApi();

challengesGroup.MapGet("{id}", async (Guid id, IChallengeService service) =>
{
    var challenge = await service.GetChallengeAsync(id);
    return challenge != null ? Results.Ok(challenge) : Results.NotFound();
})
.WithName("GetChallenge")
.WithOpenApi();

challengesGroup.MapPost("{id}/join", async (Guid id, IChallengeService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.JoinChallengeAsync(id, userId);
    return Results.Ok(result);
})
.WithName("JoinChallenge")
.WithOpenApi();

challengesGroup.MapGet("{id}/progress", async (Guid id, IChallengeService service) =>
{
    var progress = await service.GetChallengeProgressAsync(id);
    return Results.Ok(progress);
})
.WithName("GetChallengeProgress")
.WithOpenApi();

app.Run();

public record CreateChallengeRequest(
    string Name,
    string Description,
    ChallengeService.Models.ChallengeType Type,
    ChallengeService.Models.ChallengeGoalType GoalType,
    int TargetValue,
    int Duration
);
