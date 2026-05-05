# Multi-stage build for optimization
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project file
COPY ["AuthenticationService.csproj", "./"]

# Restore dependencies
RUN dotnet restore "AuthenticationService.csproj"

# Copy source code
COPY . .

# Build the application
RUN dotnet build "AuthenticationService.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "AuthenticationService.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published application
COPY --from=publish /app/publish .

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Run the application
ENTRYPOINT ["dotnet", "AuthenticationService.dll"]
