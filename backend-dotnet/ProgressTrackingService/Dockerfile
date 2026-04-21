FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["ProgressTrackingService/ProgressTrackingService.csproj", "ProgressTrackingService/"]
RUN dotnet restore "ProgressTrackingService/ProgressTrackingService.csproj"
COPY . .
WORKDIR "/src/ProgressTrackingService"
RUN dotnet build "ProgressTrackingService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ProgressTrackingService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "ProgressTrackingService.dll"]
