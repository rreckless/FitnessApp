FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["GpsRouteService/GpsRouteService.csproj", "GpsRouteService/"]
RUN dotnet restore "GpsRouteService/GpsRouteService.csproj"
COPY . .
WORKDIR "/src/GpsRouteService"
RUN dotnet build "GpsRouteService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "GpsRouteService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "GpsRouteService.dll"]
