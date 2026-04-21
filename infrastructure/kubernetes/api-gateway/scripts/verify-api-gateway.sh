#!/bin/bash
# Verification script for API Gateway deployment
# Checks all components are running and configured correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="ingress"
CHECKS_PASSED=0
CHECKS_FAILED=0

echo -e "${YELLOW}FitQuest API Gateway Verification${NC}"
echo "======================================"
echo ""

# Function to check and report
check_status() {
    local check_name=$1
    local result=$2
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $check_name"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $check_name"
        ((CHECKS_FAILED++))
    fi
}

# Check namespace exists
echo -e "${YELLOW}Checking namespace...${NC}"
kubectl get namespace $NAMESPACE &> /dev/null
check_status "Namespace '$NAMESPACE' exists" $?

# Check RBAC
echo -e "${YELLOW}Checking RBAC...${NC}"
kubectl get serviceaccount nginx-ingress-controller -n $NAMESPACE &> /dev/null
check_status "ServiceAccount exists" $?

kubectl get clusterrole nginx-ingress-controller &> /dev/null
check_status "ClusterRole exists" $?

kubectl get clusterrolebinding nginx-ingress-controller &> /dev/null
check_status "ClusterRoleBinding exists" $?

# Check ConfigMaps
echo -e "${YELLOW}Checking ConfigMaps...${NC}"
kubectl get configmap nginx-config -n $NAMESPACE &> /dev/null
check_status "nginx-config ConfigMap exists" $?

kubectl get configmap tcp-services -n $NAMESPACE &> /dev/null
check_status "tcp-services ConfigMap exists" $?

kubectl get configmap udp-services -n $NAMESPACE &> /dev/null
check_status "udp-services ConfigMap exists" $?

# Check Deployment
echo -e "${YELLOW}Checking Deployment...${NC}"
kubectl get deployment nginx-ingress-controller -n $NAMESPACE &> /dev/null
check_status "Deployment exists" $?

READY_REPLICAS=$(kubectl get deployment nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
DESIRED_REPLICAS=$(kubectl get deployment nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

if [ "$READY_REPLICAS" -ge 3 ]; then
    echo -e "${GREEN}✓${NC} Deployment has $READY_REPLICAS/$DESIRED_REPLICAS replicas ready"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} Deployment has $READY_REPLICAS/$DESIRED_REPLICAS replicas ready (expected 3+)"
    ((CHECKS_FAILED++))
fi

# Check Service
echo -e "${YELLOW}Checking Service...${NC}"
kubectl get service nginx-ingress-controller -n $NAMESPACE &> /dev/null
check_status "LoadBalancer Service exists" $?

# Check for external IP/hostname
EXTERNAL_IP=$(kubectl get svc nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
EXTERNAL_HOSTNAME=$(kubectl get svc nginx-ingress-controller -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")

if [ -n "$EXTERNAL_IP" ] || [ -n "$EXTERNAL_HOSTNAME" ]; then
    echo -e "${GREEN}✓${NC} LoadBalancer has external endpoint"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} LoadBalancer external endpoint not yet assigned (may take a few minutes)"
fi

# Check Pods
echo -e "${YELLOW}Checking Pods...${NC}"
POD_COUNT=$(kubectl get pods -n $NAMESPACE -l app=nginx-ingress-controller --no-headers 2>/dev/null | wc -l)
if [ "$POD_COUNT" -ge 3 ]; then
    echo -e "${GREEN}✓${NC} $POD_COUNT pods running"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} Only $POD_COUNT pods running (expected 3+)"
    ((CHECKS_FAILED++))
fi

# Check Pod status
RUNNING_PODS=$(kubectl get pods -n $NAMESPACE -l app=nginx-ingress-controller -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | wc -w)
if [ "$RUNNING_PODS" -ge 3 ]; then
    echo -e "${GREEN}✓${NC} $RUNNING_PODS pods in Running state"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} Only $RUNNING_PODS pods in Running state"
    ((CHECKS_FAILED++))
fi

# Check TLS Secret
echo -e "${YELLOW}Checking TLS Certificate...${NC}"
if kubectl get secret fitquest-tls -n $NAMESPACE &> /dev/null; then
    echo -e "${GREEN}✓${NC} TLS certificate secret exists"
    ((CHECKS_PASSED++))
    
    # Check certificate expiration
    CERT_EXPIRY=$(kubectl get secret fitquest-tls -n $NAMESPACE -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
    echo -e "${YELLOW}  Certificate expires: $CERT_EXPIRY${NC}"
else
    echo -e "${YELLOW}⚠${NC} TLS certificate secret not found (run generate-certificates.sh)"
fi

# Check Ingress
echo -e "${YELLOW}Checking Ingress...${NC}"
if kubectl get ingress fitquest-api-gateway -n $NAMESPACE &> /dev/null; then
    echo -e "${GREEN}✓${NC} Ingress resource exists"
    ((CHECKS_PASSED++))
    
    # Check ingress status
    INGRESS_IP=$(kubectl get ingress fitquest-api-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    INGRESS_HOSTNAME=$(kubectl get ingress fitquest-api-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ -n "$INGRESS_IP" ] || [ -n "$INGRESS_HOSTNAME" ]; then
        echo -e "${GREEN}✓${NC} Ingress has IP/hostname assigned"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Ingress IP/hostname not yet assigned"
    fi
else
    echo -e "${YELLOW}⚠${NC} Ingress resource not found (run: kubectl apply -f ingress/fitquest-ingress.yaml)"
fi

# Check metrics endpoint
echo -e "${YELLOW}Checking Metrics...${NC}"
METRICS_POD=$(kubectl get pods -n $NAMESPACE -l app=nginx-ingress-controller -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$METRICS_POD" ]; then
    kubectl exec -n $NAMESPACE "$METRICS_POD" -- curl -s http://localhost:10254/metrics &> /dev/null
    check_status "Metrics endpoint accessible" $?
fi

# Summary
echo ""
echo -e "${YELLOW}Verification Summary${NC}"
echo "======================================"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please review the output above.${NC}"
    exit 1
fi
