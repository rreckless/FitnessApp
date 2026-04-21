using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ExerciseLibraryService.Data;
using ExerciseLibraryService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<IExerciseLibraryService, ExerciseLibraryServiceImpl>();

// Add DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ExerciseDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Redis
var redisConnection = builder.Configuration.GetConnectionString("Redis");
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnection;
});

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
var exerciseGroup = app.MapGroup("/exercises").WithTags("Exercise Library");

exerciseGroup.MapGet("/", async (string? query, string? muscleGroup, IExerciseLibraryService service) =>
{
    var exercises = await service.SearchExercisesAsync(query, muscleGroup);
    return Results.Ok(exercises);
})
.WithName("SearchExercises")
.WithOpenApi();

exerciseGroup.MapGet("/{id}", async (Guid id, IExerciseLibraryService service) =>
{
    var exercise = await service.GetExerciseAsync(id);
    return exercise != null ? Results.Ok(exercise) : Results.NotFound();
})
.WithName("GetExercise")
.WithOpenApi();

exerciseGroup.MapGet("/muscle-groups/{group}", async (string group, IExerciseLibraryService service) =>
{
    var exercises = await service.GetExercisesByMuscleGroupAsync(group);
    return Results.Ok(exercises);
})
.WithName("GetExercisesByMuscleGroup")
.WithOpenApi();

exerciseGroup.MapPost("/", async (Guid userId, CreateExerciseRequest request, IExerciseLibraryService service) =>
{
    try
    {
        var exercise = await service.CreateCustomExerciseAsync(userId, request);
        return Results.Created($"/exercises/{exercise.Id}", exercise);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.RequireAuthorization()
.WithName("CreateCustomExercise")
.WithOpenApi();

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();
