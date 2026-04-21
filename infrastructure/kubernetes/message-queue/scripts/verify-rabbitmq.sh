#!/bin/bash

# RabbitMQ Verification Script
# This script verifies RabbitMQ deployment and connectivity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

check_statefulset() {
    log_section "Checking StatefulSet Status"
    
    local ready=$(kubectl get statefulset rabbitmq -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
    local desired=$(kubectl get statefulset rabbitmq -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    
    if [ "$ready" == "$desired" ]; then
        log_info "StatefulSet is ready: $ready/$desired replicas"
        return 0
    else
        log_error "StatefulSet is not ready: $ready/$desired replicas"
        return 1
    fi
}

check_pods() {
    log_section "Checking Pod Status"
    
    local pods=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$pods" ]; then
        log_error "No RabbitMQ pods found"
        return 1
    fi
    
    for pod in $pods; do
        local status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        if [ "$status" == "Running" ]; then
            log_info "Pod $pod is Running"
        else
            log_error "Pod $pod is $status"
            return 1
        fi
    done
    
    return 0
}

check_cluster_status() {
    log_section "Checking RabbitMQ Cluster Status"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No RabbitMQ pod found"
        return 1
    fi
    
    log_info "Checking cluster status from pod: $pod"
    
    kubectl exec -n "$NAMESPACE" "$pod" -- rabbitmqctl cluster_status
    
    return 0
}

check_exchanges() {
    log_section "Checking Exchanges"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No RabbitMQ pod found"
        return 1
    fi
    
    local exchanges=$(kubectl exec -n "$NAMESPACE" "$pod" -- rabbitmqctl list_exchanges name type durable -q)
    
    local expected_exchanges=(
        "fitquest.events.workout"
        "fitquest.events.progression"
        "fitquest.events.streak"
        "fitquest.events.achievement"
        "fitquest.events.social"
        "fitquest.events.subscription"
        "fitquest.dlx.workout"
        "fitquest.dlx.progression"
        "fitquest.dlx.streak"
        "fitquest.dlx.achievement"
        "fitquest.dlx.social"
        "fitquest.dlx.subscription"
    )
    
    for exchange in "${expected_exchanges[@]}"; do
        if echo "$exchanges" | grep -q "$exchange"; then
            log_info "Exchange found: $exchange"
        else
            log_warn "Exchange not found: $exchange"
        fi
    done
    
    return 0
}

check_queues() {
    log_section "Checking Queues"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No RabbitMQ pod found"
        return 1
    fi
    
    local queues=$(kubectl exec -n "$NAMESPACE" "$pod" -- rabbitmqctl list_queues name durable messages consumers -q)
    
    local expected_queues=(
        "xp-service-workout-completed"
        "achievement-service-workout-completed"
        "activity-feed-service-workout-completed"
        "leaderboard-service-levelup"
        "achievement-service-levelup"
        "activity-feed-service-levelup"
        "achievement-service-rankup"
        "activity-feed-service-rankup"
        "achievement-service-streak-milestone"
        "activity-feed-service-streak-milestone"
        "activity-feed-service-achievement-unlocked"
        "activity-feed-service-friendship-created"
        "feature-gating-service-subscription-upgraded"
        "workout-completed-dlq"
        "progression-levelup-dlq"
        "progression-rankup-dlq"
        "streak-milestone-dlq"
        "achievement-unlocked-dlq"
        "social-friendship-created-dlq"
        "subscription-upgraded-dlq"
    )
    
    for queue in "${expected_queues[@]}"; do
        if echo "$queues" | grep -q "$queue"; then
            log_info "Queue found: $queue"
        else
            log_warn "Queue not found: $queue"
        fi
    done
    
    return 0
}

check_connectivity() {
    log_section "Checking Connectivity"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No RabbitMQ pod found"
        return 1
    fi
    
    # Check if RabbitMQ is responding to diagnostics
    if kubectl exec -n "$NAMESPACE" "$pod" -- rabbitmq-diagnostics -q ping; then
        log_info "RabbitMQ is responding to ping"
    else
        log_error "RabbitMQ is not responding to ping"
        return 1
    fi
    
    # Check if RabbitMQ is running
    if kubectl exec -n "$NAMESPACE" "$pod" -- rabbitmq-diagnostics -q check_running; then
        log_info "RabbitMQ is running"
    else
        log_error "RabbitMQ is not running"
        return 1
    fi
    
    return 0
}

check_services() {
    log_section "Checking Services"
    
    local services=$(kubectl get svc -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$services" ]; then
        log_error "No RabbitMQ services found"
        return 1
    fi
    
    for service in $services; do
        local endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}')
        if [ -z "$endpoints" ]; then
            log_warn "Service $service has no endpoints"
        else
            log_info "Service $service has endpoints: $endpoints"
        fi
    done
    
    return 0
}

check_storage() {
    log_section "Checking Storage"
    
    local pvcs=$(kubectl get pvc -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$pvcs" ]; then
        log_error "No PersistentVolumeClaims found"
        return 1
    fi
    
    for pvc in $pvcs; do
        local status=$(kubectl get pvc "$pvc" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local size=$(kubectl get pvc "$pvc" -n "$NAMESPACE" -o jsonpath='{.spec.resources.requests.storage}')
        
        if [ "$status" == "Bound" ]; then
            log_info "PVC $pvc is Bound (size: $size)"
        else
            log_error "PVC $pvc is $status"
            return 1
        fi
    done
    
    return 0
}

check_metrics() {
    log_section "Checking Metrics"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No RabbitMQ pod found"
        return 1
    fi
    
    # Try to access metrics endpoint
    if kubectl exec -n "$NAMESPACE" "$pod" -- wget -q -O - http://localhost:15692/metrics > /dev/null 2>&1; then
        log_info "Metrics endpoint is accessible"
    else
        log_warn "Metrics endpoint is not accessible"
    fi
    
    return 0
}

main() {
    log_info "Starting RabbitMQ verification..."
    
    local failed=0
    
    check_statefulset || ((failed++))
    check_pods || ((failed++))
    check_services || ((failed++))
    check_storage || ((failed++))
    check_connectivity || ((failed++))
    check_cluster_status || ((failed++))
    check_exchanges || ((failed++))
    check_queues || ((failed++))
    check_metrics || ((failed++))
    
    log_section "Verification Summary"
    
    if [ $failed -eq 0 ]; then
        log_info "All checks passed!"
        return 0
    else
        log_error "$failed check(s) failed"
        return 1
    fi
}

main "$@"
