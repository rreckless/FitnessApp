FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["PremiumSubscriptionService/PremiumSubscriptionService.csproj", "PremiumSubscriptionService/"]
RUN dotnet restore "PremiumSubscriptionService/PremiumSubscriptionService.csproj"
COPY . .
WORKDIR "/src/PremiumSubscriptionService"
RUN dotnet build "PremiumSubscriptionService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PremiumSubscriptionService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "PremiumSubscriptionService.dll"]
