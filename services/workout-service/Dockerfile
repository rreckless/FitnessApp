# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project file
COPY ["workout-service.csproj", "./"]

# Restore dependencies
RUN dotnet restore "workout-service.csproj"

# Copy source code
COPY . .

# Build application
RUN dotnet build "workout-service.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "workout-service.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=publish /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
ENTRYPOINT ["dotnet", "workout-service.dll"]
