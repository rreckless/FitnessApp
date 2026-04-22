using Microsoft.EntityFrameworkCore;
using Serilog;
using StackExchange.Redis;
using UserProfileService.Data;
using UserProfileService.Services;
using Amazon.S3;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<UserProfileDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Redis
var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
    ?? throw new InvalidOperationException("Connection string 'Redis' not found.");
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConnectionString));

// Add AWS S3
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var config = new Amazon.S3.AmazonS3Config
    {
        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(
            builder.Configuration["AWS:Region"] ?? "us-east-1")
    };
    return new AmazonS3Client(config);
});

// Add application services
builder.Services.AddScoped<IUserProfileService, UserProfileService.Services.UserProfileService>();
builder.Services.AddScoped<IS3Service, S3Service>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");

app.UseAuthorization();
app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi();

// Run migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UserProfileDbContext>();
    db.Database.Migrate();
}

app.Run();
