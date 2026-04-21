#!/bin/bash
# Cleanup script for API Gateway
# Removes all API Gateway resources from the cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="ingress"

echo -e "${YELLOW}FitQuest API Gateway Cleanup${NC}"
echo "======================================"
echo ""
echo -e "${RED}WARNING: This will delete all API Gateway resources!${NC}"
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Delete Ingress resources
echo -e "${YELLOW}Deleting Ingress resources...${NC}"
kubectl delete ingress -n $NAMESPACE --all --ignore-not-found=true

# Delete Services
echo -e "${YELLOW}Deleting Services...${NC}"
kubectl delete svc -n $NAMESPACE --all --ignore-not-found=true

# Delete Deployment
echo -e "${YELLOW}Deleting Deployment...${NC}"
kubectl delete deployment -n $NAMESPACE --all --ignore-not-found=true

# Delete ConfigMaps
echo -e "${YELLOW}Deleting ConfigMaps...${NC}"
kubectl delete configmap -n $NAMESPACE --all --ignore-not-found=true

# Delete Secrets
echo -e "${YELLOW}Deleting Secrets...${NC}"
kubectl delete secret -n $NAMESPACE --all --ignore-not-found=true

# Delete RBAC
echo -e "${YELLOW}Deleting RBAC...${NC}"
kubectl delete clusterrole nginx-ingress-controller --ignore-not-found=true
kubectl delete clusterrolebinding nginx-ingress-controller --ignore-not-found=true
kubectl delete role -n $NAMESPACE --all --ignore-not-found=true
kubectl delete rolebinding -n $NAMESPACE --all --ignore-not-found=true
kubectl delete serviceaccount -n $NAMESPACE --all --ignore-not-found=true

# Delete NetworkPolicy
echo -e "${YELLOW}Deleting NetworkPolicy...${NC}"
kubectl delete networkpolicy -n $NAMESPACE --all --ignore-not-found=true

# Delete PDB and HPA
echo -e "${YELLOW}Deleting PDB and HPA...${NC}"
kubectl delete pdb -n $NAMESPACE --all --ignore-not-found=true
kubectl delete hpa -n $NAMESPACE --all --ignore-not-found=true

# Delete namespace
echo -e "${YELLOW}Deleting namespace...${NC}"
kubectl delete namespace $NAMESPACE --ignore-not-found=true

echo -e "${GREEN}Cleanup complete!${NC}"
