# FitQuest Kubernetes Setup Guide

This guide provides step-by-step instructions for setting up the FitQuest Kubernetes infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS EKS Setup](#aws-eks-setup)
3. [Azure AKS Setup](#azure-aks-setup)
4. [On-Premises Setup](#on-premises-setup)
5. [Container Registry Setup](#container-registry-setup)
6. [kubectl Configuration](#kubectl-configuration)
7. [Namespace Creation](#namespace-creation)
8. [Verification](#verification)

## Prerequisites

### Required Tools

- **kubectl** (1.24+): Kubernetes command-line tool
  ```bash
  # macOS
  brew install kubectl
  
  # Linux
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  ```

- **Docker** (20.10+): Container runtime
  ```bash
  # Install from https://docs.docker.com/get-docker/
  ```

- **Cloud CLI** (choose one):
  - **AWS CLI** (2.0+) for EKS
    ```bash
    brew install awscli
    ```
  - **Azure CLI** (2.0+) for AKS
    ```bash
    brew install azure-cli
    ```

- **Helm** (3.0+): Kubernetes package manager (optional but recommended)
  ```bash
  brew install helm
  ```

### Cloud Account Setup

#### AWS
1. Create AWS account at https://aws.amazon.com
2. Create IAM user with EKS and EC2 permissions
3. Configure AWS CLI:
   ```bash
   aws configure
   ```

#### Azure
1. Create Azure account at https://azure.microsoft.com
2. Create service principal:
   ```bash
   az login
   az account set --subscription <subscription-id>
   ```

## AWS EKS Setup

### Step 1: Install eksctl

```bash
# macOS
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl

# Linux
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### Step 2: Create EKS Cluster

```bash
# Set environment variables
export CLUSTER_NAME=fitquest-cluster
export AWS_REGION=us-east-1
export DESIRED_NODES=3
export INSTANCE_TYPE=t3.medium

# Run setup script
cd infrastructure/kubernetes
chmod +x scripts/setup-eks-cluster.sh
./scripts/setup-eks-cluster.sh
```

This script will:
- Create VPC and subnets
- Create Internet Gateway
- Create security groups
- Create EKS cluster (10-15 minutes)
- Install AWS Load Balancer Controller
- Install Metrics Server
- Install Cluster Autoscaler

### Step 3: Verify Cluster

```bash
kubectl cluster-info
kubectl get nodes
```

## Azure AKS Setup

### Step 1: Create Resource Group

```bash
export RESOURCE_GROUP=fitquest-rg
export AZURE_REGION=eastus

az group create \
  --name $RESOURCE_GROUP \
  --location $AZURE_REGION
```

### Step 2: Create AKS Cluster

```bash
export CLUSTER_NAME=fitquest-cluster
export NODE_COUNT=3
export VM_SIZE=Standard_B2s

chmod +x scripts/setup-aks-cluster.sh
./scripts/setup-aks-cluster.sh
```

This script will:
- Create AKS cluster (10-15 minutes)
- Configure networking
- Install monitoring addon
- Install Azure Load Balancer Controller
- Install Metrics Server
- Create storage classes

### Step 3: Verify Cluster

```bash
kubectl cluster-info
kubectl get nodes
```

## On-Premises Setup

### Step 1: Prerequisites

- 3+ master nodes (4 CPU, 8GB RAM minimum)
- 3+ worker nodes (2 CPU, 4GB RAM minimum)
- Kubernetes 1.24+ installed
- Container runtime (Docker or containerd)
- Network connectivity between all nodes

### Step 2: Initialize Cluster

```bash
# On master node
kubeadm init --pod-network-cidr=10.244.0.0/16

# Copy kubeconfig
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

### Step 3: Install CNI Plugin

```bash
# Install Flannel
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml

# Or install Calico
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/tigera-operator.yaml
```

### Step 4: Join Worker Nodes

```bash
# Get join command from master
kubeadm token create --print-join-command

# On each worker node
kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
```

## Container Registry Setup

### Option 1: AWS ECR

```bash
export AWS_REGION=us-east-1

chmod +x scripts/setup-ecr-registry.sh
./scripts/setup-ecr-registry.sh
```

This creates:
- ECR repositories for each microservice
- IAM policy for ECR access
- CI/CD user with access keys
- Lifecycle policies for image retention

### Option 2: Docker Hub

```bash
export DOCKER_USERNAME=your-username
export DOCKER_PASSWORD=your-password

chmod +x scripts/setup-docker-hub-registry.sh
./scripts/setup-docker-hub-registry.sh
```

This creates:
- Kubernetes secrets for Docker Hub
- GitHub Actions configuration
- Build and push scripts

## kubectl Configuration

### Step 1: Configure kubectl Access

```bash
export CLUSTER_NAME=fitquest-cluster
export CLOUD_PROVIDER=aws  # or azure, onprem

chmod +x scripts/configure-kubectl.sh
./scripts/configure-kubectl.sh
```

### Step 2: Verify Access

```bash
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
```

### Step 3: Create kubeconfig for CI/CD

The script automatically creates:
- `.kube/kubeconfig-ci.yaml` - kubeconfig for CI/CD
- CI/CD service account with cluster-admin role
- GitHub Actions secret file

## Namespace Creation

### Step 1: Create Namespaces

```bash
kubectl apply -f namespaces/
```

This creates:
- **fitquest** - All microservices
- **monitoring** - Observability stack
- **ingress** - API Gateway

### Step 2: Verify Namespaces

```bash
kubectl get namespaces
kubectl get resourcequota -n fitquest
kubectl get networkpolicy -n fitquest
```

### Step 3: Check RBAC

```bash
kubectl get roles -n fitquest
kubectl get rolebindings -n fitquest
kubectl get serviceaccounts -n fitquest
```

## Verification

### Step 1: Run Verification Script

```bash
chmod +x scripts/verify-cluster.sh
./scripts/verify-cluster.sh
```

### Step 2: Manual Verification

```bash
# Check cluster info
kubectl cluster-info

# Check nodes
kubectl get nodes -o wide

# Check namespaces
kubectl get namespaces

# Check resource quotas
kubectl get resourcequota -A

# Check network policies
kubectl get networkpolicy -A

# Check service accounts
kubectl get serviceaccounts -A

# Check RBAC
kubectl get roles -A
kubectl get rolebindings -A

# Check storage classes
kubectl get storageclass

# Check metrics
kubectl top nodes
kubectl top pods -A
```

## Troubleshooting

### Cluster Not Accessible

```bash
# Check kubeconfig
kubectl config view

# Check current context
kubectl config current-context

# Switch context
kubectl config use-context <context-name>

# Verify credentials
aws sts get-caller-identity  # for AWS
az account show              # for Azure
```

### Nodes Not Ready

```bash
# Check node status
kubectl get nodes -o wide

# Describe node
kubectl describe node <node-name>

# Check node logs
kubectl logs -n kube-system <pod-name>

# Check kubelet status
ssh <node-ip>
sudo systemctl status kubelet
sudo journalctl -u kubelet -n 50
```

### Namespace Issues

```bash
# Check namespace status
kubectl get namespace <namespace-name>

# Describe namespace
kubectl describe namespace <namespace-name>

# Check resource quota
kubectl describe resourcequota -n <namespace-name>

# Check network policies
kubectl get networkpolicy -n <namespace-name>
```

### DNS Issues

```bash
# Check DNS pod
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default
```

## Next Steps

1. **Deploy Microservices**: See Phase 2 tasks for microservice deployment
2. **Set Up Monitoring**: Deploy Prometheus, Grafana, and Jaeger
3. **Configure API Gateway**: Deploy Kong or Nginx
4. **Set Up Message Queue**: Deploy RabbitMQ or Azure Service Bus
5. **Configure CI/CD**: Set up GitHub Actions for automated deployment

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
