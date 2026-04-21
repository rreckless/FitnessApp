#!/bin/bash
# Setup script for FitQuest API Gateway
# Deploys Nginx Ingress Controller with rate limiting and authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="ingress"
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${YELLOW}FitQuest API Gateway Setup${NC}"
echo "======================================"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl not found. Please install kubectl.${NC}"
    exit 1
fi

if ! command -v openssl &> /dev/null; then
    echo -e "${RED}openssl not found. Please install openssl.${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Label namespace for network policies
kubectl label namespace $NAMESPACE name=$NAMESPACE --overwrite

# Deploy RBAC
echo -e "${YELLOW}Deploying RBAC...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/deployment/nginx-rbac.yaml"

# Deploy ConfigMaps
echo -e "${YELLOW}Deploying ConfigMaps...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/deployment/nginx-configmap.yaml"

# Deploy Service
echo -e "${YELLOW}Deploying Service...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/deployment/nginx-service.yaml"

# Deploy Nginx Ingress Controller
echo -e "${YELLOW}Deploying Nginx Ingress Controller...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/deployment/nginx-ingress-controller.yaml"

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for Nginx Ingress Controller to be ready...${NC}"
kubectl rollout status deployment/nginx-ingress-controller -n $NAMESPACE --timeout=5m

# Get LoadBalancer IP/hostname
echo -e "${YELLOW}Getting LoadBalancer endpoint...${NC}"
EXTERNAL_IP=$(kubectl get svc nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
EXTERNAL_HOSTNAME=$(kubectl get svc nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")

if [ -z "$EXTERNAL_IP" ] && [ -z "$EXTERNAL_HOSTNAME" ]; then
    echo -e "${YELLOW}LoadBalancer IP/hostname not yet assigned. This may take a few minutes...${NC}"
    echo -e "${YELLOW}Run: kubectl get svc -n $NAMESPACE to check status${NC}"
else
    if [ -n "$EXTERNAL_IP" ]; then
        echo -e "${GREEN}API Gateway accessible at: http://$EXTERNAL_IP${NC}"
    fi
    if [ -n "$EXTERNAL_HOSTNAME" ]; then
        echo -e "${GREEN}API Gateway accessible at: http://$EXTERNAL_HOSTNAME${NC}"
    fi
fi

echo -e "${GREEN}API Gateway setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Generate TLS certificates: ./scripts/generate-certificates.sh"
echo "2. Deploy Ingress resource: kubectl apply -f ingress/fitquest-ingress.yaml"
echo "3. Verify deployment: ./scripts/verify-api-gateway.sh"
