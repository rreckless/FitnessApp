FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["ChallengeService/ChallengeService.csproj", "ChallengeService/"]
RUN dotnet restore "ChallengeService/ChallengeService.csproj"
COPY . .
WORKDIR "/src/ChallengeService"
RUN dotnet build "ChallengeService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ChallengeService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "ChallengeService.dll"]
