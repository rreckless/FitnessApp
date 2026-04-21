using Microsoft.EntityFrameworkCore;
using WorkoutService.Data;
using WorkoutService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IWorkoutService, WorkoutServiceImpl>();
builder.Services.AddScoped<IExerciseService, ExerciseServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<WorkoutDbContext>(options =>
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

var workoutGroup = app.MapGroup("/workouts").WithTags("Workouts").RequireAuthorization();

workoutGroup.MapPost("", async (CreateWorkoutRequest request, IWorkoutService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.CreateWorkoutAsync(userId, request);
    return Results.Created($"/workouts/{result.Id}", result);
})
.WithName("CreateWorkout")
.WithOpenApi();

workoutGroup.MapGet("", async (IWorkoutService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var workouts = await service.GetUserWorkoutsAsync(userId);
    return Results.Ok(workouts);
})
.WithName("GetWorkouts")
.WithOpenApi();

workoutGroup.MapGet("{id}", async (Guid id, IWorkoutService service) =>
{
    var workout = await service.GetWorkoutAsync(id);
    return workout != null ? Results.Ok(workout) : Results.NotFound();
})
.WithName("GetWorkout")
.WithOpenApi();

workoutGroup.MapPut("{id}", async (Guid id, UpdateWorkoutRequest request, IWorkoutService service) =>
{
    var result = await service.UpdateWorkoutAsync(id, request);
    return result != null ? Results.Ok(result) : Results.NotFound();
})
.WithName("UpdateWorkout")
.WithOpenApi();

workoutGroup.MapDelete("{id}", async (Guid id, IWorkoutService service) =>
{
    await service.DeleteWorkoutAsync(id);
    return Results.NoContent();
})
.WithName("DeleteWorkout")
.WithOpenApi();

workoutGroup.MapPost("{id}/complete", async (Guid id, IWorkoutService service) =>
{
    var result = await service.CompleteWorkoutAsync(id);
    return result ? Results.Ok() : Results.NotFound();
})
.WithName("CompleteWorkout")
.WithOpenApi();

app.Run();

public record CreateWorkoutRequest(DateTime StartTime, List<ExerciseEntry> Exercises);
public record UpdateWorkoutRequest(DateTime StartTime, List<ExerciseEntry> Exercises);
public record ExerciseEntry(Guid ExerciseId, List<SetEntry> Sets);
public record SetEntry(int Reps, int Weight, int? RPE);
