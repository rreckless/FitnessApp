using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Amazon.S3;
using UserProfileService.Data;
using UserProfileService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<IUserProfileService, UserProfileServiceImpl>();

// Add DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<UserProfileDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Redis
var redisConnection = builder.Configuration.GetConnectionString("Redis");
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnection;
});

// Add AWS S3
builder.Services.AddAWSService<IAmazonS3>();

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
var profileGroup = app.MapGroup("/users").WithTags("User Profile");

profileGroup.MapGet("/{id}", async (Guid id, IUserProfileService profileService) =>
{
    var profile = await profileService.GetProfileAsync(id);
    return profile != null ? Results.Ok(profile) : Results.NotFound();
})
.WithName("GetProfile")
.WithOpenApi();

profileGroup.MapPut("/{id}", async (Guid id, UpdateProfileRequest request, IUserProfileService profileService) =>
{
    try
    {
        var profile = await profileService.UpdateProfileAsync(id, request);
        return Results.Ok(profile);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
})
.RequireAuthorization()
.WithName("UpdateProfile")
.WithOpenApi();

profileGroup.MapGet("/{id}/preferences", async (Guid id, IUserProfileService profileService) =>
{
    var preferences = await profileService.GetPreferencesAsync(id);
    return preferences != null ? Results.Ok(preferences) : Results.NotFound();
})
.WithName("GetPreferences")
.WithOpenApi();

profileGroup.MapPut("/{id}/preferences", async (Guid id, UpdatePreferencesRequest request, IUserProfileService profileService) =>
{
    try
    {
        var preferences = await profileService.UpdatePreferencesAsync(id, request);
        return Results.Ok(preferences);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
})
.RequireAuthorization()
.WithName("UpdatePreferences")
.WithOpenApi();

profileGroup.MapPost("/{id}/avatar", async (Guid id, HttpRequest request, IUserProfileService profileService) =>
{
    try
    {
        if (request.Form.Files.Count == 0)
            return Results.BadRequest(new { error = "No file provided" });

        var file = request.Form.Files[0];
        using (var stream = file.OpenReadStream())
        {
            var url = await profileService.UploadAvatarAsync(id, stream, file.FileName);
            return Results.Ok(new { url });
        }
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.RequireAuthorization()
.WithName("UploadAvatar")
.WithOpenApi();

profileGroup.MapGet("/search", async (string query, IUserProfileService profileService) =>
{
    var results = await profileService.SearchUsersAsync(query);
    return Results.Ok(results);
})
.WithName("SearchUsers")
.WithOpenApi();

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();
