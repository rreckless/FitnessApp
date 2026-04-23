using AuthenticationService.Data;
using AuthenticationService.DTOs;
using AuthenticationService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<IPasswordValidator, PasswordValidator>();
builder.Services.AddScoped<IAuthenticationService, AuthenticationServiceImpl>();

// Add database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=fitquest_auth;Username=postgres;Password=postgres";
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Redis
var redisConnection = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConnection));

// Add JWT authentication
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"] ?? "your-secret-key-change-in-production";
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "fitquest",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "fitquest-app",
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

// Add OpenAPI/Swagger
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Apply migrations
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    dbContext.Database.Migrate();
}

app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();
}

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .Produces(StatusCodes.Status200OK);

// Authentication endpoints
var authGroup = app.MapGroup("/auth")
    .WithTags("Authentication");

authGroup.MapPost("/register", RegisterAsync)
    .WithName("Register")
    .Produces<AuthResponse>(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

authGroup.MapPost("/login", LoginAsync)
    .WithName("Login")
    .Produces<AuthResponse>(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

authGroup.MapPost("/refresh", RefreshTokenAsync)
    .WithName("RefreshToken")
    .Produces<AuthResponse>(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

authGroup.MapPost("/logout", LogoutAsync)
    .WithName("Logout")
    .RequireAuthorization()
    .Produces(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);

authGroup.MapPost("/password-reset", RequestPasswordResetAsync)
    .WithName("RequestPasswordReset")
    .Produces(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

authGroup.MapPost("/password-reset/confirm", ConfirmPasswordResetAsync)
    .WithName("ConfirmPasswordReset")
    .Produces(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

authGroup.MapPost("/validate-password", ValidatePasswordAsync)
    .WithName("ValidatePassword")
    .Produces<PasswordValidationResponse>(StatusCodes.Status200OK);

app.Run();

// Endpoint handlers
async Task<IResult> RegisterAsync(RegisterRequest request, IAuthenticationService authService)
{
    var (success, response, error) = await authService.RegisterAsync(request);
    if (success)
    {
        return Results.Ok(response);
    }
    return Results.BadRequest(new ErrorResponse { Message = error ?? "Registration failed" });
}

async Task<IResult> LoginAsync(LoginRequest request, IAuthenticationService authService)
{
    var (success, response, error) = await authService.LoginAsync(request);
    if (success)
    {
        return Results.Ok(response);
    }
    return Results.Unauthorized();
}

async Task<IResult> RefreshTokenAsync(RefreshTokenRequest request, IAuthenticationService authService)
{
    var (success, response, error) = await authService.RefreshTokenAsync(request);
    if (success)
    {
        return Results.Ok(response);
    }
    return Results.Unauthorized();
}

async Task<IResult> LogoutAsync(HttpContext context, IAuthenticationService authService)
{
    var authHeader = context.Request.Headers["Authorization"].ToString();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
    {
        return Results.Unauthorized();
    }

    var token = authHeader.Substring("Bearer ".Length);
    var success = await authService.LogoutAsync(token);
    if (success)
    {
        return Results.Ok();
    }
    return Results.Unauthorized();
}

async Task<IResult> RequestPasswordResetAsync(PasswordResetRequest request, IAuthenticationService authService)
{
    var (success, error) = await authService.RequestPasswordResetAsync(request.Email);
    if (success)
    {
        return Results.Ok();
    }
    return Results.BadRequest(new ErrorResponse { Message = error ?? "Password reset request failed" });
}

async Task<IResult> ConfirmPasswordResetAsync(PasswordResetConfirmRequest request, IAuthenticationService authService)
{
    var (success, error) = await authService.ConfirmPasswordResetAsync(request);
    if (success)
    {
        return Results.Ok();
    }
    return Results.BadRequest(new ErrorResponse { Message = error ?? "Password reset confirmation failed" });
}

IResult ValidatePasswordAsync(ValidatePasswordRequest request, IPasswordValidator validator)
{
    var (isValid, errors) = validator.ValidatePassword(request.Password);
    return Results.Ok(new PasswordValidationResponse { IsValid = isValid, Errors = errors });
}
