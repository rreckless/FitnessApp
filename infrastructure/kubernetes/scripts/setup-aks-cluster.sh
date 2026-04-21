#!/bin/bash

# FitQuest Azure AKS Cluster Setup Script
# This script creates an Azure AKS cluster with proper networking, security, and monitoring

set -e

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-fitquest-cluster}"
RESOURCE_GROUP="${RESOURCE_GROUP:-fitquest-rg}"
REGION="${AZURE_REGION:-eastus}"
NODE_COUNT="${NODE_COUNT:-3}"
MIN_NODES="${MIN_NODES:-3}"
MAX_NODES="${MAX_NODES:-10}"
VM_SIZE="${VM_SIZE:-Standard_B2s}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.27}"

echo "=========================================="
echo "FitQuest Azure AKS Cluster Setup"
echo "=========================================="
echo "Cluster Name: $CLUSTER_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Region: $REGION"
echo "Node Count: $NODE_COUNT"
echo "VM Size: $VM_SIZE"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v az >/dev/null 2>&1 || { echo "Azure CLI is required but not installed."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }

# Login to Azure
echo "Logging in to Azure..."
az login

# Create resource group
echo ""
echo "Creating resource group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $REGION

# Create AKS cluster
echo ""
echo "Creating AKS cluster (this may take 10-15 minutes)..."
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count $NODE_COUNT \
  --vm-set-type VirtualMachineScaleSets \
  --load-balancer-sku standard \
  --enable-managed-identity \
  --network-plugin azure \
  --network-policy azure \
  --docker-bridge-address 172.17.0.1/16 \
  --service-cidr 10.0.0.0/16 \
  --dns-service-ip 10.0.0.10 \
  --vm-size $VM_SIZE \
  --kubernetes-version $KUBERNETES_VERSION \
  --enable-cluster-autoscaling \
  --min-count $MIN_NODES \
  --max-count $MAX_NODES \
  --enable-addons monitoring \
  --workspace-resource-id "/subscriptions/$(az account show --query id -o tsv)/resourcegroups/$RESOURCE_GROUP/providers/microsoft.operationalinsights/workspaces/$CLUSTER_NAME-workspace" \
  --enable-aad \
  --aad-admin-group-object-ids "$(az ad group show --group 'AKS Admins' --query objectId -o tsv)" \
  --tags "Environment=production" "ManagedBy=kiro"

echo ""
echo "AKS cluster created successfully!"

# Get cluster credentials
echo ""
echo "Getting cluster credentials..."
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --overwrite-existing

# Verify cluster access
echo ""
echo "Verifying cluster access..."
kubectl cluster-info
kubectl get nodes

# Install Azure Load Balancer Controller
echo ""
echo "Installing Azure Load Balancer Controller..."
helm repo add azure https://raw.githubusercontent.com/Azure/application-gateway-kubernetes-ingress/master/helm/repo
helm repo update
helm install azure-ingress-controller azure/ingress-azure \
  --set appgw.subscriptionId="$(az account show --query id -o tsv)" \
  --set appgw.resourceGroup=$RESOURCE_GROUP \
  --set appgw.name="$CLUSTER_NAME-appgw" \
  --set armAuth.type=aadPodIdentity \
  --set rbac.enabled=true

# Install Metrics Server
echo ""
echo "Installing Metrics Server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Install Azure Disk CSI Driver
echo ""
echo "Installing Azure Disk CSI Driver..."
az aks enable-addons \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --addons azure-disk-csi-driver

# Install Azure File CSI Driver
echo ""
echo "Installing Azure File CSI Driver..."
az aks enable-addons \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --addons azure-file-csi-driver

# Create storage class
echo ""
echo "Creating storage classes..."
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-disk-standard
provisioner: disk.csi.azure.com
parameters:
  skuname: Standard_LRS
  kind: Managed
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-file-standard
provisioner: file.csi.azure.com
parameters:
  skuName: Standard_LRS
allowVolumeExpansion: true
EOF

echo ""
echo "=========================================="
echo "AKS Cluster Setup Complete!"
echo "=========================================="
echo ""
echo "Cluster Details:"
echo "  Name: $CLUSTER_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Region: $REGION"
echo "  Kubernetes Version: $KUBERNETES_VERSION"
echo ""
echo "Next steps:"
echo "  1. Create namespaces: kubectl apply -f namespaces/"
echo "  2. Deploy microservices: kubectl apply -f deployments/"
echo "  3. Verify setup: ./scripts/verify-cluster.sh"
echo ""
