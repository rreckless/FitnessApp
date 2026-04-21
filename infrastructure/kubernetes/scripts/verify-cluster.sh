#!/bin/bash

# FitQuest Cluster Verification Script
# This script verifies that the Kubernetes cluster is properly configured

set -e

echo "=========================================="
echo "FitQuest Cluster Verification"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }

# Verify cluster access
echo ""
echo "1. Verifying cluster access..."
if kubectl cluster-info > /dev/null 2>&1; then
  echo "✓ Cluster access verified"
  kubectl cluster-info
else
  echo "✗ Failed to access cluster"
  exit 1
fi

# Check nodes
echo ""
echo "2. Checking cluster nodes..."
NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
echo "✓ Found $NODE_COUNT nodes"
kubectl get nodes -o wide

# Check node status
echo ""
echo "3. Checking node status..."
READY_NODES=$(kubectl get nodes --no-headers | grep -c " Ready ")
if [ $READY_NODES -eq $NODE_COUNT ]; then
  echo "✓ All nodes are ready"
else
  echo "⚠ Only $READY_NODES/$NODE_COUNT nodes are ready"
fi

# Check namespaces
echo ""
echo "4. Checking namespaces..."
REQUIRED_NAMESPACES=("fitquest" "monitoring" "ingress" "kube-system" "kube-public")
for ns in "${REQUIRED_NAMESPACES[@]}"; do
  if kubectl get namespace $ns > /dev/null 2>&1; then
    echo "✓ Namespace $ns exists"
  else
    echo "✗ Namespace $ns not found"
  fi
done

# Check resource quotas
echo ""
echo "5. Checking resource quotas..."
for ns in fitquest monitoring ingress; do
  if kubectl get resourcequota -n $ns > /dev/null 2>&1; then
    echo "✓ Resource quota configured in $ns namespace"
    kubectl get resourcequota -n $ns
  else
    echo "⚠ No resource quota in $ns namespace"
  fi
done

# Check network policies
echo ""
echo "6. Checking network policies..."
for ns in fitquest monitoring ingress; do
  if kubectl get networkpolicy -n $ns > /dev/null 2>&1; then
    echo "✓ Network policy configured in $ns namespace"
    kubectl get networkpolicy -n $ns
  else
    echo "⚠ No network policy in $ns namespace"
  fi
done

# Check service accounts
echo ""
echo "7. Checking service accounts..."
for ns in fitquest monitoring ingress; do
  SA_COUNT=$(kubectl get serviceaccount -n $ns --no-headers | wc -l)
  echo "✓ Found $SA_COUNT service accounts in $ns namespace"
done

# Check RBAC
echo ""
echo "8. Checking RBAC configuration..."
for ns in fitquest monitoring ingress; do
  ROLE_COUNT=$(kubectl get role -n $ns --no-headers 2>/dev/null | wc -l)
  ROLEBINDING_COUNT=$(kubectl get rolebinding -n $ns --no-headers 2>/dev/null | wc -l)
  echo "✓ $ns namespace: $ROLE_COUNT roles, $ROLEBINDING_COUNT role bindings"
done

# Check storage classes
echo ""
echo "9. Checking storage classes..."
STORAGE_CLASSES=$(kubectl get storageclass --no-headers 2>/dev/null | wc -l)
if [ $STORAGE_CLASSES -gt 0 ]; then
  echo "✓ Found $STORAGE_CLASSES storage classes"
  kubectl get storageclass
else
  echo "⚠ No storage classes found"
fi

# Check API server
echo ""
echo "10. Checking API server..."
if kubectl get apiservices | grep -q "v1 "; then
  echo "✓ API server is responding"
else
  echo "✗ API server not responding"
fi

# Check DNS
echo ""
echo "11. Checking DNS..."
DNS_POD=$(kubectl get pods -n kube-system -l k8s-app=kube-dns --no-headers 2>/dev/null | head -1 | awk '{print $1}')
if [ -n "$DNS_POD" ]; then
  echo "✓ DNS pod found: $DNS_POD"
else
  echo "⚠ DNS pod not found"
fi

# Check metrics server
echo ""
echo "12. Checking metrics server..."
if kubectl get deployment -n kube-system metrics-server > /dev/null 2>&1; then
  echo "✓ Metrics server is installed"
else
  echo "⚠ Metrics server not installed"
fi

# Check ingress controller
echo ""
echo "13. Checking ingress controller..."
INGRESS_PODS=$(kubectl get pods -n ingress --no-headers 2>/dev/null | wc -l)
if [ $INGRESS_PODS -gt 0 ]; then
  echo "✓ Found $INGRESS_PODS ingress controller pods"
else
  echo "⚠ No ingress controller pods found"
fi

# Check persistent volumes
echo ""
echo "14. Checking persistent volumes..."
PV_COUNT=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
PVC_COUNT=$(kubectl get pvc -A --no-headers 2>/dev/null | wc -l)
echo "✓ Found $PV_COUNT persistent volumes and $PVC_COUNT persistent volume claims"

# Check events
echo ""
echo "15. Checking recent events..."
echo "Recent cluster events:"
kubectl get events -A --sort-by='.lastTimestamp' | tail -10

# Check pod security policies
echo ""
echo "16. Checking pod security policies..."
PSP_COUNT=$(kubectl get psp --no-headers 2>/dev/null | wc -l)
if [ $PSP_COUNT -gt 0 ]; then
  echo "✓ Found $PSP_COUNT pod security policies"
else
  echo "⚠ No pod security policies found"
fi

# Check resource usage
echo ""
echo "17. Checking resource usage..."
echo "Node resource usage:"
kubectl top nodes 2>/dev/null || echo "⚠ Metrics not available yet (wait a few minutes)"

# Summary
echo ""
echo "=========================================="
echo "Cluster Verification Summary"
echo "=========================================="
echo ""
echo "Cluster Status:"
kubectl get nodes -o wide
echo ""
echo "Namespace Status:"
kubectl get namespaces
echo ""
echo "Pod Status (all namespaces):"
kubectl get pods -A --no-headers | head -20
echo ""

# Final checks
echo "=========================================="
echo "Final Verification Checklist"
echo "=========================================="
echo ""

CHECKS_PASSED=0
CHECKS_TOTAL=0

# Check 1: Cluster access
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if kubectl cluster-info > /dev/null 2>&1; then
  echo "✓ Cluster access"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "✗ Cluster access"
fi

# Check 2: All nodes ready
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if [ $READY_NODES -eq $NODE_COUNT ]; then
  echo "✓ All nodes ready"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "✗ Not all nodes ready"
fi

# Check 3: Required namespaces
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if kubectl get namespace fitquest > /dev/null 2>&1 && \
   kubectl get namespace monitoring > /dev/null 2>&1 && \
   kubectl get namespace ingress > /dev/null 2>&1; then
  echo "✓ Required namespaces exist"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "✗ Missing required namespaces"
fi

# Check 4: API server responding
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if kubectl get apiservices | grep -q "v1 "; then
  echo "✓ API server responding"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "✗ API server not responding"
fi

# Check 5: DNS working
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if kubectl get pods -n kube-system -l k8s-app=kube-dns > /dev/null 2>&1; then
  echo "✓ DNS working"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "✗ DNS not working"
fi

echo ""
echo "Verification Results: $CHECKS_PASSED/$CHECKS_TOTAL checks passed"
echo ""

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
  echo "✓ Cluster is ready for deployment!"
  exit 0
else
  echo "⚠ Some checks failed. Please review the output above."
  exit 1
fi
