using Microsoft.EntityFrameworkCore;
using ActivityFeedService.Data;
using ActivityFeedService.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IActivityFeedService, ActivityFeedServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ActivityFeedDbContext>(options =>
    options.UseNpgsql(connectionString));

var redisConnection = builder.Configuration.GetConnectionString("Redis");
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConnection!));

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

var feedGroup = app.MapGroup("/activity-feed").WithTags("Activity Feed").RequireAuthorization();

feedGroup.MapGet("", async (IActivityFeedService service, HttpContext context, int page = 1) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var feed = await service.GetActivityFeedAsync(userId, page);
    return Results.Ok(feed);
})
.WithName("GetActivityFeed")
.WithOpenApi();

app.Run();
