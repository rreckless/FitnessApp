FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["SocialService/SocialService.csproj", "SocialService/"]
RUN dotnet restore "SocialService/SocialService.csproj"
COPY . .
WORKDIR "/src/SocialService"
RUN dotnet build "SocialService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SocialService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "SocialService.dll"]
