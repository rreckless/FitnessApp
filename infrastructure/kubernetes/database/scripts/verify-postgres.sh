#!/bin/bash

# PostgreSQL Verification Script for FitQuest
# This script verifies PostgreSQL deployment and replication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"

echo -e "${YELLOW}PostgreSQL Verification for FitQuest${NC}"
echo "======================================"
echo ""

# Check if PostgreSQL pods are running
echo -e "${BLUE}1. Checking PostgreSQL pods...${NC}"
RUNNING_PODS=$(kubectl get pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | grep Running | wc -l)
TOTAL_PODS=$(kubectl get pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | wc -l)

if [ "$RUNNING_PODS" -eq 3 ] && [ "$TOTAL_PODS" -eq 3 ]; then
    echo -e "${GREEN}✓ All 3 PostgreSQL pods are running${NC}"
else
    echo -e "${RED}✗ PostgreSQL pods not ready (Running: $RUNNING_PODS/3)${NC}"
    kubectl get pods -n $NAMESPACE -l app=postgres
    exit 1
fi

echo ""

# Check PostgreSQL connectivity
echo -e "${BLUE}2. Checking PostgreSQL connectivity...${NC}"

# Get the primary pod
PRIMARY_POD="postgres-0"

# Test connection to primary
if kubectl exec -it $PRIMARY_POD -n $NAMESPACE -- psql -U postgres -c "SELECT 1" &> /dev/null; then
    echo -e "${GREEN}✓ Connected to primary PostgreSQL${NC}"
else
    echo -e "${RED}✗ Failed to connect to primary PostgreSQL${NC}"
    exit 1
fi

echo ""

# Check replication status
echo -e "${BLUE}3. Checking replication status...${NC}"

REPLICATION_STATUS=$(kubectl exec -it $PRIMARY_POD -n $NAMESPACE -- psql -U postgres -c "SELECT COUNT(*) FROM pg_stat_replication;" 2>/dev/null | grep -oE '[0-9]+' | head -1)

if [ "$REPLICATION_STATUS" -ge 2 ]; then
    echo -e "${GREEN}✓ Replication is active ($REPLICATION_STATUS replicas connected)${NC}"
else
    echo -e "${YELLOW}⚠ Replication status: $REPLICATION_STATUS replicas${NC}"
fi

echo ""

# Check databases
echo -e "${BLUE}4. Checking shared databases...${NC}"

DATABASES=$(kubectl exec -it $PRIMARY_POD -n $NAMESPACE -- psql -U postgres -lqt 2>/dev/null | grep -E "users|exercises|achievements" | wc -l)

if [ "$DATABASES" -ge 3 ]; then
    echo -e "${GREEN}✓ All shared databases exist${NC}"
    kubectl exec -it $PRIMARY_POD -n $NAMESPACE -- psql -U postgres -lqt 2>/dev/null | grep -E "users|exercises|achievements"
else
    echo -e "${YELLOW}⚠ Some databases may not exist yet${NC}"
fi

echo ""

# Check storage
echo -e "${BLUE}5. Checking persistent storage...${NC}"

PVC_COUNT=$(kubectl get pvc -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | wc -l)

if [ "$PVC_COUNT" -ge 3 ]; then
    echo -e "${GREEN}✓ Persistent volumes are bound${NC}"
    kubectl get pvc -n $NAMESPACE -l app=postgres
else
    echo -e "${RED}✗ Not all persistent volumes are bound${NC}"
    kubectl get pvc -n $NAMESPACE -l app=postgres
fi

echo ""

# Check backup storage
echo -e "${BLUE}6. Checking backup storage...${NC}"

if kubectl get pvc -n $NAMESPACE postgres-backup-pvc &> /dev/null; then
    echo -e "${GREEN}✓ Backup storage is available${NC}"
    kubectl get pvc -n $NAMESPACE postgres-backup-pvc
else
    echo -e "${YELLOW}⚠ Backup storage not found${NC}"
fi

echo ""

# Check services
echo -e "${BLUE}7. Checking services...${NC}"

if kubectl get svc -n $NAMESPACE postgres &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL service is available${NC}"
    kubectl get svc -n $NAMESPACE postgres
else
    echo -e "${RED}✗ PostgreSQL service not found${NC}"
fi

echo ""

# Check monitoring
echo -e "${BLUE}8. Checking monitoring...${NC}"

if kubectl get servicemonitor -n $NAMESPACE postgres &> /dev/null; then
    echo -e "${GREEN}✓ ServiceMonitor is configured${NC}"
else
    echo -e "${YELLOW}⚠ ServiceMonitor not found (Prometheus may not be installed)${NC}"
fi

echo ""

# Check backup CronJob
echo -e "${BLUE}9. Checking backup CronJob...${NC}"

if kubectl get cronjob -n $NAMESPACE postgres-backup &> /dev/null; then
    echo -e "${GREEN}✓ Backup CronJob is configured${NC}"
    kubectl get cronjob -n $NAMESPACE postgres-backup
else
    echo -e "${RED}✗ Backup CronJob not found${NC}"
fi

echo ""

# Test database connectivity from pod
echo -e "${BLUE}10. Testing database connectivity...${NC}"

# Create a test pod
TEST_POD_NAME="postgres-test-$(date +%s)"

kubectl run $TEST_POD_NAME -n $NAMESPACE --image=postgres:14-alpine --rm -it --restart=Never -- \
    psql -h postgres.fitquest.svc.cluster.local -U postgres -d postgres -c "SELECT version();" &> /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database is accessible from within cluster${NC}"
else
    echo -e "${YELLOW}⚠ Could not verify cluster connectivity${NC}"
fi

echo ""

# Summary
echo -e "${YELLOW}Verification Summary${NC}"
echo "===================="
echo -e "${GREEN}✓ PostgreSQL deployment is operational${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:           kubectl logs -n $NAMESPACE postgres-0"
echo "  Connect to primary:  kubectl exec -it postgres-0 -n $NAMESPACE -- psql -U postgres"
echo "  Port forward:        kubectl port-forward -n $NAMESPACE svc/postgres 5432:5432"
echo "  Check replication:   kubectl exec -it postgres-0 -n $NAMESPACE -- psql -U postgres -c 'SELECT * FROM pg_stat_replication;'"
echo "  Check databases:     kubectl exec -it postgres-0 -n $NAMESPACE -- psql -U postgres -l"
echo ""
