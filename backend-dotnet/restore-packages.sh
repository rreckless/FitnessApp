#!/bin/bash

# Restore NuGet packages locally before Docker build
# This ensures packages are cached and available for Docker

echo "Restoring NuGet packages locally..."

cd AuthenticationService
dotnet restore AuthenticationService.csproj
cd ..

echo "Packages restored. You can now run: docker-compose up --build"
