#!/bin/bash

# Redis Cluster Setup Script
# This script deploys Redis cluster with Sentinel for high availability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"
REDIS_REPLICAS=3
SENTINEL_REPLICAS=3
TIMEOUT=300

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check namespace
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Check storage class
    if ! kubectl get storageclass &> /dev/null; then
        log_error "No storage class available"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy RBAC
deploy_rbac() {
    log_info "Deploying RBAC resources..."
    
    kubectl apply -f deployment/redis-rbac.yaml
    
    log_success "RBAC resources deployed"
}

# Deploy ConfigMaps
deploy_configmaps() {
    log_info "Deploying ConfigMaps..."
    
    kubectl apply -f deployment/redis-configmap.yaml
    
    log_success "ConfigMaps deployed"
}

# Deploy NetworkPolicies
deploy_networkpolicies() {
    log_info "Deploying NetworkPolicies..."
    
    kubectl apply -f deployment/redis-networkpolicy.yaml
    
    log_success "NetworkPolicies deployed"
}

# Deploy Redis StatefulSet
deploy_redis() {
    log_info "Deploying Redis cluster..."
    
    kubectl apply -f deployment/redis-statefulset.yaml
    
    log_success "Redis cluster deployment submitted"
}

# Deploy Sentinel StatefulSet
deploy_sentinel() {
    log_info "Deploying Redis Sentinel..."
    
    kubectl apply -f deployment/sentinel-statefulset.yaml
    
    log_success "Redis Sentinel deployment submitted"
}

# Deploy ServiceMonitor
deploy_servicemonitor() {
    log_info "Deploying ServiceMonitor for Prometheus..."
    
    if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
        kubectl apply -f deployment/servicemonitor.yaml
        log_success "ServiceMonitor deployed"
    else
        log_warning "ServiceMonitor CRD not found, skipping ServiceMonitor deployment"
    fi
}

# Deploy PrometheusRule
deploy_prometheus_rules() {
    log_info "Deploying PrometheusRule for alerts..."
    
    if kubectl get crd prometheusrules.monitoring.coreos.com &> /dev/null; then
        kubectl apply -f monitoring/prometheus-rules.yaml
        log_success "PrometheusRule deployed"
    else
        log_warning "PrometheusRule CRD not found, skipping PrometheusRule deployment"
    fi
}

# Wait for Redis pods to be ready
wait_for_redis() {
    log_info "Waiting for Redis pods to be ready (timeout: ${TIMEOUT}s)..."
    
    if kubectl wait --for=condition=ready pod -l app=redis-cluster -n "$NAMESPACE" --timeout="${TIMEOUT}s" 2>/dev/null; then
        log_success "Redis pods are ready"
    else
        log_error "Redis pods did not become ready within timeout"
        exit 1
    fi
}

# Wait for Sentinel pods to be ready
wait_for_sentinel() {
    log_info "Waiting for Sentinel pods to be ready (timeout: ${TIMEOUT}s)..."
    
    if kubectl wait --for=condition=ready pod -l app=redis-sentinel -n "$NAMESPACE" --timeout="${TIMEOUT}s" 2>/dev/null; then
        log_success "Sentinel pods are ready"
    else
        log_error "Sentinel pods did not become ready within timeout"
        exit 1
    fi
}

# Initialize Redis cluster
initialize_redis() {
    log_info "Initializing Redis cluster..."
    
    # Wait a bit for pods to fully initialize
    sleep 5
    
    # Check if cluster is already initialized
    if kubectl exec -it redis-cluster-0 -n "$NAMESPACE" -- redis-cli cluster info 2>/dev/null | grep -q "cluster_state:ok"; then
        log_success "Redis cluster already initialized"
        return
    fi
    
    log_info "Redis cluster not yet initialized, waiting for automatic initialization..."
    sleep 10
    
    log_success "Redis cluster initialization complete"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check Redis pods
    log_info "Checking Redis pods..."
    REDIS_READY=$(kubectl get pods -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | grep -c "Running" || echo 0)
    if [ "$REDIS_READY" -ge "$REDIS_REPLICAS" ]; then
        log_success "Redis pods are running ($REDIS_READY/$REDIS_REPLICAS)"
    else
        log_warning "Redis pods not all running ($REDIS_READY/$REDIS_REPLICAS)"
    fi
    
    # Check Sentinel pods
    log_info "Checking Sentinel pods..."
    SENTINEL_READY=$(kubectl get pods -n "$NAMESPACE" -l app=redis-sentinel --no-headers 2>/dev/null | grep -c "Running" || echo 0)
    if [ "$SENTINEL_READY" -ge "$SENTINEL_REPLICAS" ]; then
        log_success "Sentinel pods are running ($SENTINEL_READY/$SENTINEL_REPLICAS)"
    else
        log_warning "Sentinel pods not all running ($SENTINEL_READY/$SENTINEL_REPLICAS)"
    fi
    
    # Check services
    log_info "Checking services..."
    if kubectl get svc redis-cluster -n "$NAMESPACE" &> /dev/null; then
        log_success "Redis service is available"
    else
        log_error "Redis service not found"
    fi
    
    if kubectl get svc redis-sentinel -n "$NAMESPACE" &> /dev/null; then
        log_success "Sentinel service is available"
    else
        log_error "Sentinel service not found"
    fi
    
    # Check persistent volumes
    log_info "Checking persistent volumes..."
    PVC_COUNT=$(kubectl get pvc -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)
    if [ "$PVC_COUNT" -ge "$REDIS_REPLICAS" ]; then
        log_success "Persistent volumes are bound ($PVC_COUNT/$REDIS_REPLICAS)"
    else
        log_warning "Not all persistent volumes are bound ($PVC_COUNT/$REDIS_REPLICAS)"
    fi
}

# Print access information
print_access_info() {
    log_info "Redis cluster deployment complete!"
    echo ""
    echo -e "${BLUE}=== Access Information ===${NC}"
    echo ""
    echo "From within the cluster:"
    echo "  Redis: redis://redis-cluster.${NAMESPACE}.svc.cluster.local:6379"
    echo "  Sentinel: redis-sentinel://redis-sentinel.${NAMESPACE}.svc.cluster.local:26379"
    echo ""
    echo "From outside the cluster (port forwarding):"
    echo "  kubectl port-forward -n ${NAMESPACE} svc/redis-cluster 6379:6379"
    echo "  kubectl port-forward -n ${NAMESPACE} svc/redis-sentinel 26379:26379"
    echo ""
    echo "Test connection:"
    echo "  redis-cli -h localhost -p 6379 ping"
    echo ""
    echo "Access Redis CLI:"
    echo "  kubectl exec -it redis-cluster-0 -n ${NAMESPACE} -- redis-cli"
    echo ""
    echo "Access Sentinel CLI:"
    echo "  kubectl exec -it redis-sentinel-0 -n ${NAMESPACE} -- redis-cli -p 26379"
    echo ""
}

# Main execution
main() {
    log_info "Starting Redis cluster deployment..."
    echo ""
    
    check_prerequisites
    deploy_rbac
    deploy_configmaps
    deploy_networkpolicies
    deploy_redis
    deploy_sentinel
    deploy_servicemonitor
    deploy_prometheus_rules
    
    wait_for_redis
    wait_for_sentinel
    
    initialize_redis
    verify_deployment
    print_access_info
    
    log_success "Redis cluster deployment completed successfully!"
}

# Run main function
main
