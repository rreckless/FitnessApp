using Microsoft.EntityFrameworkCore;
using BodyTrackingService.Data;
using BodyTrackingService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IBodyTrackingService, BodyTrackingServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<BodyTrackingDbContext>(options =>
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

var bodyGroup = app.MapGroup("/body").WithTags("Body Tracking").RequireAuthorization();

bodyGroup.MapPost("weight", async (LogWeightRequest request, IBodyTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.LogWeightAsync(userId, request.Weight, request.Notes);
    return Results.Created($"/body/weight/{result.Id}", result);
})
.WithName("LogWeight")
.WithOpenApi();

bodyGroup.MapGet("weight", async (IBodyTrackingService service, HttpContext context, DateTime? startDate, DateTime? endDate) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var history = await service.GetWeightHistoryAsync(userId, startDate, endDate);
    return Results.Ok(history);
})
.WithName("GetWeightHistory")
.WithOpenApi();

bodyGroup.MapPost("measurements", async (LogMeasurementsRequest request, IBodyTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.LogMeasurementsAsync(userId, request);
    return Results.Created($"/body/measurements/{result.Id}", result);
})
.WithName("LogMeasurements")
.WithOpenApi();

bodyGroup.MapGet("measurements", async (IBodyTrackingService service, HttpContext context, DateTime? startDate, DateTime? endDate) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var history = await service.GetMeasurementHistoryAsync(userId, startDate, endDate);
    return Results.Ok(history);
})
.WithName("GetMeasurementHistory")
.WithOpenApi();

bodyGroup.MapPost("photos", async (UploadPhotoRequest request, IBodyTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.UploadPhotoAsync(userId, request.ImageUrl, request.ThumbnailUrl, request.Notes);
    return Results.Created($"/body/photos/{result.Id}", result);
})
.WithName("UploadPhoto")
.WithOpenApi();

bodyGroup.MapGet("photos", async (IBodyTrackingService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var gallery = await service.GetPhotoGalleryAsync(userId);
    return Results.Ok(gallery);
})
.WithName("GetPhotoGallery")
.WithOpenApi();

bodyGroup.MapDelete("photos/{id}", async (Guid id, IBodyTrackingService service) =>
{
    await service.DeletePhotoAsync(id);
    return Results.NoContent();
})
.WithName("DeletePhoto")
.WithOpenApi();

app.Run();

public record LogWeightRequest(float Weight, string? Notes);
public record UploadPhotoRequest(string ImageUrl, string ThumbnailUrl, string? Notes);
