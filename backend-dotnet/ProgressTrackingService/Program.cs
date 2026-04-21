using Microsoft.EntityFrameworkCore;
using ProgressTrackingService.Data;
using ProgressTrackingService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IProgressTrackingService, ProgressTrackingServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ProgressDbContext>(options =>
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

var progressGroup = app.MapGroup("/progress").WithTags("Progress").RequireAuthorization();

progressGroup.MapGet("prs", async (IProgressTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var prs = await service.GetPRsAsync(userId);
    return Results.Ok(prs);
})
.WithName("GetPRs")
.WithOpenApi();

progressGroup.MapGet("volume", async (IProgressTrackingService service, HttpContext context, DateTime? startDate, DateTime? endDate) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
    var end = endDate ?? DateTime.UtcNow;
    var volume = await service.GetVolumeRangeAsync(userId, start, end);
    return Results.Ok(volume);
})
.WithName("GetVolume")
.WithOpenApi();

progressGroup.MapPost("prs", async (RecordPRRequest request, IProgressTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.RecordPRAsync(userId, request.ExerciseId, request.Weight, request.Reps);
    return Results.Ok(result);
})
.WithName("RecordPR")
.WithOpenApi();

app.Run();

public record RecordPRRequest(Guid ExerciseId, int Weight, int Reps);
