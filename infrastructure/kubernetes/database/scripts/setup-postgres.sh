#!/bin/bash

# PostgreSQL Setup Script for FitQuest
# This script deploys PostgreSQL 14+ with replication to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deployment"

echo -e "${YELLOW}PostgreSQL Setup for FitQuest${NC}"
echo "================================"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo -e "${YELLOW}Warning: helm is not installed (optional)${NC}"
fi

# Check cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ kubectl is available${NC}"

# Check namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Creating namespace $NAMESPACE...${NC}"
    kubectl create namespace $NAMESPACE
    echo -e "${GREEN}✓ Namespace created${NC}"
else
    echo -e "${GREEN}✓ Namespace $NAMESPACE exists${NC}"
fi

# Check storage class
echo -e "${YELLOW}Checking storage class...${NC}"
if ! kubectl get storageclass standard &> /dev/null; then
    echo -e "${RED}Error: Storage class 'standard' not found${NC}"
    echo "Available storage classes:"
    kubectl get storageclass
    exit 1
fi
echo -e "${GREEN}✓ Storage class 'standard' available${NC}"

# Deploy RBAC
echo ""
echo -e "${YELLOW}Deploying RBAC...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-rbac.yaml"
echo -e "${GREEN}✓ RBAC deployed${NC}"

# Deploy ConfigMap
echo ""
echo -e "${YELLOW}Deploying ConfigMap...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-configmap.yaml"
echo -e "${GREEN}✓ ConfigMap deployed${NC}"

# Deploy Secret
echo ""
echo -e "${YELLOW}Deploying Secret...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-secret.yaml"
echo -e "${GREEN}✓ Secret deployed${NC}"

# Deploy NetworkPolicy
echo ""
echo -e "${YELLOW}Deploying NetworkPolicy...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-networkpolicy.yaml"
echo -e "${GREEN}✓ NetworkPolicy deployed${NC}"

# Deploy StatefulSet
echo ""
echo -e "${YELLOW}Deploying PostgreSQL StatefulSet...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-statefulset.yaml"
echo -e "${GREEN}✓ StatefulSet deployed${NC}"

# Wait for pods to be ready
echo ""
echo -e "${YELLOW}Waiting for PostgreSQL pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s || {
    echo -e "${RED}Error: PostgreSQL pods did not become ready${NC}"
    echo "Pod status:"
    kubectl get pods -n $NAMESPACE -l app=postgres
    exit 1
}
echo -e "${GREEN}✓ All PostgreSQL pods are ready${NC}"

# Deploy Backup CronJob
echo ""
echo -e "${YELLOW}Deploying Backup CronJob...${NC}"
kubectl apply -f "$DEPLOYMENT_DIR/postgres-backup-cronjob.yaml"
echo -e "${GREEN}✓ Backup CronJob deployed${NC}"

# Deploy ServiceMonitor
echo ""
echo -e "${YELLOW}Deploying ServiceMonitor...${NC}"
if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
    kubectl apply -f "$DEPLOYMENT_DIR/servicemonitor.yaml"
    echo -e "${GREEN}✓ ServiceMonitor deployed${NC}"
else
    echo -e "${YELLOW}⚠ Prometheus CRDs not found, skipping ServiceMonitor${NC}"
fi

# Verify deployment
echo ""
echo -e "${YELLOW}Verifying deployment...${NC}"
echo ""
echo "PostgreSQL Pods:"
kubectl get pods -n $NAMESPACE -l app=postgres -o wide

echo ""
echo "PostgreSQL Services:"
kubectl get svc -n $NAMESPACE -l app=postgres

echo ""
echo "PostgreSQL StatefulSet:"
kubectl get statefulset -n $NAMESPACE -l app=postgres

echo ""
echo -e "${GREEN}PostgreSQL deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify connectivity: ./verify-postgres.sh"
echo "2. Check replication status: kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c 'SELECT * FROM pg_stat_replication;'"
echo "3. View logs: kubectl logs -n fitquest postgres-0"
echo "4. Port forward: kubectl port-forward -n fitquest svc/postgres 5432:5432"
echo ""
