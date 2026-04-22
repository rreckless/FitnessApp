# XP & Progression Service - Deployment Guide

## Overview

This guide covers deploying the XP & Progression Service to various environments.

## Prerequisites

- Docker installed and running
- Kubernetes cluster (for K8s deployment)
- kubectl configured
- PostgreSQL 14+ accessible
- RabbitMQ accessible

## Local Development Deployment

### 1. Database Setup

```bash
# Create database
createdb fitquest_xp

# Run migrations
cd services/xp-progression-service
dotnet ef database update
```

### 2. Run Service

```bash
dotnet run
```

Service will be available at `http://localhost:5000`

### 3. Verify

```bash
curl http://localhost:5000/health
# Response: {"status":"healthy"}
```

## Docker Deployment

### 1. Build Image

```bash
cd services/xp-progression-service
docker build -t xp-progression-service:latest .
```

### 2. Run Container

```bash
docker run -d \
  --name xp-progression-service \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=fitquest_xp;Username=postgres;Password=postgres" \
  -e ConnectionStrings__RabbitMQ="amqp://guest:guest@rabbitmq:5672/" \
  -p 8080:8080 \
  xp-progression-service:latest
```

### 3. Verify

```bash
curl http://localhost:8080/health
docker logs xp-progression-service
```

### 4. Stop Container

```bash
docker stop xp-progression-service
docker rm xp-progression-service
```

## Docker Compose Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fitquest_xp
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3.12-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest

  xp-progression-service:
    build: ./services/xp-progression-service
    ports:
      - "8080:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__DefaultConnection: "Host=postgres;Port=5432;Database=fitquest_xp;Username=postgres;Password=postgres"
      ConnectionStrings__RabbitMQ: "amqp://guest:guest@rabbitmq:5672/"
    depends_on:
      - postgres
      - rabbitmq
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up -d
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace fitquest
```

### 2. Create Secrets

```bash
kubectl create secret generic xp-progression-secrets \
  --from-literal=database-connection-string="Host=postgres.fitquest.svc.cluster.local;Port=5432;Database=fitquest_xp;Username=postgres;Password=postgres" \
  --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq.fitquest.svc.cluster.local:5672/" \
  -n fitquest
```

### 3. Deploy Service

```bash
kubectl apply -f services/xp-progression-service/kubernetes-deployment.yaml
kubectl apply -f services/xp-progression-service/kubernetes-service.yaml
```

### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n fitquest -l app=xp-progression-service

# Check service
kubectl get svc -n fitquest xp-progression-service

# View logs
kubectl logs -n fitquest -l app=xp-progression-service

# Port forward for testing
kubectl port-forward -n fitquest svc/xp-progression-service 8080:80

# Test health endpoint
curl http://localhost:8080/health
```

### 5. Scale Deployment

```bash
kubectl scale deployment xp-progression-service -n fitquest --replicas=5
```

### 6. Update Deployment

```bash
# Update image
kubectl set image deployment/xp-progression-service \
  xp-progression-service=xp-progression-service:v2 \
  -n fitquest

# Check rollout status
kubectl rollout status deployment/xp-progression-service -n fitquest

# Rollback if needed
kubectl rollout undo deployment/xp-progression-service -n fitquest
```

## AWS EKS Deployment

### 1. Create EKS Cluster

```bash
eksctl create cluster --name fitquest --region us-east-1 --nodes 3
```

### 2. Configure kubectl

```bash
aws eks update-kubeconfig --name fitquest --region us-east-1
```

### 3. Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier fitquest-xp-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password <password> \
  --allocated-storage 20
```

### 4. Create ElastiCache RabbitMQ

```bash
# Use AWS MQ for RabbitMQ
aws mq create-broker \
  --broker-name fitquest-rabbitmq \
  --engine-type RABBITMQ \
  --engine-version 3.12.0 \
  --host-instance-type mq.t3.micro \
  --users Username=guest,Password=guest
```

### 5. Deploy to EKS

```bash
# Push image to ECR
aws ecr create-repository --repository-name xp-progression-service
docker tag xp-progression-service:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/xp-progression-service:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/xp-progression-service:latest

# Update deployment with ECR image
kubectl apply -f kubernetes-deployment.yaml
```

## Azure AKS Deployment

### 1. Create AKS Cluster

```bash
az aks create \
  --resource-group fitquest \
  --name fitquest-aks \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets
```

### 2. Get Credentials

```bash
az aks get-credentials --resource-group fitquest --name fitquest-aks
```

### 3. Create Azure Database for PostgreSQL

```bash
az postgres server create \
  --resource-group fitquest \
  --name fitquest-xp-db \
  --location eastus \
  --admin-user postgres \
  --admin-password <password> \
  --sku-name B_Gen5_1
```

### 4. Deploy to AKS

```bash
# Push image to ACR
az acr build --registry fitquestacr --image xp-progression-service:latest .

# Deploy
kubectl apply -f kubernetes-deployment.yaml
```

## Production Checklist

- [ ] Database backups configured
- [ ] RabbitMQ cluster configured with 3+ nodes
- [ ] Secrets properly configured
- [ ] Resource limits set appropriately
- [ ] Health checks configured
- [ ] Monitoring and logging enabled
- [ ] Auto-scaling configured
- [ ] Network policies configured
- [ ] RBAC configured
- [ ] Pod disruption budgets configured
- [ ] Load testing completed
- [ ] Disaster recovery plan documented

## Monitoring

### Prometheus Metrics

Add to Prometheus scrape config:

```yaml
- job_name: 'xp-progression-service'
  kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
          - fitquest
  relabel_configs:
    - source_labels: [__meta_kubernetes_pod_label_app]
      action: keep
      regex: xp-progression-service
```

### Grafana Dashboards

Create dashboards for:
- Request latency (p50, p95, p99)
- Error rates
- XP calculation performance
- Event processing latency
- Database query performance

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n fitquest

# Check logs
kubectl logs <pod-name> -n fitquest

# Check events
kubectl get events -n fitquest
```

### Database Connection Issues

```bash
# Test connection from pod
kubectl exec -it <pod-name> -n fitquest -- bash
psql -h postgres.fitquest.svc.cluster.local -U postgres -d fitquest_xp
```

### RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
kubectl logs -n fitquest -l app=rabbitmq

# Test connection
kubectl exec -it <pod-name> -n fitquest -- bash
curl -u guest:guest http://rabbitmq.fitquest.svc.cluster.local:15672/api/overview
```

## Rollback Procedure

```bash
# View rollout history
kubectl rollout history deployment/xp-progression-service -n fitquest

# Rollback to previous version
kubectl rollout undo deployment/xp-progression-service -n fitquest

# Rollback to specific revision
kubectl rollout undo deployment/xp-progression-service --to-revision=2 -n fitquest
```

## Performance Tuning

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_user_xp_user_id ON user_xps(user_id);
CREATE INDEX idx_muscle_group_rank_user_id ON muscle_group_ranks(user_id);
CREATE INDEX idx_progression_history_user_id ON progression_histories(user_id);
CREATE INDEX idx_progression_history_created_at ON progression_histories(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM user_xps WHERE user_id = '...';
```

### Kubernetes Resource Tuning

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Horizontal Pod Autoscaling

```bash
kubectl autoscale deployment xp-progression-service \
  --min=3 --max=10 \
  --cpu-percent=80 \
  -n fitquest
```

## Backup and Recovery

### Database Backup

```bash
# Backup
pg_dump -h postgres.fitquest.svc.cluster.local -U postgres fitquest_xp > backup.sql

# Restore
psql -h postgres.fitquest.svc.cluster.local -U postgres fitquest_xp < backup.sql
```

### Kubernetes Backup

```bash
# Backup all resources
kubectl get all -n fitquest -o yaml > fitquest-backup.yaml

# Restore
kubectl apply -f fitquest-backup.yaml
```

## Support

For issues or questions, contact the DevOps team or refer to the main README.md.
