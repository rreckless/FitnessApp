#!/bin/bash

# Run FitQuest backend services locally (no Docker)
# This is much simpler and avoids Docker build issues

set -e

echo "Starting FitQuest Backend Services (Local)"
echo "=========================================="
echo ""

# Check if .NET 8 is installed
if ! command -v dotnet &> /dev/null; then
    echo "❌ .NET 8 SDK not found. Please install it from https://dotnet.microsoft.com/download/dotnet/8.0"
    exit 1
fi

DOTNET_VERSION=$(dotnet --version)
echo "✓ .NET SDK: $DOTNET_VERSION"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Install with: brew install postgresql"
    echo "   Then start with: brew services start postgresql"
    exit 1
fi

echo "✓ PostgreSQL installed"

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis not found. Install with: brew install redis"
    echo "   Then start with: brew services start redis"
    exit 1
fi

echo "✓ Redis installed"
echo ""

# Create databases if they don't exist
echo "Setting up databases..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'fitquest_auth'" | grep -q 1 || psql -U postgres -c "CREATE DATABASE fitquest_auth"
echo "✓ Database fitquest_auth ready"

# Start the Authentication Service
echo ""
echo "Starting Authentication Service on http://localhost:5001"
echo "Press Ctrl+C to stop"
echo ""

cd AuthenticationService
dotnet run --configuration Release
