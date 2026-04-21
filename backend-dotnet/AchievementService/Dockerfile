FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["AchievementService/AchievementService.csproj", "AchievementService/"]
RUN dotnet restore "AchievementService/AchievementService.csproj"
COPY . .
WORKDIR "/src/AchievementService"
RUN dotnet build "AchievementService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "AchievementService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "AchievementService.dll"]
