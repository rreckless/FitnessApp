#!/bin/bash

# FitQuest Docker Hub Registry Setup Script
# This script configures Docker Hub registry access for FitQuest microservices

set -e

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
DOCKER_PASSWORD="${DOCKER_PASSWORD:-}"
REGISTRY_URL="${REGISTRY_URL:-docker.io}"
NAMESPACE="${NAMESPACE:-fitquest}"

echo "=========================================="
echo "FitQuest Docker Hub Registry Setup"
echo "=========================================="
echo "Registry URL: $REGISTRY_URL"
echo "Namespace: $NAMESPACE"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }

# Get Docker credentials
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
  echo "Docker Hub credentials not provided."
  echo "Please enter your Docker Hub credentials:"
  read -p "Docker Hub Username: " DOCKER_USERNAME
  read -sp "Docker Hub Password: " DOCKER_PASSWORD
  echo ""
fi

# Login to Docker Hub
echo ""
echo "Logging in to Docker Hub..."
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Create Kubernetes secret for Docker Hub
echo ""
echo "Creating Kubernetes secret for Docker Hub..."
kubectl create secret docker-registry docker-hub-secret \
  --docker-server=$REGISTRY_URL \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email="$(git config user.email || echo 'noreply@fitquest.com')" \
  -n fitquest \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Kubernetes secret in monitoring namespace
kubectl create secret docker-registry docker-hub-secret \
  --docker-server=$REGISTRY_URL \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email="$(git config user.email || echo 'noreply@fitquest.com')" \
  -n monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Kubernetes secret in ingress namespace
kubectl create secret docker-registry docker-hub-secret \
  --docker-server=$REGISTRY_URL \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email="$(git config user.email || echo 'noreply@fitquest.com')" \
  -n ingress \
  --dry-run=client -o yaml | kubectl apply -f -

# Create .dockerconfigjson for local builds
echo ""
echo "Creating Docker config for local builds..."
mkdir -p ~/.docker
docker logout

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Create GitHub Actions secret file (for CI/CD)
echo ""
echo "Creating GitHub Actions secret file..."
cat > .github/workflows/docker-hub-secret.txt <<EOF
DOCKER_USERNAME=$DOCKER_USERNAME
DOCKER_PASSWORD=$DOCKER_PASSWORD
DOCKER_REGISTRY=$REGISTRY_URL
DOCKER_NAMESPACE=$NAMESPACE
EOF

echo "⚠️  GitHub Actions secret file created at .github/workflows/docker-hub-secret.txt"
echo "    Add these as GitHub repository secrets:"
echo "    - DOCKER_USERNAME"
echo "    - DOCKER_PASSWORD"
echo "    - DOCKER_REGISTRY"
echo "    - DOCKER_NAMESPACE"

# Create sample Dockerfile
echo ""
echo "Creating sample Dockerfile..."
mkdir -p docker-samples
cat > docker-samples/Dockerfile.sample <<'EOF'
# Multi-stage build for .NET 10 microservice
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS builder
WORKDIR /src

# Copy project files
COPY ["AuthenticationService/AuthenticationService.csproj", "AuthenticationService/"]
RUN dotnet restore "AuthenticationService/AuthenticationService.csproj"

# Copy source code
COPY . .
RUN dotnet build "AuthenticationService/AuthenticationService.csproj" -c Release -o /app/build

# Publish
FROM builder AS publish
RUN dotnet publish "AuthenticationService/AuthenticationService.csproj" -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
ENTRYPOINT ["dotnet", "AuthenticationService.dll"]
EOF

echo "Sample Dockerfile created at docker-samples/Dockerfile.sample"

# Create build script
echo ""
echo "Creating build script..."
cat > scripts/build-and-push-docker.sh <<'EOF'
#!/bin/bash

# Build and push Docker images to Docker Hub

set -e

DOCKER_USERNAME="${DOCKER_USERNAME:-}"
DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-fitquest}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -z "$DOCKER_USERNAME" ]; then
  echo "DOCKER_USERNAME not set"
  exit 1
fi

SERVICES=(
  "authentication-service"
  "user-profile-service"
  "workout-service"
  "xp-progression-service"
  "leaderboard-service"
  "social-service"
  "achievement-service"
  "activity-feed-service"
  "challenge-service"
  "progress-tracking-service"
  "body-tracking-service"
  "gps-route-service"
  "premium-subscription-service"
  "ai-trainer-service"
  "sync-service"
)

for service in "${SERVICES[@]}"; do
  echo "Building $service..."
  docker build -f "backend-dotnet/${service^}/Dockerfile" -t "$DOCKER_REGISTRY/$DOCKER_USERNAME/$DOCKER_NAMESPACE/$service:$IMAGE_TAG" .
  
  echo "Pushing $service..."
  docker push "$DOCKER_REGISTRY/$DOCKER_USERNAME/$DOCKER_NAMESPACE/$service:$IMAGE_TAG"
done

echo "All images built and pushed successfully!"
EOF

chmod +x scripts/build-and-push-docker.sh

echo ""
echo "=========================================="
echo "Docker Hub Registry Setup Complete!"
echo "=========================================="
echo ""
echo "Registry Details:"
echo "  Registry URL: $REGISTRY_URL"
echo "  Namespace: $NAMESPACE"
echo "  Username: $DOCKER_USERNAME"
echo ""
echo "Kubernetes secrets created in:"
echo "  - fitquest namespace"
echo "  - monitoring namespace"
echo "  - ingress namespace"
echo ""
echo "Next steps:"
echo "  1. Build Docker images: ./scripts/build-and-push-docker.sh"
echo "  2. Push images: docker push $REGISTRY_URL/$DOCKER_USERNAME/$NAMESPACE/<service-name>:latest"
echo "  3. Update Kubernetes deployments with image URLs"
echo ""
