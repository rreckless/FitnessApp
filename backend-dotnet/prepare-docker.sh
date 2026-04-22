#!/bin/bash
set -e

echo "Preparing Docker build..."
echo "This script restores NuGet packages locally to avoid network issues in Docker"

# Restore packages for each project
echo "Restoring AuthenticationService packages..."
cd AuthenticationService
dotnet restore --no-cache
cd ..

echo "Restoring FitQuest.Shared packages..."
cd FitQuest.Shared
dotnet restore --no-cache
cd ..

echo "Restoring FitQuest.EventBus packages..."
cd FitQuest.EventBus
dotnet restore --no-cache
cd ..

echo ""
echo "✓ Packages restored successfully"
echo "Now you can run: docker-compose up --build"
