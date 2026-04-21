#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== FitQuest Monitoring Stack Verification ===${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if monitoring namespace exists
if ! kubectl get namespace monitoring &> /dev/null; then
    echo -e "${RED}Error: monitoring namespace does not exist${NC}"
    exit 1
fi

# Function to check deployment status
check_deployment() {
    local deployment=$1
    local namespace=$2
    
    echo -n "Checking $deployment... "
    
    if kubectl get deployment "$deployment" -n "$namespace" &> /dev/null; then
        local ready=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.status.readyReplicas}')
        local desired=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.spec.replicas}')
        
        if [ "$ready" == "$desired" ] && [ "$ready" -gt 0 ]; then
            echo -e "${GREEN}✓ Ready ($ready/$desired replicas)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Not ready ($ready/$desired replicas)${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

# Function to check service status
check_service() {
    local service=$1
    local namespace=$2
    
    echo -n "Checking service $service... "
    
    if kubectl get service "$service" -n "$namespace" &> /dev/null; then
        local cluster_ip=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.clusterIP}')
        if [ -n "$cluster_ip" ] && [ "$cluster_ip" != "None" ]; then
            echo -e "${GREEN}✓ Available ($cluster_ip)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ No cluster IP${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

# Function to check pod status
check_pods() {
    local label=$1
    local namespace=$2
    
    echo -n "Checking pods with label $label... "
    
    local running=$(kubectl get pods -n "$namespace" -l "$label" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
    local total=$(kubectl get pods -n "$namespace" -l "$label" --no-headers 2>/dev/null | wc -l)
    
    if [ "$running" -eq "$total" ] && [ "$total" -gt 0 ]; then
        echo -e "${GREEN}✓ All running ($running/$total)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Not all running ($running/$total)${NC}"
        return 1
    fi
}

# Function to check persistent volumes
check_pvc() {
    local pvc=$1
    local namespace=$2
    
    echo -n "Checking PVC $pvc... "
    
    if kubectl get pvc "$pvc" -n "$namespace" &> /dev/null; then
        local status=$(kubectl get pvc "$pvc" -n "$namespace" -o jsonpath='{.status.phase}')
        if [ "$status" == "Bound" ]; then
            echo -e "${GREEN}✓ Bound${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Status: $status${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

# Check deployments
echo -e "${YELLOW}Checking Deployments:${NC}"
check_deployment "prometheus" "monitoring"
check_deployment "grafana" "monitoring"
check_deployment "jaeger" "monitoring"
check_deployment "loki" "monitoring"
check_deployment "alertmanager" "monitoring"
echo ""

# Check services
echo -e "${YELLOW}Checking Services:${NC}"
check_service "prometheus" "monitoring"
check_service "grafana" "monitoring"
check_service "jaeger-agent" "monitoring"
check_service "jaeger-collector" "monitoring"
check_service "jaeger-query" "monitoring"
check_service "loki" "monitoring"
check_service "alertmanager" "monitoring"
echo ""

# Check pods
echo -e "${YELLOW}Checking Pods:${NC}"
check_pods "app=prometheus" "monitoring"
check_pods "app=grafana" "monitoring"
check_pods "app=jaeger" "monitoring"
check_pods "app=loki" "monitoring"
check_pods "app=alertmanager" "monitoring"
echo ""

# Check persistent volumes
echo -e "${YELLOW}Checking Persistent Volumes:${NC}"
check_pvc "prometheus-storage" "monitoring"
check_pvc "grafana-storage" "monitoring"
check_pvc "loki-storage" "monitoring"
check_pvc "alertmanager-storage" "monitoring"
echo ""

# Check resource usage
echo -e "${YELLOW}Resource Usage:${NC}"
echo "CPU and Memory requests:"
kubectl get pods -n monitoring -o custom-columns=NAME:.metadata.name,CPU:.spec.containers[*].resources.requests.cpu,MEMORY:.spec.containers[*].resources.requests.memory

echo ""
echo -e "${YELLOW}Monitoring Stack Status:${NC}"
kubectl get all -n monitoring

echo ""
echo -e "${GREEN}=== Verification Complete ===${NC}"
echo ""
echo -e "${YELLOW}Quick access commands:${NC}"
echo ""
echo "Grafana:"
echo "  kubectl port-forward -n monitoring svc/grafana 3000:3000"
echo ""
echo "Prometheus:"
echo "  kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo ""
echo "Jaeger:"
echo "  kubectl port-forward -n monitoring svc/jaeger-query 16686:16686"
echo ""
echo "Loki:"
echo "  kubectl port-forward -n monitoring svc/loki 3100:3100"
echo ""
echo "Alertmanager:"
echo "  kubectl port-forward -n monitoring svc/alertmanager 9093:9093"
