FROM mcr.microsoft.com/dotnet/sdk:8.0 as builder
WORKDIR /src

# Copy project files
COPY AuthenticationService/AuthenticationService.csproj AuthenticationService/
COPY FitQuest.Shared/FitQuest.Shared.csproj FitQuest.Shared/
COPY FitQuest.EventBus/FitQuest.EventBus.csproj FitQuest.EventBus/

# Restore
RUN dotnet restore AuthenticationService/AuthenticationService.csproj

# Copy source
COPY . .

# Build
WORKDIR /src/AuthenticationService
RUN dotnet build -c Release

# Publish
RUN dotnet publish -c Release -o /app/publish

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=builder /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "AuthenticationService.dll"]
