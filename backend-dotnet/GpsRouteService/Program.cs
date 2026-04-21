using Microsoft.EntityFrameworkCore;
using GpsRouteService.Data;
using GpsRouteService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IGpsRouteService, GpsRouteServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<GpsDbContext>(options =>
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

var routesGroup = app.MapGroup("/routes").WithTags("Routes").RequireAuthorization();
var gpsGroup = app.MapGroup("/gps").WithTags("GPS");

routesGroup.MapPost("", async (CreateRouteRequest request, IGpsRouteService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.CreateRouteAsync(userId, request);
    return Results.Created($"/routes/{result.Id}", result);
})
.WithName("CreateRoute")
.WithOpenApi();

routesGroup.MapGet("", async (IGpsRouteService service, int page = 1) =>
{
    var routes = await service.GetRoutesAsync(page);
    return Results.Ok(routes);
})
.WithName("GetRoutes")
.WithOpenApi();

routesGroup.MapGet("{id}", async (Guid id, IGpsRouteService service) =>
{
    var route = await service.GetRouteAsync(id);
    return route != null ? Results.Ok(route) : Results.NotFound();
})
.WithName("GetRoute")
.WithOpenApi();

routesGroup.MapPost("{id}/rate", async (Guid id, RateRouteRequest request, IGpsRouteService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.RateRouteAsync(id, userId, request.Rating, request.Review);
    return Results.Ok(result);
})
.WithName("RateRoute")
.WithOpenApi();

gpsGroup.MapGet("workout/{workoutId}", async (Guid workoutId, IGpsRouteService service) =>
{
    var points = await service.GetGpsDataAsync(workoutId);
    return Results.Ok(points);
})
.WithName("GetGpsData")
.WithOpenApi();

app.Run();

public record CreateRouteRequest(
    string Name,
    string Description,
    double Distance,
    int EstimatedTime,
    GpsRouteService.Models.RouteDifficulty Difficulty
);

public record RateRouteRequest(int Rating, string? Review);
