using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using AuthenticationService.Data;
using AuthenticationService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddScoped<IAuthenticationService, AuthenticationServiceImpl>();
builder.Services.AddScoped<ITokenService, TokenService>();

// Add DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AuthDbContext>(options =>
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
var authGroup = app.MapGroup("/auth").WithTags("Authentication");

authGroup.MapPost("/register", async (RegisterRequest request, IAuthenticationService authService) =>
{
    var result = await authService.RegisterAsync(request.Email, request.Password, request.Name);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
})
.WithName("Register")
.WithOpenApi();

authGroup.MapPost("/login", async (LoginRequest request, IAuthenticationService authService) =>
{
    var result = await authService.LoginAsync(request.Email, request.Password);
    return result.Success ? Results.Ok(result) : Results.Unauthorized();
})
.WithName("Login")
.WithOpenApi();

authGroup.MapPost("/refresh", async (RefreshTokenRequest request, ITokenService tokenService) =>
{
    var result = await tokenService.RefreshTokenAsync(request.RefreshToken);
    return result.Success ? Results.Ok(result) : Results.Unauthorized();
})
.WithName("RefreshToken")
.WithOpenApi();

authGroup.MapPost("/logout", async (HttpContext context, IAuthenticationService authService) =>
{
    var token = context.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
    await authService.LogoutAsync(token);
    return Results.Ok();
})
.RequireAuthorization()
.WithName("Logout")
.WithOpenApi();

app.Run();

public record RegisterRequest(string Email, string Password, string Name);
public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
