#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}=== FitQuest Monitoring Stack Deployment ===${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if monitoring namespace exists
if ! kubectl get namespace monitoring &> /dev/null; then
    echo -e "${RED}Error: monitoring namespace does not exist${NC}"
    echo "Please create the monitoring namespace first:"
    echo "  kubectl create namespace monitoring"
    exit 1
fi

echo -e "${YELLOW}Step 1: Deploying Prometheus...${NC}"
kubectl apply -f "$SCRIPT_DIR/prometheus/rbac.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/rules/prometheus-rules.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/service.yaml"
echo -e "${GREEN}✓ Prometheus deployed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Deploying Grafana...${NC}"
kubectl apply -f "$SCRIPT_DIR/grafana/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/service.yaml"
echo -e "${GREEN}✓ Grafana deployed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Deploying Jaeger...${NC}"
kubectl apply -f "$SCRIPT_DIR/jaeger/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/jaeger/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/jaeger/service.yaml"
echo -e "${GREEN}✓ Jaeger deployed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Deploying Loki...${NC}"
kubectl apply -f "$SCRIPT_DIR/loki/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/loki/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/loki/service.yaml"
echo -e "${GREEN}✓ Loki deployed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Deploying Alertmanager...${NC}"
kubectl apply -f "$SCRIPT_DIR/alertmanager/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/alertmanager/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/alertmanager/service.yaml"
echo -e "${GREEN}✓ Alertmanager deployed${NC}"
echo ""

echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl rollout status deployment/prometheus -n monitoring --timeout=5m
kubectl rollout status deployment/grafana -n monitoring --timeout=5m
kubectl rollout status deployment/jaeger -n monitoring --timeout=5m
kubectl rollout status deployment/loki -n monitoring --timeout=5m
kubectl rollout status deployment/alertmanager -n monitoring --timeout=5m

echo ""
echo -e "${GREEN}=== Monitoring Stack Deployment Complete ===${NC}"
echo ""
echo -e "${YELLOW}Access monitoring services:${NC}"
echo ""
echo "Grafana (http://localhost:3000):"
echo "  kubectl port-forward -n monitoring svc/grafana 3000:3000"
echo "  Default credentials: admin / admin"
echo ""
echo "Prometheus (http://localhost:9090):"
echo "  kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo ""
echo "Jaeger (http://localhost:16686):"
echo "  kubectl port-forward -n monitoring svc/jaeger-query 16686:16686"
echo ""
echo "Loki (http://localhost:3100):"
echo "  kubectl port-forward -n monitoring svc/loki 3100:3100"
echo ""
echo "Alertmanager (http://localhost:9093):"
echo "  kubectl port-forward -n monitoring svc/alertmanager 9093:9093"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Change Grafana admin password"
echo "2. Configure PagerDuty integration in Alertmanager"
echo "3. Configure Slack webhook in Alertmanager"
echo "4. Verify monitoring stack: ./verify-monitoring-stack.sh"
