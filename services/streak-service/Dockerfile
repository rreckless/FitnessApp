# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["streak-service.csproj", "./"]
RUN dotnet restore "streak-service.csproj"

COPY . .
RUN dotnet build "streak-service.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "streak-service.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dotnet", "streak-service.dll"]
