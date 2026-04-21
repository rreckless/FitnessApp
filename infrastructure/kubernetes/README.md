# FitQuest Kubernetes Infrastructure Setup

This directory contains all Kubernetes configuration files and setup scripts for deploying FitQuest microservices.

## Overview

FitQuest uses Kubernetes for orchestrating 11+ microservices with:
- **Cluster Options**: AWS EKS, Azure AKS, or on-premises Kubernetes
- **Container Registry**: Docker Hub or AWS ECR
- **Namespaces**: fitquest (services), monitoring (observability), ingress (API Gateway)
- **High Availability**: 3+ replicas per service, auto-scaling, health checks

## Quick Start

### Prerequisites
- kubectl installed and configured
- AWS CLI or Azure CLI (depending on your cloud provider)
- Docker installed for building images
- Helm 3+ (optional, for package management)

### 1. Create Kubernetes Cluster

Choose your platform:

#### AWS EKS
```bash
./scripts/setup-eks-cluster.sh
```

#### Azure AKS
```bash
./scripts/setup-aks-cluster.sh
```

#### On-Premises
```bash
./scripts/setup-onprem-cluster.sh
```

### 2. Set Up Container Registry

#### Docker Hub
```bash
./scripts/setup-docker-hub-registry.sh
```

#### AWS ECR
```bash
./scripts/setup-ecr-registry.sh
```

### 3. Configure kubectl Access

```bash
./scripts/configure-kubectl.sh
```

### 4. Create Namespaces

```bash
kubectl apply -f namespaces/
```

### 5. Verify Setup

```bash
./scripts/verify-cluster.sh
```

## Directory Structure

```
kubernetes/
├── README.md                          # This file
├── scripts/                           # Setup and management scripts
│   ├── setup-eks-cluster.sh          # AWS EKS cluster creation
│   ├── setup-aks-cluster.sh          # Azure AKS cluster creation
│   ├── setup-onprem-cluster.sh       # On-premises cluster setup
│   ├── setup-docker-hub-registry.sh  # Docker Hub registry setup
│   ├── setup-ecr-registry.sh         # AWS ECR registry setup
│   ├── configure-kubectl.sh          # kubectl configuration
│   ├── verify-cluster.sh             # Cluster verification
│   └── cleanup.sh                    # Cleanup resources
├── namespaces/                        # Kubernetes namespace definitions
│   ├── fitquest-namespace.yaml       # fitquest namespace
│   ├── monitoring-namespace.yaml     # monitoring namespace
│   └── ingress-namespace.yaml        # ingress namespace
├── config/                            # Configuration files
│   ├── kubeconfig-template.yaml      # kubectl config template
│   └── registry-secrets.yaml         # Registry credentials
└── docs/                              # Documentation
    ├── SETUP_GUIDE.md                # Detailed setup guide
    ├── TROUBLESHOOTING.md            # Common issues and solutions
    └── ARCHITECTURE.md               # Infrastructure architecture
```

## Supported Platforms

### AWS EKS
- **Region**: Configurable (default: us-east-1)
- **Node Groups**: 3+ nodes for HA
- **Instance Type**: t3.medium or larger
- **Networking**: VPC with public/private subnets
- **Storage**: EBS volumes for persistent data

### Azure AKS
- **Region**: Configurable (default: eastus)
- **Node Pools**: 3+ nodes for HA
- **VM Size**: Standard_B2s or larger
- **Networking**: Azure Virtual Network
- **Storage**: Azure Managed Disks

### On-Premises
- **Kubernetes Version**: 1.24+
- **Nodes**: 3+ master nodes, 3+ worker nodes
- **Networking**: Calico or Flannel CNI
- **Storage**: Local volumes or NFS

## Container Registry Options

### Docker Hub
- **Registry URL**: docker.io
- **Authentication**: Docker Hub credentials
- **Rate Limits**: 100 pulls/6 hours (free tier)
- **Recommended**: For development/testing

### AWS ECR
- **Registry URL**: [account-id].dkr.ecr.[region].amazonaws.com
- **Authentication**: AWS IAM credentials
- **Rate Limits**: No rate limits
- **Recommended**: For production AWS deployments

## Namespaces

### fitquest
- **Purpose**: All FitQuest microservices
- **Services**: 11+ microservices
- **Resource Quota**: 100 CPU, 200Gi memory
- **Network Policy**: Restricted ingress/egress

### monitoring
- **Purpose**: Observability stack
- **Services**: Prometheus, Grafana, Jaeger, ELK Stack
- **Resource Quota**: 50 CPU, 100Gi memory
- **Network Policy**: Restricted ingress/egress

### ingress
- **Purpose**: API Gateway and ingress controllers
- **Services**: Kong/Nginx, Ingress Controller
- **Resource Quota**: 20 CPU, 50Gi memory
- **Network Policy**: Allows external traffic

## Next Steps

1. **Choose your platform** (AWS EKS, Azure AKS, or on-premises)
2. **Run the appropriate setup script** for your platform
3. **Configure kubectl** to access your cluster
4. **Create namespaces** using the provided YAML files
5. **Verify the setup** using the verification script
6. **Deploy microservices** (see Phase 2 tasks)

## Troubleshooting

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions.

## Security Considerations

- All communication is encrypted with TLS 1.2+
- RBAC is enabled for access control
- Network policies restrict traffic between namespaces
- Secrets are stored in Kubernetes Secrets (encrypted at rest)
- Container images are scanned for vulnerabilities
- Pod security policies enforce security standards

## Monitoring and Logging

- **Metrics**: Prometheus collects metrics from all services
- **Visualization**: Grafana dashboards for monitoring
- **Tracing**: Jaeger for distributed tracing
- **Logging**: ELK Stack or Loki for centralized logging
- **Alerting**: PagerDuty integration for critical alerts

## Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
2. Review [SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
3. Check Kubernetes logs: `kubectl logs -n fitquest <pod-name>`
4. Describe resources: `kubectl describe -n fitquest <resource-type> <resource-name>`

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Docker Registry Documentation](https://docs.docker.com/registry/)
