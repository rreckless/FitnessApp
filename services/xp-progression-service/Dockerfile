# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file
COPY ["xp-progression-service.csproj", "./"]

# Restore dependencies
RUN dotnet restore "xp-progression-service.csproj"

# Copy source code
COPY . .

# Build application
RUN dotnet build "xp-progression-service.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "xp-progression-service.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy published application
COPY --from=publish /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Run application
ENTRYPOINT ["dotnet", "xp-progression-service.dll"]
