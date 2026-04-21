#!/bin/bash

# FitQuest CI/CD Setup Script
# This script helps set up the CI/CD pipeline for FitQuest

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}=== $1 ===${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    print_success "kubectl found"
    
    # Check gh CLI
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI not found. Please install gh."
        exit 1
    fi
    print_success "GitHub CLI found"
    
    # Check base64
    if ! command -v base64 &> /dev/null; then
        print_error "base64 not found. Please install base64."
        exit 1
    fi
    print_success "base64 found"
}

# Create Kubernetes namespace
create_namespace() {
    print_header "Creating Kubernetes Namespace"
    
    if kubectl get namespace fitquest &> /dev/null; then
        print_info "Namespace 'fitquest' already exists"
    else
        kubectl create namespace fitquest
        print_success "Namespace 'fitquest' created"
    fi
}

# Create RBAC resources
create_rbac() {
    print_header "Creating RBAC Resources"
    
    kubectl apply -f infrastructure/kubernetes/deployments/rbac.yaml
    print_success "RBAC resources created"
}

# Create ConfigMaps
create_configmaps() {
    print_header "Creating ConfigMaps"
    
    kubectl apply -f infrastructure/kubernetes/deployments/configmap-template.yaml
    print_success "ConfigMaps created"
}

# Create Secrets
create_secrets() {
    print_header "Creating Secrets"
    
    print_info "Please update the secret values in infrastructure/kubernetes/deployments/secret-template.yaml"
    print_info "Then run: kubectl apply -f infrastructure/kubernetes/deployments/secret-template.yaml"
    
    read -p "Have you updated the secrets? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl apply -f infrastructure/kubernetes/deployments/secret-template.yaml
        print_success "Secrets created"
    else
        print_error "Secrets not created. Please update and apply manually."
    fi
}

# Create image pull secret
create_image_pull_secret() {
    print_header "Creating Image Pull Secret"
    
    read -p "Enter GitHub username: " github_user
    read -sp "Enter GitHub token (will not be displayed): " github_token
    echo
    
    kubectl create secret docker-registry ghcr-secret \
        --docker-server=ghcr.io \
        --docker-username="$github_user" \
        --docker-password="$github_token" \
        --docker-email="$github_user@users.noreply.github.com" \
        -n fitquest \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Image pull secret created"
}

# Setup GitHub secrets
setup_github_secrets() {
    print_header "Setting Up GitHub Secrets"
    
    # Check if authenticated with GitHub CLI
    if ! gh auth status &> /dev/null; then
        print_error "Not authenticated with GitHub CLI. Please run: gh auth login"
        exit 1
    fi
    
    print_info "Generating kubeconfig for staging cluster..."
    read -p "Enter staging cluster context name (or press Enter to skip): " staging_context
    
    if [ -n "$staging_context" ]; then
        kubectl config view --raw --flatten --context="$staging_context" > /tmp/kube-config-staging
        kube_config_staging=$(base64 -i /tmp/kube-config-staging | tr -d '\n')
        gh secret set KUBE_CONFIG_STAGING --body "$kube_config_staging"
        print_success "KUBE_CONFIG_STAGING secret set"
        rm /tmp/kube-config-staging
    fi
    
    print_info "Generating kubeconfig for production cluster..."
    read -p "Enter production cluster context name (or press Enter to skip): " prod_context
    
    if [ -n "$prod_context" ]; then
        kubectl config view --raw --flatten --context="$prod_context" > /tmp/kube-config-prod
        kube_config_prod=$(base64 -i /tmp/kube-config-prod | tr -d '\n')
        gh secret set KUBE_CONFIG_PRODUCTION --body "$kube_config_prod"
        print_success "KUBE_CONFIG_PRODUCTION secret set"
        rm /tmp/kube-config-prod
    fi
    
    print_info "Setting up additional secrets..."
    read -p "Enter Slack webhook URL (or press Enter to skip): " slack_webhook
    if [ -n "$slack_webhook" ]; then
        gh secret set SLACK_WEBHOOK_URL --body "$slack_webhook"
        print_success "SLACK_WEBHOOK_URL secret set"
    fi
}

# Verify setup
verify_setup() {
    print_header "Verifying Setup"
    
    # Check namespace
    if kubectl get namespace fitquest &> /dev/null; then
        print_success "Namespace 'fitquest' exists"
    else
        print_error "Namespace 'fitquest' not found"
        return 1
    fi
    
    # Check RBAC
    if kubectl get serviceaccount fitquest-sa -n fitquest &> /dev/null; then
        print_success "Service account 'fitquest-sa' exists"
    else
        print_error "Service account 'fitquest-sa' not found"
        return 1
    fi
    
    # Check ConfigMaps
    if kubectl get configmap fitquest-config -n fitquest &> /dev/null; then
        print_success "ConfigMap 'fitquest-config' exists"
    else
        print_error "ConfigMap 'fitquest-config' not found"
        return 1
    fi
    
    # Check Secrets
    if kubectl get secret fitquest-secrets -n fitquest &> /dev/null; then
        print_success "Secret 'fitquest-secrets' exists"
    else
        print_error "Secret 'fitquest-secrets' not found"
        return 1
    fi
    
    # Check image pull secret
    if kubectl get secret ghcr-secret -n fitquest &> /dev/null; then
        print_success "Image pull secret 'ghcr-secret' exists"
    else
        print_error "Image pull secret 'ghcr-secret' not found"
        return 1
    fi
    
    # Check GitHub secrets
    print_info "Checking GitHub secrets..."
    if gh secret list | grep -q "KUBE_CONFIG_STAGING"; then
        print_success "GitHub secret 'KUBE_CONFIG_STAGING' exists"
    else
        print_error "GitHub secret 'KUBE_CONFIG_STAGING' not found"
    fi
}

# Main menu
main_menu() {
    print_header "FitQuest CI/CD Setup"
    
    echo "Select an option:"
    echo "1. Full setup (all steps)"
    echo "2. Create Kubernetes namespace"
    echo "3. Create RBAC resources"
    echo "4. Create ConfigMaps"
    echo "5. Create Secrets"
    echo "6. Create image pull secret"
    echo "7. Setup GitHub secrets"
    echo "8. Verify setup"
    echo "9. Exit"
    
    read -p "Enter your choice (1-9): " choice
    
    case $choice in
        1)
            check_prerequisites
            create_namespace
            create_rbac
            create_configmaps
            create_secrets
            create_image_pull_secret
            setup_github_secrets
            verify_setup
            ;;
        2)
            create_namespace
            ;;
        3)
            create_rbac
            ;;
        4)
            create_configmaps
            ;;
        5)
            create_secrets
            ;;
        6)
            create_image_pull_secret
            ;;
        7)
            setup_github_secrets
            ;;
        8)
            verify_setup
            ;;
        9)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please try again."
            main_menu
            ;;
    esac
}

# Run main menu
main_menu

print_header "Setup Complete"
print_success "CI/CD pipeline is ready!"
print_info "Next steps:"
print_info "1. Review and update secrets in infrastructure/kubernetes/deployments/secret-template.yaml"
print_info "2. Deploy microservices: kubectl apply -f infrastructure/kubernetes/deployments/"
print_info "3. Monitor deployment: kubectl get pods -n fitquest"
print_info "4. Check logs: kubectl logs -n fitquest -l app=AuthenticationService"
