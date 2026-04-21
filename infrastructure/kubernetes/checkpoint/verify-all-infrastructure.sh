#!/bin/bash

# FitQuest Phase 1 Infrastructure Checkpoint Verification Script
# Comprehensive verification of all infrastructure components
# This script verifies: Kubernetes cluster, API Gateway, RabbitMQ, Redis, PostgreSQL, and Monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"
MONITORING_NAMESPACE="monitoring"
INGRESS_NAMESPACE="ingress"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="checkpoint-report-${TIMESTAMP}.md"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_CHECKS++))
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

check_command() {
    local cmd=$1
    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command not found: $cmd"
        exit 1
    fi
}

# Initialize report
init_report() {
    cat > "$REPORT_FILE" << 'EOF'
# FitQuest Phase 1 Infrastructure Checkpoint Report

**Generated:** $(date)

## Executive Summary

This report documents the verification of all Phase 1 infrastructure components for the FitQuest Gamified Fitness application.

### Verification Scope

- Kubernetes Cluster Health
- API Gateway (Nginx Ingress)
- Message Queue (RabbitMQ)
- Redis Cluster with Sentinel
- PostgreSQL Database
- Monitoring Stack (Prometheus, Grafana, Jaeger, Loki, Alertmanager)

---

## Detailed Verification Results

EOF
}

# Main verification flow
main() {
    log_section "FitQuest Phase 1 Infrastructure Checkpoint"
    
    # Check prerequisites
    log_info "Checking prerequisites..."
    check_command "kubectl"
    check_command "curl"
    
    # Run all verification checks
    verify_kubernetes_cluster
    verify_api_gateway
    verify_rabbitmq
    verify_redis
    verify_postgresql
    verify_monitoring_stack
    verify_microservices_routing
    
    # Generate summary
    print_summary
}

verify_kubernetes_cluster() {
    log_section "1. Kubernetes Cluster Verification"
    
    # Check cluster access
    ((TOTAL_CHECKS++))
    if kubectl cluster-info &> /dev/null; then
        log_success "Cluster access verified"
    else
        log_error "Failed to access cluster"
        return 1
    fi
    
    # Check nodes
    ((TOTAL_CHECKS++))
    NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
    READY_NODES=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || true)
    
    if [ "$READY_NODES" -eq "$NODE_COUNT" ] && [ "$NODE_COUNT" -gt 0 ]; then
        log_success "All $NODE_COUNT nodes are ready"
    else
        log_warning "Only $READY_NODES/$NODE_COUNT nodes are ready"
    fi
    
    # Check namespaces
    ((TOTAL_CHECKS++))
    for ns in "$NAMESPACE" "$MONITORING_NAMESPACE" "$INGRESS_NAMESPACE"; do
        if kubectl get namespace "$ns" &> /dev/null; then
            log_success "Namespace '$ns' exists"
        else
            log_error "Namespace '$ns' not found"
        fi
    done
    
    # Check API server
    ((TOTAL_CHECKS++))
    if kubectl get apiservices &> /dev/null; then
        log_success "API server is responding"
    else
        log_error "API server not responding"
    fi
    
    # Check DNS
    ((TOTAL_CHECKS++))
    DNS_PODS=$(kubectl get pods -n kube-system -l k8s-app=kube-dns --no-headers 2>/dev/null | wc -l)
    if [ "$DNS_PODS" -gt 0 ]; then
        log_success "DNS pods found ($DNS_PODS running)"
    else
        log_warning "DNS pods not found"
    fi
    
    # Check metrics server
    ((TOTAL_CHECKS++))
    if kubectl get deployment -n kube-system metrics-server &> /dev/null; then
        log_success "Metrics server is installed"
    else
        log_warning "Metrics server not installed"
    fi
}

verify_api_gateway() {
    log_section "2. API Gateway (Nginx Ingress) Verification"
    
    # Check deployment
    ((TOTAL_CHECKS++))
    if kubectl get deployment nginx-ingress-controller -n "$INGRESS_NAMESPACE" &> /dev/null; then
        READY=$(kubectl get deployment nginx-ingress-controller -n "$INGRESS_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        DESIRED=$(kubectl get deployment nginx-ingress-controller -n "$INGRESS_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$READY" -ge 3 ]; then
            log_success "API Gateway deployment ready ($READY/$DESIRED replicas)"
        else
            log_warning "API Gateway deployment not fully ready ($READY/$DESIRED replicas)"
        fi
    else
        log_error "API Gateway deployment not found"
    fi
    
    # Check service
    ((TOTAL_CHECKS++))
    if kubectl get svc nginx-ingress-controller -n "$INGRESS_NAMESPACE" &> /dev/null; then
        log_success "API Gateway service exists"
    else
        log_error "API Gateway service not found"
    fi
    
    # Check external endpoint
    ((TOTAL_CHECKS++))
    EXTERNAL_IP=$(kubectl get svc nginx-ingress-controller -n "$INGRESS_NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    EXTERNAL_HOSTNAME=$(kubectl get svc nginx-ingress-controller -n "$INGRESS_NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ -n "$EXTERNAL_IP" ] || [ -n "$EXTERNAL_HOSTNAME" ]; then
        log_success "API Gateway has external endpoint assigned"
    else
        log_warning "API Gateway external endpoint not yet assigned"
    fi
    
    # Check TLS certificate
    ((TOTAL_CHECKS++))
    if kubectl get secret fitquest-tls -n "$INGRESS_NAMESPACE" &> /dev/null; then
        log_success "TLS certificate configured"
    else
        log_warning "TLS certificate not found"
    fi
}

verify_rabbitmq() {
    log_section "3. RabbitMQ Message Queue Verification"
    
    # Check StatefulSet
    ((TOTAL_CHECKS++))
    if kubectl get statefulset rabbitmq -n "$NAMESPACE" &> /dev/null; then
        READY=$(kubectl get statefulset rabbitmq -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        DESIRED=$(kubectl get statefulset rabbitmq -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$READY" -eq "$DESIRED" ] && [ "$READY" -ge 3 ]; then
            log_success "RabbitMQ cluster ready ($READY/$DESIRED replicas)"
        else
            log_warning "RabbitMQ cluster not fully ready ($READY/$DESIRED replicas)"
        fi
    else
        log_error "RabbitMQ StatefulSet not found"
    fi
    
    # Check pods
    ((TOTAL_CHECKS++))
    RABBITMQ_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq --no-headers 2>/dev/null | wc -l)
    if [ "$RABBITMQ_PODS" -ge 3 ]; then
        log_success "RabbitMQ pods running ($RABBITMQ_PODS)"
    else
        log_warning "RabbitMQ pods: $RABBITMQ_PODS (expected 3+)"
    fi
    
    # Check connectivity
    ((TOTAL_CHECKS++))
    RABBITMQ_POD=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$RABBITMQ_POD" ]; then
        if kubectl exec -n "$NAMESPACE" "$RABBITMQ_POD" -- rabbitmq-diagnostics -q ping &> /dev/null; then
            log_success "RabbitMQ is responding to ping"
        else
            log_error "RabbitMQ is not responding"
        fi
    fi
    
    # Check cluster status
    ((TOTAL_CHECKS++))
    if [ -n "$RABBITMQ_POD" ]; then
        if kubectl exec -n "$NAMESPACE" "$RABBITMQ_POD" -- rabbitmqctl cluster_status &> /dev/null; then
            log_success "RabbitMQ cluster status verified"
        else
            log_warning "Could not verify RabbitMQ cluster status"
        fi
    fi
    
    # Check storage
    ((TOTAL_CHECKS++))
    RABBITMQ_PVC=$(kubectl get pvc -n "$NAMESPACE" -l app=rabbitmq --no-headers 2>/dev/null | wc -l)
    if [ "$RABBITMQ_PVC" -ge 3 ]; then
        log_success "RabbitMQ persistent storage configured ($RABBITMQ_PVC PVCs)"
    else
        log_warning "RabbitMQ PVCs: $RABBITMQ_PVC (expected 3+)"
    fi
}

verify_redis() {
    log_section "4. Redis Cluster Verification"
    
    # Check Redis pods
    ((TOTAL_CHECKS++))
    REDIS_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)
    if [ "$REDIS_PODS" -ge 3 ]; then
        log_success "Redis pods running ($REDIS_PODS)"
    else
        log_warning "Redis pods: $REDIS_PODS (expected 3+)"
    fi
    
    # Check Sentinel pods
    ((TOTAL_CHECKS++))
    SENTINEL_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=redis-sentinel --no-headers 2>/dev/null | wc -l)
    if [ "$SENTINEL_PODS" -ge 3 ]; then
        log_success "Redis Sentinel pods running ($SENTINEL_PODS)"
    else
        log_warning "Sentinel pods: $SENTINEL_PODS (expected 3+)"
    fi
    
    # Check Redis connectivity
    ((TOTAL_CHECKS++))
    REDIS_POD=$(kubectl get pods -n "$NAMESPACE" -l app=redis-cluster -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$REDIS_POD" ]; then
        if kubectl exec -it "$REDIS_POD" -n "$NAMESPACE" -- redis-cli ping &> /dev/null; then
            log_success "Redis is responding to ping"
        else
            log_error "Redis is not responding"
        fi
    fi
    
    # Check replication
    ((TOTAL_CHECKS++))
    if [ -n "$REDIS_POD" ]; then
        SLAVES=$(kubectl exec -it "$REDIS_POD" -n "$NAMESPACE" -- redis-cli info replication 2>/dev/null | grep "connected_slaves:" | cut -d: -f2 | tr -d '\r' || echo "0")
        if [ "$SLAVES" -ge 2 ]; then
            log_success "Redis replication healthy ($SLAVES slaves connected)"
        else
            log_warning "Redis replication: $SLAVES slaves (expected 2+)"
        fi
    fi
    
    # Check storage
    ((TOTAL_CHECKS++))
    REDIS_PVC=$(kubectl get pvc -n "$NAMESPACE" -l app=redis-cluster --no-headers 2>/dev/null | wc -l)
    if [ "$REDIS_PVC" -ge 3 ]; then
        log_success "Redis persistent storage configured ($REDIS_PVC PVCs)"
    else
        log_warning "Redis PVCs: $REDIS_PVC (expected 3+)"
    fi
}

verify_postgresql() {
    log_section "5. PostgreSQL Database Verification"
    
    # Check pods
    ((TOTAL_CHECKS++))
    POSTGRES_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=postgres --no-headers 2>/dev/null | wc -l)
    if [ "$POSTGRES_PODS" -eq 3 ]; then
        log_success "PostgreSQL pods running ($POSTGRES_PODS)"
    else
        log_warning "PostgreSQL pods: $POSTGRES_PODS (expected 3)"
    fi
    
    # Check connectivity
    ((TOTAL_CHECKS++))
    POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$POSTGRES_POD" ]; then
        if kubectl exec -it "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U postgres -c "SELECT 1" &> /dev/null; then
            log_success "PostgreSQL is responding"
        else
            log_error "PostgreSQL is not responding"
        fi
    fi
    
    # Check replication
    ((TOTAL_CHECKS++))
    if [ -n "$POSTGRES_POD" ]; then
        REPLICAS=$(kubectl exec -it "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U postgres -c "SELECT COUNT(*) FROM pg_stat_replication;" 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")
        if [ "$REPLICAS" -ge 2 ]; then
            log_success "PostgreSQL replication active ($REPLICAS replicas)"
        else
            log_warning "PostgreSQL replicas: $REPLICAS (expected 2+)"
        fi
    fi
    
    # Check storage
    ((TOTAL_CHECKS++))
    POSTGRES_PVC=$(kubectl get pvc -n "$NAMESPACE" -l app=postgres --no-headers 2>/dev/null | wc -l)
    if [ "$POSTGRES_PVC" -ge 3 ]; then
        log_success "PostgreSQL persistent storage configured ($POSTGRES_PVC PVCs)"
    else
        log_warning "PostgreSQL PVCs: $POSTGRES_PVC (expected 3+)"
    fi
    
    # Check backup CronJob
    ((TOTAL_CHECKS++))
    if kubectl get cronjob -n "$NAMESPACE" postgres-backup &> /dev/null; then
        log_success "PostgreSQL backup CronJob configured"
    else
        log_warning "PostgreSQL backup CronJob not found"
    fi
}

verify_monitoring_stack() {
    log_section "6. Monitoring Stack Verification"
    
    # Check Prometheus
    ((TOTAL_CHECKS++))
    if kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" &> /dev/null; then
        PROM_READY=$(kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$PROM_READY" -gt 0 ]; then
            log_success "Prometheus deployment ready"
        else
            log_warning "Prometheus deployment not ready"
        fi
    else
        log_error "Prometheus deployment not found"
    fi
    
    # Check Grafana
    ((TOTAL_CHECKS++))
    if kubectl get deployment grafana -n "$MONITORING_NAMESPACE" &> /dev/null; then
        GRAFANA_READY=$(kubectl get deployment grafana -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$GRAFANA_READY" -gt 0 ]; then
            log_success "Grafana deployment ready"
        else
            log_warning "Grafana deployment not ready"
        fi
    else
        log_error "Grafana deployment not found"
    fi
    
    # Check Jaeger
    ((TOTAL_CHECKS++))
    if kubectl get deployment jaeger -n "$MONITORING_NAMESPACE" &> /dev/null; then
        JAEGER_READY=$(kubectl get deployment jaeger -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$JAEGER_READY" -gt 0 ]; then
            log_success "Jaeger deployment ready"
        else
            log_warning "Jaeger deployment not ready"
        fi
    else
        log_error "Jaeger deployment not found"
    fi
    
    # Check Loki
    ((TOTAL_CHECKS++))
    if kubectl get deployment loki -n "$MONITORING_NAMESPACE" &> /dev/null; then
        LOKI_READY=$(kubectl get deployment loki -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$LOKI_READY" -gt 0 ]; then
            log_success "Loki deployment ready"
        else
            log_warning "Loki deployment not ready"
        fi
    else
        log_error "Loki deployment not found"
    fi
    
    # Check Alertmanager
    ((TOTAL_CHECKS++))
    if kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" &> /dev/null; then
        ALERT_READY=$(kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$ALERT_READY" -gt 0 ]; then
            log_success "Alertmanager deployment ready"
        else
            log_warning "Alertmanager deployment not ready"
        fi
    else
        log_error "Alertmanager deployment not found"
    fi
    
    # Check metrics collection
    ((TOTAL_CHECKS++))
    SERVICEMONITORS=$(kubectl get servicemonitor -n "$MONITORING_NAMESPACE" --no-headers 2>/dev/null | wc -l)
    if [ "$SERVICEMONITORS" -gt 0 ]; then
        log_success "ServiceMonitors configured ($SERVICEMONITORS)"
    else
        log_warning "No ServiceMonitors found"
    fi
}

verify_microservices_routing() {
    log_section "7. Microservices Routing Verification"
    
    # List of 16 microservices
    MICROSERVICES=(
        "auth-service"
        "user-profile-service"
        "workout-service"
        "xp-service"
        "achievement-service"
        "leaderboard-service"
        "streak-service"
        "activity-feed-service"
        "body-tracking-service"
        "progress-tracking-service"
        "muscle-group-rank-service"
        "friend-service"
        "challenge-service"
        "route-service"
        "sync-service"
        "fraud-detection-service"
    )
    
    log_info "Checking routing for ${#MICROSERVICES[@]} microservices..."
    
    for service in "${MICROSERVICES[@]}"; do
        ((TOTAL_CHECKS++))
        if kubectl get svc "$service" -n "$NAMESPACE" &> /dev/null; then
            log_success "Service '$service' exists"
        else
            log_warning "Service '$service' not found"
        fi
    done
}

print_summary() {
    log_section "Checkpoint Summary"
    
    TOTAL=$((PASSED_CHECKS + FAILED_CHECKS + WARNING_CHECKS))
    
    echo ""
    echo -e "${GREEN}Passed:  $PASSED_CHECKS${NC}"
    echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
    echo -e "${RED}Failed:  $FAILED_CHECKS${NC}"
    echo -e "Total:   $TOTAL${NC}"
    echo ""
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ All critical checks passed!${NC}"
        echo -e "${GREEN}Infrastructure is operational and ready for deployment.${NC}"
        return 0
    else
        echo -e "${RED}✗ Some critical checks failed.${NC}"
        echo -e "${RED}Please review the output above and address any issues.${NC}"
        return 1
    fi
}

# Run main verification
main "$@"
