FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["ActivityFeedService/ActivityFeedService.csproj", "ActivityFeedService/"]
RUN dotnet restore "ActivityFeedService/ActivityFeedService.csproj"
COPY . .
WORKDIR "/src/ActivityFeedService"
RUN dotnet build "ActivityFeedService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ActivityFeedService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "ActivityFeedService.dll"]
