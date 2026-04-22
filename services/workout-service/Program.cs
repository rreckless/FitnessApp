using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using Serilog;
using WorkoutService.Data;
using WorkoutService.Services;

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
builder.Services.AddDbContext<WorkoutDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add RabbitMQ
var rabbitMQConnectionString = builder.Configuration.GetConnectionString("RabbitMQ")
    ?? throw new InvalidOperationException("Connection string 'RabbitMQ' not found.");
var factory = new ConnectionFactory() { Uri = new Uri(rabbitMQConnectionString) };
builder.Services.AddSingleton<IConnection>(factory.CreateConnection());

// Add application services
builder.Services.AddScoped<IVolumeCalculationService, VolumeCalculationService>();
builder.Services.AddScoped<IXPCalculationService, XPCalculationService>();
builder.Services.AddScoped<IRabbitMQPublisher, RabbitMQPublisher>();
builder.Services.AddScoped<IWorkoutService, WorkoutServiceImpl>();

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
    var db = scope.ServiceProvider.GetRequiredService<WorkoutDbContext>();
    db.Database.Migrate();
}

app.Run();
