# FitQuest Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the FitQuest infrastructure using Infrastructure-as-Code templates.

## Prerequisites

- AWS Account with appropriate permissions
- Terraform >= 1.0
- kubectl >= 1.28
- Docker
- AWS CLI configured with credentials
- GitHub account for CI/CD

## Phase 1: Infrastructure Setup

### Step 1: Deploy AWS Infrastructure with Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -out=tfplan

# Apply the configuration
terraform apply tfplan
```

This will create:
- VPC with public and private subnets
- EKS cluster with 3 worker nodes
- ECR repository for Docker images
- NAT Gateways for private subnet internet access
- Internet Gateway for public subnet access

### Step 2: Configure kubectl

```bash
# Update kubeconfig to access the EKS cluster
aws eks update-kubeconfig --name fitquest-cluster --region us-east-1

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Step 3: Deploy Kubernetes Infrastructure

```bash
cd infrastructure/kubernetes

# Create namespaces
kubectl apply -f namespace.yaml

# Deploy Redis cluster
kubectl apply -f redis-deployment.yaml

# Deploy PostgreSQL database
kubectl apply -f postgresql-deployment.yaml

# Deploy RabbitMQ message queue
kubectl apply -f rabbitmq-deployment.yaml

# Deploy API Gateway
kubectl apply -f api-gateway-deployment.yaml

# Deploy monitoring stack
kubectl apply -f monitoring-deployment.yaml
```

### Step 4: Verify Deployments

```bash
# Check all pods are running
kubectl get pods -n fitquest
kubectl get pods -n monitoring

# Check services
kubectl get svc -n fitquest
kubectl get svc -n monitoring

# Check persistent volumes
kubectl get pvc -n fitquest
```

### Step 5: Access Services

#### PostgreSQL
```bash
# Get PostgreSQL service endpoint
kubectl get svc postgresql -n fitquest

# Connect to PostgreSQL (from within cluster)
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- \
  psql -h postgresql.fitquest.svc.cluster.local -U fitquest -d fitquest_users
```

#### Redis
```bash
# Get Redis service endpoint
kubectl get svc redis -n fitquest

# Connect to Redis (from within cluster)
kubectl run -it --rm debug --image=redis:7 --restart=Never -- \
  redis-cli -h redis.fitquest.svc.cluster.local
```

#### RabbitMQ Management
```bash
# Get RabbitMQ management UI endpoint
kubectl get svc rabbitmq-management -n fitquest

# Port forward to access management UI
kubectl port-forward svc/rabbitmq-management 15672:15672 -n fitquest

# Access at http://localhost:15672
# Default credentials: fitquest / changeme-secure-password
```

#### Grafana
```bash
# Get Grafana service endpoint
kubectl get svc grafana -n monitoring

# Port forward to access Grafana
kubectl port-forward svc/grafana 3000:3000 -n monitoring

# Access at http://localhost:3000
# Default credentials: admin / changeme-secure-password
```

#### Prometheus
```bash
# Get Prometheus service endpoint
kubectl get svc prometheus -n monitoring

# Port forward to access Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# Access at http://localhost:9090
```

#### API Gateway
```bash
# Get API Gateway LoadBalancer IP
kubectl get svc api-gateway -n fitquest

# The external IP will be available after a few minutes
# All API requests should be routed through this endpoint
```

## Phase 2: CI/CD Setup

### Step 1: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

```
AWS_ACCESS_KEY_ID: <your-aws-access-key>
AWS_SECRET_ACCESS_KEY: <your-aws-secret-key>
AWS_ACCOUNT_ID: <your-aws-account-id>
```

### Step 2: Enable GitHub Actions

The CI/CD pipelines are configured in `.github/workflows/`:

- `build-and-push.yml`: Builds Docker images and pushes to ECR
- `deploy.yml`: Deploys Kubernetes manifests to the cluster

These workflows trigger automatically on:
- Push to `main` or `develop` branches
- Changes to relevant service or infrastructure files

## Important Security Notes

### Change Default Credentials

Before deploying to production, update all default credentials:

1. **PostgreSQL**: Update `postgresql-credentials` secret
2. **RabbitMQ**: Update `rabbitmq-credentials` secret
3. **Grafana**: Update `grafana-credentials` secret

```bash
# Update PostgreSQL credentials
kubectl patch secret postgresql-credentials -n fitquest -p \
  '{"data":{"password":"'$(echo -n 'new-password' | base64)'"}}'

# Update RabbitMQ credentials
kubectl patch secret rabbitmq-credentials -n fitquest -p \
  '{"data":{"password":"'$(echo -n 'new-password' | base64)'"}}'

# Update Grafana credentials
kubectl patch secret grafana-credentials -n monitoring -p \
  '{"data":{"password":"'$(echo -n 'new-password' | base64)'"}}'
```

### Enable TLS/SSL

1. Generate TLS certificates for API Gateway
2. Create a secret with the certificates
3. Update the API Gateway deployment to use HTTPS

```bash
# Create TLS secret
kubectl create secret tls api-gateway-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n fitquest
```

### Network Policies

Implement Kubernetes Network Policies to restrict traffic between services:

```bash
# Example: Allow only specific services to access PostgreSQL
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgresql-access
  namespace: fitquest
spec:
  podSelector:
    matchLabels:
      app: postgresql
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: auth-service
    - podSelector:
        matchLabels:
          app: user-profile-service
EOF
```

## Monitoring and Logging

### Prometheus Metrics

Prometheus is configured to scrape metrics from:
- Kubernetes API server
- Kubernetes nodes
- Kubernetes pods (with `prometheus.io/scrape: "true"` annotation)

### Grafana Dashboards

1. Add Prometheus as a data source in Grafana
2. Import pre-built dashboards or create custom ones
3. Set up alerts for critical metrics

### Centralized Logging

For production, consider adding:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Loki for log aggregation
- Jaeger for distributed tracing

## Scaling and Auto-scaling

### Horizontal Pod Autoscaling

```bash
# Example: Auto-scale API Gateway based on CPU
kubectl autoscale deployment api-gateway --min=3 --max=10 --cpu-percent=80 -n fitquest
```

### Cluster Autoscaling

Update the Terraform configuration to enable cluster autoscaling:

```hcl
# In terraform/main.tf
resource "aws_autoscaling_group" "fitquest" {
  # ... configuration
  min_size         = 3
  max_size         = 10
  desired_capacity = 3
}
```

## Troubleshooting

### Check Pod Logs

```bash
# View logs for a specific pod
kubectl logs <pod-name> -n fitquest

# Stream logs in real-time
kubectl logs -f <pod-name> -n fitquest

# View logs from all pods in a deployment
kubectl logs -l app=redis -n fitquest
```

### Describe Resources

```bash
# Get detailed information about a pod
kubectl describe pod <pod-name> -n fitquest

# Get detailed information about a service
kubectl describe svc <service-name> -n fitquest
```

### Port Forwarding for Debugging

```bash
# Forward local port to service
kubectl port-forward svc/<service-name> <local-port>:<service-port> -n fitquest
```

## Cleanup

To remove all infrastructure:

```bash
# Delete Kubernetes resources
kubectl delete namespace fitquest monitoring ingress-nginx

# Destroy AWS infrastructure
cd infrastructure/terraform
terraform destroy
```

## Next Steps

1. Deploy microservices (Phase 2)
2. Configure CI/CD pipelines
3. Set up monitoring and alerting
4. Implement backup and disaster recovery
5. Configure auto-scaling policies
6. Set up security scanning and compliance checks
