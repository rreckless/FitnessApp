#!/bin/bash

# FitQuest kubectl Configuration Script
# This script configures kubectl access to the Kubernetes cluster

set -e

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-fitquest-cluster}"
CONTEXT_NAME="${CONTEXT_NAME:-fitquest-context}"
CLOUD_PROVIDER="${CLOUD_PROVIDER:-aws}"
REGION="${AWS_REGION:-us-east-1}"

echo "=========================================="
echo "FitQuest kubectl Configuration"
echo "=========================================="
echo "Cluster Name: $CLUSTER_NAME"
echo "Context Name: $CONTEXT_NAME"
echo "Cloud Provider: $CLOUD_PROVIDER"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }

# Configure based on cloud provider
case $CLOUD_PROVIDER in
  aws)
    echo "Configuring for AWS EKS..."
    command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed."; exit 1; }
    
    # Update kubeconfig
    echo "Updating kubeconfig for EKS cluster..."
    aws eks update-kubeconfig \
      --name $CLUSTER_NAME \
      --region $REGION \
      --alias $CONTEXT_NAME
    ;;
  
  azure)
    echo "Configuring for Azure AKS..."
    command -v az >/dev/null 2>&1 || { echo "Azure CLI is required but not installed."; exit 1; }
    
    RESOURCE_GROUP="${RESOURCE_GROUP:-fitquest-rg}"
    
    # Get cluster credentials
    echo "Getting AKS cluster credentials..."
    az aks get-credentials \
      --resource-group $RESOURCE_GROUP \
      --name $CLUSTER_NAME \
      --overwrite-existing
    ;;
  
  onprem)
    echo "Configuring for on-premises cluster..."
    echo "Please provide the kubeconfig file path:"
    read -p "Kubeconfig path: " KUBECONFIG_PATH
    
    if [ ! -f "$KUBECONFIG_PATH" ]; then
      echo "Kubeconfig file not found: $KUBECONFIG_PATH"
      exit 1
    fi
    
    # Merge kubeconfig
    export KUBECONFIG="$HOME/.kube/config:$KUBECONFIG_PATH"
    kubectl config view --flatten > /tmp/kubeconfig-merged
    mv /tmp/kubeconfig-merged ~/.kube/config
    chmod 600 ~/.kube/config
    ;;
  
  *)
    echo "Unknown cloud provider: $CLOUD_PROVIDER"
    exit 1
    ;;
esac

# Verify cluster access
echo ""
echo "Verifying cluster access..."
if kubectl cluster-info > /dev/null 2>&1; then
  echo "✓ Cluster access verified"
else
  echo "✗ Failed to access cluster"
  exit 1
fi

# Get cluster info
echo ""
echo "Cluster Information:"
kubectl cluster-info
echo ""

# Get nodes
echo "Cluster Nodes:"
kubectl get nodes -o wide
echo ""

# Get namespaces
echo "Namespaces:"
kubectl get namespaces
echo ""

# Create kubeconfig context
echo "Creating kubectl context..."
kubectl config set-context $CONTEXT_NAME \
  --cluster=$(kubectl config current-context | cut -d'/' -f1) \
  --user=$(kubectl config current-context | cut -d'/' -f2)

# Use the context
echo "Using context: $CONTEXT_NAME"
kubectl config use-context $CONTEXT_NAME

# Create kubeconfig backup
echo ""
echo "Creating kubeconfig backup..."
mkdir -p ~/.kube/backups
cp ~/.kube/config ~/.kube/backups/config-$(date +%Y%m%d-%H%M%S).bak
echo "Backup created at ~/.kube/backups/"

# Create kubeconfig for CI/CD
echo ""
echo "Creating kubeconfig for CI/CD..."
mkdir -p .kube
kubectl config view --raw > .kube/kubeconfig-ci.yaml
chmod 600 .kube/kubeconfig-ci.yaml
echo "CI/CD kubeconfig created at .kube/kubeconfig-ci.yaml"

# Create service account for CI/CD
echo ""
echo "Creating service account for CI/CD..."
kubectl create serviceaccount ci-cd-user -n fitquest --dry-run=client -o yaml | kubectl apply -f -

# Create cluster role binding for CI/CD
kubectl create clusterrolebinding ci-cd-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=fitquest:ci-cd-user \
  --dry-run=client -o yaml | kubectl apply -f -

# Get CI/CD token
echo ""
echo "Getting CI/CD service account token..."
CI_CD_TOKEN=$(kubectl get secret \
  $(kubectl get secret -n fitquest | grep ci-cd-user-token | awk '{print $1}') \
  -n fitquest \
  -o jsonpath='{.data.token}' | base64 --decode)

echo "CI/CD Service Account Token:"
echo "$CI_CD_TOKEN"
echo ""
echo "⚠️  Save this token securely! It will be used for CI/CD authentication."

# Create GitHub Actions secret file
echo ""
echo "Creating GitHub Actions secret file..."
mkdir -p .github/workflows
cat > .github/workflows/kubeconfig-secret.txt <<EOF
KUBECONFIG_CONTENT=$(cat .kube/kubeconfig-ci.yaml | base64)
CI_CD_TOKEN=$CI_CD_TOKEN
EOF

echo "GitHub Actions secret file created at .github/workflows/kubeconfig-secret.txt"

# Verify namespaces
echo ""
echo "Verifying namespaces..."
for ns in fitquest monitoring ingress; do
  if kubectl get namespace $ns > /dev/null 2>&1; then
    echo "✓ Namespace $ns exists"
  else
    echo "✗ Namespace $ns not found"
  fi
done

echo ""
echo "=========================================="
echo "kubectl Configuration Complete!"
echo "=========================================="
echo ""
echo "Configuration Details:"
echo "  Context: $CONTEXT_NAME"
echo "  Cluster: $CLUSTER_NAME"
echo "  Cloud Provider: $CLOUD_PROVIDER"
echo ""
echo "Useful commands:"
echo "  kubectl config current-context          # Show current context"
echo "  kubectl config use-context $CONTEXT_NAME # Switch context"
echo "  kubectl get nodes                       # List nodes"
echo "  kubectl get pods -n fitquest            # List pods in fitquest namespace"
echo "  kubectl logs -n fitquest <pod-name>     # View pod logs"
echo "  kubectl describe pod -n fitquest <pod>  # Describe pod"
echo ""
