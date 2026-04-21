#!/bin/bash

# RabbitMQ Deployment Setup Script
# This script deploys RabbitMQ cluster to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fitquest"
RABBITMQ_RELEASE_NAME="rabbitmq"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$(dirname "$SCRIPT_DIR")/deployment"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")/monitoring"

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

deploy_rbac() {
    log_info "Deploying RBAC resources..."
    kubectl apply -f "$DEPLOYMENT_DIR/rabbitmq-rbac.yaml"
    log_info "RBAC resources deployed"
}

deploy_configmap() {
    log_info "Deploying ConfigMap..."
    kubectl apply -f "$DEPLOYMENT_DIR/rabbitmq-configmap.yaml"
    log_info "ConfigMap deployed"
}

deploy_services() {
    log_info "Deploying Services..."
    kubectl apply -f "$DEPLOYMENT_DIR/rabbitmq-service.yaml"
    log_info "Services deployed"
}

deploy_networkpolicy() {
    log_info "Deploying NetworkPolicy..."
    kubectl apply -f "$DEPLOYMENT_DIR/rabbitmq-networkpolicy.yaml"
    log_info "NetworkPolicy deployed"
}

deploy_statefulset() {
    log_info "Deploying RabbitMQ StatefulSet..."
    kubectl apply -f "$DEPLOYMENT_DIR/rabbitmq-statefulset.yaml"
    log_info "StatefulSet deployed"
    
    # Wait for StatefulSet to be ready
    log_info "Waiting for RabbitMQ StatefulSet to be ready..."
    kubectl rollout status statefulset/rabbitmq -n "$NAMESPACE" --timeout=5m
    log_info "RabbitMQ StatefulSet is ready"
}

deploy_monitoring() {
    log_info "Deploying monitoring rules..."
    
    # Check if monitoring namespace exists
    if kubectl get namespace monitoring &> /dev/null; then
        kubectl apply -f "$MONITORING_DIR/prometheus-rules.yaml"
        log_info "Monitoring rules deployed"
    else
        log_warn "Monitoring namespace not found, skipping monitoring deployment"
    fi
}

initialize_exchanges() {
    log_info "Initializing exchanges and queues..."
    
    # Wait for RabbitMQ to be fully ready
    sleep 10
    
    # Get the first RabbitMQ pod
    RABBITMQ_POD=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$RABBITMQ_POD" ]; then
        log_error "No RabbitMQ pod found"
        exit 1
    fi
    
    log_info "Using RabbitMQ pod: $RABBITMQ_POD"
    
    # Execute initialization script
    kubectl exec -n "$NAMESPACE" "$RABBITMQ_POD" -- /bin/sh -c '
        set -e
        
        echo "Initializing RabbitMQ exchanges and queues..."
        
        # Declare exchanges
        rabbitmqctl declare_exchange fitquest.events.workout topic --durable
        rabbitmqctl declare_exchange fitquest.events.progression topic --durable
        rabbitmqctl declare_exchange fitquest.events.streak topic --durable
        rabbitmqctl declare_exchange fitquest.events.achievement topic --durable
        rabbitmqctl declare_exchange fitquest.events.social topic --durable
        rabbitmqctl declare_exchange fitquest.events.subscription topic --durable
        
        # Declare dead letter exchanges
        rabbitmqctl declare_exchange fitquest.dlx.workout topic --durable
        rabbitmqctl declare_exchange fitquest.dlx.progression topic --durable
        rabbitmqctl declare_exchange fitquest.dlx.streak topic --durable
        rabbitmqctl declare_exchange fitquest.dlx.achievement topic --durable
        rabbitmqctl declare_exchange fitquest.dlx.social topic --durable
        rabbitmqctl declare_exchange fitquest.dlx.subscription topic --durable
        
        # Declare queues with dead letter routing
        rabbitmqctl declare_queue xp-service-workout-completed --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.workout\",\"x-dead-letter-routing-key\":\"workout.completed.dlq\"}"
        rabbitmqctl declare_queue achievement-service-workout-completed --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.workout\",\"x-dead-letter-routing-key\":\"workout.completed.dlq\"}"
        rabbitmqctl declare_queue activity-feed-service-workout-completed --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.workout\",\"x-dead-letter-routing-key\":\"workout.completed.dlq\"}"
        
        rabbitmqctl declare_queue leaderboard-service-levelup --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.progression\",\"x-dead-letter-routing-key\":\"progression.levelup.dlq\"}"
        rabbitmqctl declare_queue achievement-service-levelup --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.progression\",\"x-dead-letter-routing-key\":\"progression.levelup.dlq\"}"
        rabbitmqctl declare_queue activity-feed-service-levelup --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.progression\",\"x-dead-letter-routing-key\":\"progression.levelup.dlq\"}"
        
        rabbitmqctl declare_queue achievement-service-rankup --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.progression\",\"x-dead-letter-routing-key\":\"progression.rankup.dlq\"}"
        rabbitmqctl declare_queue activity-feed-service-rankup --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.progression\",\"x-dead-letter-routing-key\":\"progression.rankup.dlq\"}"
        
        rabbitmqctl declare_queue achievement-service-streak-milestone --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.streak\",\"x-dead-letter-routing-key\":\"streak.milestone.dlq\"}"
        rabbitmqctl declare_queue activity-feed-service-streak-milestone --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.streak\",\"x-dead-letter-routing-key\":\"streak.milestone.dlq\"}"
        
        rabbitmqctl declare_queue activity-feed-service-achievement-unlocked --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.achievement\",\"x-dead-letter-routing-key\":\"achievement.unlocked.dlq\"}"
        
        rabbitmqctl declare_queue activity-feed-service-friendship-created --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.social\",\"x-dead-letter-routing-key\":\"social.friendship.created.dlq\"}"
        
        rabbitmqctl declare_queue feature-gating-service-subscription-upgraded --durable --arguments "{\"x-dead-letter-exchange\":\"fitquest.dlx.subscription\",\"x-dead-letter-routing-key\":\"subscription.upgraded.dlq\"}"
        
        # Declare dead letter queues
        rabbitmqctl declare_queue workout-completed-dlq --durable
        rabbitmqctl declare_queue progression-levelup-dlq --durable
        rabbitmqctl declare_queue progression-rankup-dlq --durable
        rabbitmqctl declare_queue streak-milestone-dlq --durable
        rabbitmqctl declare_queue achievement-unlocked-dlq --durable
        rabbitmqctl declare_queue social-friendship-created-dlq --durable
        rabbitmqctl declare_queue subscription-upgraded-dlq --durable
        
        # Bind queues to exchanges
        rabbitmqctl bind_queue xp-service-workout-completed fitquest.events.workout "workout.completed"
        rabbitmqctl bind_queue achievement-service-workout-completed fitquest.events.workout "workout.completed"
        rabbitmqctl bind_queue activity-feed-service-workout-completed fitquest.events.workout "workout.completed"
        
        rabbitmqctl bind_queue leaderboard-service-levelup fitquest.events.progression "progression.levelup"
        rabbitmqctl bind_queue achievement-service-levelup fitquest.events.progression "progression.levelup"
        rabbitmqctl bind_queue activity-feed-service-levelup fitquest.events.progression "progression.levelup"
        
        rabbitmqctl bind_queue achievement-service-rankup fitquest.events.progression "progression.rankup"
        rabbitmqctl bind_queue activity-feed-service-rankup fitquest.events.progression "progression.rankup"
        
        rabbitmqctl bind_queue achievement-service-streak-milestone fitquest.events.streak "streak.milestone"
        rabbitmqctl bind_queue activity-feed-service-streak-milestone fitquest.events.streak "streak.milestone"
        
        rabbitmqctl bind_queue activity-feed-service-achievement-unlocked fitquest.events.achievement "achievement.unlocked"
        
        rabbitmqctl bind_queue activity-feed-service-friendship-created fitquest.events.social "social.friendship.created"
        
        rabbitmqctl bind_queue feature-gating-service-subscription-upgraded fitquest.events.subscription "subscription.upgraded"
        
        # Bind dead letter queues
        rabbitmqctl bind_queue workout-completed-dlq fitquest.dlx.workout "workout.completed.dlq"
        rabbitmqctl bind_queue progression-levelup-dlq fitquest.dlx.progression "progression.levelup.dlq"
        rabbitmqctl bind_queue progression-rankup-dlq fitquest.dlx.progression "progression.rankup.dlq"
        rabbitmqctl bind_queue streak-milestone-dlq fitquest.dlx.streak "streak.milestone.dlq"
        rabbitmqctl bind_queue achievement-unlocked-dlq fitquest.dlx.achievement "achievement.unlocked.dlq"
        rabbitmqctl bind_queue social-friendship-created-dlq fitquest.dlx.social "social.friendship.created.dlq"
        rabbitmqctl bind_queue subscription-upgraded-dlq fitquest.dlx.subscription "subscription.upgraded.dlq"
        
        echo "RabbitMQ exchanges and queues initialized successfully"
    '
    
    log_info "Exchanges and queues initialized"
}

main() {
    log_info "Starting RabbitMQ deployment..."
    
    check_prerequisites
    deploy_rbac
    deploy_configmap
    deploy_services
    deploy_networkpolicy
    deploy_statefulset
    deploy_monitoring
    initialize_exchanges
    
    log_info "RabbitMQ deployment completed successfully!"
    log_info "RabbitMQ cluster is ready at: rabbitmq.fitquest.svc.cluster.local:5672"
    log_info "Management UI is available at: rabbitmq-management.fitquest.svc.cluster.local:15672"
}

main "$@"
