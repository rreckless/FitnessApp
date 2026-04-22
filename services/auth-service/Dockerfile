FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["services/auth-service/auth-service.csproj", "services/auth-service/"]
RUN dotnet restore "services/auth-service/auth-service.csproj"
COPY . .
WORKDIR "/src/services/auth-service"
RUN dotnet build "auth-service.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "auth-service.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=publish /app/publish .
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1
EXPOSE 5000
ENTRYPOINT ["dotnet", "auth-service.dll"]
