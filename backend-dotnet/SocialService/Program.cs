using Microsoft.EntityFrameworkCore;
using SocialService.Data;
using SocialService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<ISocialService, SocialServiceImpl>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<SocialDbContext>(options =>
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

var friendsGroup = app.MapGroup("/friends").WithTags("Friends").RequireAuthorization();
var usersGroup = app.MapGroup("/users").WithTags("Users");

// Send friend request
friendsGroup.MapPost("request", async (SendFriendRequestDto request, ISocialService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var result = await service.SendFriendRequestAsync(userId, request.ReceiverId);
    return Results.Created($"/friends/request/{result.Id}", result);
})
.WithName("SendFriendRequest")
.WithOpenApi();

// Accept friend request
friendsGroup.MapPost("request/{id}/accept", async (Guid id, ISocialService service) =>
{
    var result = await service.AcceptFriendRequestAsync(id);
    return Results.Ok(result);
})
.WithName("AcceptFriendRequest")
.WithOpenApi();

// Decline friend request
friendsGroup.MapPost("request/{id}/decline", async (Guid id, ISocialService service) =>
{
    await service.DeclineFriendRequestAsync(id);
    return Results.NoContent();
})
.WithName("DeclineFriendRequest")
.WithOpenApi();

// Remove friend
friendsGroup.MapDelete("{id}", async (Guid id, ISocialService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    await service.RemoveFriendAsync(userId, id);
    return Results.NoContent();
})
.WithName("RemoveFriend")
.WithOpenApi();

// Get friends list
friendsGroup.MapGet("", async (ISocialService service, HttpContext context) =>
{
    var userId = Guid.Parse(context.User.FindFirst("sub")?.Value ?? "");
    var friends = await service.GetFriendsAsync(userId);
    return Results.Ok(friends);
})
.WithName("GetFriends")
.WithOpenApi();

// Search users
usersGroup.MapGet("search", async (string query, ISocialService service) =>
{
    if (string.IsNullOrWhiteSpace(query))
        return Results.BadRequest("Query cannot be empty");

    var results = await service.SearchUsersAsync(query);
    return Results.Ok(results);
})
.WithName("SearchUsers")
.WithOpenApi();

app.Run();

public record SendFriendRequestDto(Guid ReceiverId);
