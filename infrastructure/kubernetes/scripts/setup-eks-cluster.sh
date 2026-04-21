#!/bin/bash

# FitQuest AWS EKS Cluster Setup Script
# This script creates an AWS EKS cluster with proper networking, security, and monitoring

set -e

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-fitquest-cluster}"
REGION="${AWS_REGION:-us-east-1}"
NODE_GROUP_NAME="${NODE_GROUP_NAME:-fitquest-nodes}"
DESIRED_NODES="${DESIRED_NODES:-3}"
MIN_NODES="${MIN_NODES:-3}"
MAX_NODES="${MAX_NODES:-10}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
VPC_CIDR="${VPC_CIDR:-10.0.0.0/16}"
PRIVATE_SUBNET_CIDR="${PRIVATE_SUBNET_CIDR:-10.0.1.0/24}"
PUBLIC_SUBNET_CIDR="${PUBLIC_SUBNET_CIDR:-10.0.0.0/24}"

echo "=========================================="
echo "FitQuest AWS EKS Cluster Setup"
echo "=========================================="
echo "Cluster Name: $CLUSTER_NAME"
echo "Region: $REGION"
echo "Node Group: $NODE_GROUP_NAME"
echo "Desired Nodes: $DESIRED_NODES"
echo "Instance Type: $INSTANCE_TYPE"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }
command -v eksctl >/dev/null 2>&1 || { echo "eksctl is required but not installed."; exit 1; }

# Verify AWS credentials
echo "Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "AWS credentials not configured."; exit 1; }

# Create VPC and subnets
echo ""
echo "Creating VPC and subnets..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $VPC_CIDR \
  --region $REGION \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$CLUSTER_NAME-vpc}]" \
  --query 'Vpc.VpcId' \
  --output text)
echo "VPC created: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region $REGION

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --region $REGION \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$CLUSTER_NAME-igw}]" \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)
echo "Internet Gateway created: $IGW_ID"

# Attach IGW to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID \
  --region $REGION

# Create public subnet
PUBLIC_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $PUBLIC_SUBNET_CIDR \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$CLUSTER_NAME-public-subnet}]" \
  --query 'Subnet.SubnetId' \
  --output text)
echo "Public subnet created: $PUBLIC_SUBNET_ID"

# Create private subnet
PRIVATE_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $PRIVATE_SUBNET_CIDR \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$CLUSTER_NAME-private-subnet}]" \
  --query 'Subnet.SubnetId' \
  --output text)
echo "Private subnet created: $PRIVATE_SUBNET_ID"

# Create route table for public subnet
PUBLIC_RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$CLUSTER_NAME-public-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)
echo "Public route table created: $PUBLIC_RT_ID"

# Add route to IGW
aws ec2 create-route \
  --route-table-id $PUBLIC_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION

# Associate public subnet with route table
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_ID \
  --route-table-id $PUBLIC_RT_ID \
  --region $REGION

# Create security group
echo ""
echo "Creating security group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name $CLUSTER_NAME-sg \
  --description "Security group for $CLUSTER_NAME" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text)
echo "Security group created: $SG_ID"

# Allow inbound traffic
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $REGION

# Create EKS cluster
echo ""
echo "Creating EKS cluster (this may take 10-15 minutes)..."
eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --nodegroup-name $NODE_GROUP_NAME \
  --node-type $INSTANCE_TYPE \
  --nodes $DESIRED_NODES \
  --nodes-min $MIN_NODES \
  --nodes-max $MAX_NODES \
  --vpc-id $VPC_ID \
  --subnets $PUBLIC_SUBNET_ID,$PRIVATE_SUBNET_ID \
  --security-group $SG_ID \
  --managed \
  --enable-ssm \
  --enable-logging \
  --tags "Environment=production,ManagedBy=kiro" \
  --wait

echo ""
echo "EKS cluster created successfully!"

# Update kubeconfig
echo ""
echo "Updating kubeconfig..."
aws eks update-kubeconfig \
  --name $CLUSTER_NAME \
  --region $REGION

# Verify cluster access
echo ""
echo "Verifying cluster access..."
kubectl cluster-info
kubectl get nodes

# Enable OIDC provider for IRSA (IAM Roles for Service Accounts)
echo ""
echo "Enabling OIDC provider for IRSA..."
eksctl utils associate-iam-oidc-provider \
  --cluster=$CLUSTER_NAME \
  --region=$REGION \
  --approve

# Install AWS Load Balancer Controller
echo ""
echo "Installing AWS Load Balancer Controller..."
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=true \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/AmazonEKSLoadBalancerControllerRole"

# Install Metrics Server
echo ""
echo "Installing Metrics Server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Install Cluster Autoscaler
echo ""
echo "Installing Cluster Autoscaler..."
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo update
helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  -n kube-system \
  --set autoDiscovery.clusterName=$CLUSTER_NAME \
  --set awsRegion=$REGION

echo ""
echo "=========================================="
echo "EKS Cluster Setup Complete!"
echo "=========================================="
echo ""
echo "Cluster Details:"
echo "  Name: $CLUSTER_NAME"
echo "  Region: $REGION"
echo "  VPC ID: $VPC_ID"
echo "  Public Subnet: $PUBLIC_SUBNET_ID"
echo "  Private Subnet: $PRIVATE_SUBNET_ID"
echo "  Security Group: $SG_ID"
echo ""
echo "Next steps:"
echo "  1. Create namespaces: kubectl apply -f namespaces/"
echo "  2. Deploy microservices: kubectl apply -f deployments/"
echo "  3. Verify setup: ./scripts/verify-cluster.sh"
echo ""
