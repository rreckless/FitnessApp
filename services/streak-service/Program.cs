using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using StreakService.Data;
using StreakService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<StreakDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add RabbitMQ
var rabbitMQConnectionString = builder.Configuration.GetConnectionString("RabbitMQ")
    ?? throw new InvalidOperationException("Connection string 'RabbitMQ' not found.");
var factory = new ConnectionFactory() { Uri = new Uri(rabbitMQConnectionString) };
builder.Services.AddSingleton<IConnection>(factory.CreateConnection());

// Add application services
builder.Services.AddScoped<IStreakService, StreakServiceImpl>();
builder.Services.AddScoped<IRabbitMQPublisher, RabbitMQPublisher>();

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
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// Run migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StreakDbContext>();
    db.Database.Migrate();
}

app.Run();
