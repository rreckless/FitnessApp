FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["BodyTrackingService/BodyTrackingService.csproj", "BodyTrackingService/"]
RUN dotnet restore "BodyTrackingService/BodyTrackingService.csproj"
COPY . .
WORKDIR "/src/BodyTrackingService"
RUN dotnet build "BodyTrackingService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BodyTrackingService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "BodyTrackingService.dll"]
