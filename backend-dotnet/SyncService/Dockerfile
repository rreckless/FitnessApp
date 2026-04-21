FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["SyncService/SyncService.csproj", "SyncService/"]
COPY ["FitQuest.Shared/FitQuest.Shared.csproj", "FitQuest.Shared/"]
COPY ["FitQuest.EventBus/FitQuest.EventBus.csproj", "FitQuest.EventBus/"]

RUN dotnet restore "SyncService/SyncService.csproj"

COPY . .
WORKDIR "/src/SyncService"
RUN dotnet build "SyncService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SyncService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "SyncService.dll"]
