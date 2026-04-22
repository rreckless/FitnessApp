#!/bin/bash

# Build script for FitQuest backend services
# Usage: ./build.sh [service-name]

set -e

SERVICE=${1:-authentication-service}

echo "Building $SERVICE..."

# Build with no cache and verbose output
docker build \
  --no-cache \
  --progress=plain \
  -f "${SERVICE}/Dockerfile" \
  -t "fitquest-${SERVICE}:latest" \
  .

echo "Build complete: fitquest-${SERVICE}:latest"
