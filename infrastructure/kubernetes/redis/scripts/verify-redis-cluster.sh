#!/bin/bash

# Redis Cluster Verification Script
# This script verifies the Redis cluster deployment and health

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

# Check Redis pods
check_redis_pods() {
    log_info "Checking Redis pods..."
    
    REDIS_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=redis-cluster -o jsonpath='{.items[*].metadata.name}')
    REDIS_COUNT=$(echo "$REDIS_PODS" | wc -w)
    
    if [ "$REDIS_COUNT" -ge "$REDIS_REPLICAS" ]; then
        log_success "Redis pods found: $REDIS_COUNT"
        
        for pod in $REDIS_PODS; do
            STATUS=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
            READY=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
            
            if [ "$STATUS" = "Running" ] && [ "$READY" = "True" ]; then
                log_success "  $pod: Running and Ready"
            else
                log_warning "  $pod: $STATUS (Ready: $READY)"
            fi
        done
    else
        log_error "Expected $REDIS_REPLICAS Redis pods, found $REDIS_COUNT"
    fi
}

# Check Sentinel pods
check_sentinel_pods() {
    log_info "Checking Sentinel pods..."
    
    SENTINEL_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=redis-sentinel -o jsonpath='{.items[*].metadata.name}')
    SENTINEL_COUNT=$(echo "$SENTINEL_PODS" | wc -w)
    
    if [ "$SENTINEL_COUNT" -ge "$SENTINEL_REPLICAS" ]; then
        log_success "Sentinel pods found: $SENTINEL_COUNT"
        
        for pod in $SENTINEL_PODS; do
            STATUS=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
            READY=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
            
            if [ "$STATUS" = "Running" ] && [ "$READY" = "True" ]; then
                log_success "  $pod: Running and Ready"
            else
                log_warning "  $pod: $STATUS (Ready: $READY)"
            fi
        done
    else
        log_error "Expected $SENTINEL_REPLICAS Sentinel pods, found $SENTINEL_COUNT"
    fi
}

# Check services
check_services() {
    log_info "Checking services..."
    
    # Check Redis service
    if kubectl get svc redis-cluster -n "$NAMESPACE" &> /dev/null; then
        REDIS_IP=$(kubectl get svc redis-cluster -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        REDIS_PORT=$(kubectl get svc redis-cluster -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].port}')
        log_success "Redis service: $REDIS_IP:$REDIS_PORT"
    else
        log_error "Redis service not found"
    fi
    
    # Check Sentinel service
    if kubectl get svc redis-sentinel -n "$NAMESPACE" &> /dev/null; then
        SENTINEL_IP=$(kubectl get svc redis-sentinel -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        SENTINEL_PORT=$(kubectl get svc redis-sentinel -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].port}')
        log_success "Sentinel service: $SENTINEL_IP:$SENTINEL_PORT"
    else
        log_error "Sentinel service not found"
    fi
}

# Check persistent volumes
check_persistent_volumes() {
    log_info "Checking persistent volumes..."
    
    PVC_COUNT=$(kubectl get pvc -n "$NAMESPACE" -l app=redis-cluster -o jsonpath='{.items[*].metadata.name}' | wc -w)
    
    if [ "$PVC_COUNT" -ge "$REDIS_REPLICAS" ]; then
        log_success "Persistent volume claims: $PVC_COUNT"
        
        kubectl get pvc -n "$NAMESPACE" -l app=redis-cluster -o wide
    else
        log_warning "Expected $REDIS_REPLICAS PVCs, found $PVC_COUNT"
    fi
}

# Check Redis connectivity
check_redis_connectivity() {
    log_info "Checking Redis connectivity..."
    
    if kubectl exec -it redis-cluster-0 -n "$NAMESPACE" -- redis-cli ping &> /dev/null; then
        log_success "Redis is responding to ping"
        
        # Get server info
        INFO=$(kubectl exec -it redis-cluster-0 -n "$NAMESPACE" -- redis-cli info server 2>/dev/null | grep redis_version)
        log_success "  $INFO"
    else
        log_error "Redis is not responding to ping"
    fi
}

# Check Redis replication
check_redis_replication() {
    log_info "Checking Redis replication..."
    
    REPLICATION=$(kubectl exec -it redis-cluster-0 -n "$NAMESPACE" -- redis-cli info replication 2>/dev/null)
    
    ROLE=$(echo "$REPLICATION" | grep "role:" | cut -d: -f2 | tr -d '\r')
    CONNECTED_SLAVES=$(echo "$REPLICATION" | grep "connected_slaves:" | cut -d: -f2 | tr -d '\r')
    
    log_success "Master role: $ROLE"
    log_success "Connected slaves: $CONNECTED_SLAVES"
    
    if [ "$CONNECTED_SLAVES" -ge 2 ]; then
        log_success "Replication is healthy"
    else
        log_warning "Expected at least 2 connected slaves, found $CONNECTED_SLAVES"
    fi
}

# Check Redis memory
check_redis_memory() {
    log_info "Checking Redis memory usage..."
    
    MEMORY=$(kubectl exec -it redis-cluster-0 -n "$NAMESPACE" -- redis-cli info memory 2>/dev/null)
    
    USED=$(echo "$MEMORY" | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
    MAX=$(echo "$MEMORY" | grep "maxmemory_human:" | cut -d: -f2 | tr -d '\r')
    
    log_success "Used memory: $USED"
    log_success "Max memory: $MAX"
}

# Check Sentinel status
check_sentinel_status() {
    log_info "Checking Sentinel status..."
    
    if kubectl exec -it redis-sentinel-0 -n "$NAMESPACE" -- redis-cli -p 26379 ping &> /dev/null; then
        log_success "Sentinel is responding to ping"
        
        # Get master status
        MASTER_STATUS=$(kubectl exec -it redis-sentinel-0 -n "$NAMESPACE" -- redis-cli -p 26379 sentinel masters 2>/dev/null)
        
        if echo "$MASTER_STATUS" | grep -q "mymaster"; then
            log_success "Sentinel is monitoring master"
        else
            log_warning "Sentinel master status unclear"
        fi
    else
        log_error "Sentinel is not responding to ping"
    fi
}

# Check endpoints
check_endpoints() {
    log_info "Checking endpoints..."
    
    REDIS_ENDPOINTS=$(kubectl get endpoints redis-cluster -n "$NAMESPACE" -o jsonpath='{.subsets[0].addresses[*].targetRef.name}' 2>/dev/null | wc -w)
    SENTINEL_ENDPOINTS=$(kubectl get endpoints redis-sentinel -n "$NAMESPACE" -o jsonpath='{.subsets[0].addresses[*].targetRef.name}' 2>/dev/null | wc -w)
    
    log_success "Redis endpoints: $REDIS_ENDPOINTS"
    log_success "Sentinel endpoints: $SENTINEL_ENDPOINTS"
}

# Check metrics
check_metrics() {
    log_info "Checking Prometheus metrics..."
    
    # Check if ServiceMonitor exists
    if kubectl get servicemonitor redis-cluster -n "$NAMESPACE" &> /dev/null; then
        log_success "ServiceMonitor for Redis found"
    else
        log_warning "ServiceMonitor for Redis not found"
    fi
    
    if kubectl get servicemonitor redis-sentinel -n "$NAMESPACE" &> /dev/null; then
        log_success "ServiceMonitor for Sentinel found"
    else
        log_warning "ServiceMonitor for Sentinel not found"
    fi
    
    # Check if PrometheusRule exists
    if kubectl get prometheusrule redis-alerts -n "$NAMESPACE" &> /dev/null; then
        log_success "PrometheusRule for Redis alerts found"
    else
        log_warning "PrometheusRule for Redis alerts not found"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${BLUE}=== Verification Summary ===${NC}"
    echo ""
    echo "Redis Cluster Status:"
    echo "  Pods: $(kubectl get pods -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)"
    echo "  Services: $(kubectl get svc -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)"
    echo "  PVCs: $(kubectl get pvc -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)"
    echo ""
    echo "Sentinel Status:"
    echo "  Pods: $(kubectl get pods -n "$NAMESPACE" -l app=redis-sentinel --no-headers 2>/dev/null | wc -l)"
    echo "  Services: $(kubectl get svc -n "$NAMESPACE" -l app=redis-sentinel --no-headers 2>/dev/null | wc -l)"
    echo ""
}

# Main execution
main() {
    log_info "Starting Redis cluster verification..."
    echo ""
    
    check_redis_pods
    echo ""
    
    check_sentinel_pods
    echo ""
    
    check_services
    echo ""
    
    check_persistent_volumes
    echo ""
    
    check_redis_connectivity
    echo ""
    
    check_redis_replication
    echo ""
    
    check_redis_memory
    echo ""
    
    check_sentinel_status
    echo ""
    
    check_endpoints
    echo ""
    
    check_metrics
    echo ""
    
    print_summary
    
    log_success "Redis cluster verification completed!"
}

# Run main function
main
