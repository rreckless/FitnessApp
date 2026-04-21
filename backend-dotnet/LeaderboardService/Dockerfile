FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["LeaderboardService/LeaderboardService.csproj", "LeaderboardService/"]
COPY ["FitQuest.Shared/FitQuest.Shared.csproj", "FitQuest.Shared/"]
COPY ["FitQuest.EventBus/FitQuest.EventBus.csproj", "FitQuest.EventBus/"]

RUN dotnet restore "LeaderboardService/LeaderboardService.csproj"

COPY . .
WORKDIR "/src/LeaderboardService"
RUN dotnet build "LeaderboardService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "LeaderboardService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "LeaderboardService.dll"]
