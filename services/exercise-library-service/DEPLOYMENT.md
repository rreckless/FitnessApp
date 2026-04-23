# Exercise Library Service - Deployment Guide

## Overview

This guide covers deploying the Exercise Library Service to Kubernetes and managing its lifecycle.

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured to access your cluster
- Docker registry access (Docker Hub, AWS ECR, etc.)
- PostgreSQL 14+ database
- Redis 7+ cache

## Local Development Setup

### 1. Install Dependencies

```bash
# Install .NET 9 SDK
# macOS
brew install dotnet

# Linux
sudo apt-get install dotnet-sdk-9.0

# Windows
# Download from https://dotnet.microsoft.com/download
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb fitquest_exercises

# Run migrations
dotnet ef database update
```

### 3. Run Locally

```bash
# Restore dependencies
dotnet restore

# Run the service
dotnet run

# Access Swagger UI
# http://localhost:5000/swagger
```

## Docker Build and Push

### 1. Build Docker Image

```bash
# Build image
docker build -t exercise-library-service:latest .

# Tag for registry
docker tag exercise-library-service:latest your-registry/exercise-library-service:latest
```

### 2. Push to Registry

```bash
# Docker Hub
docker push your-registry/exercise-library-service:latest

# AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/exercise-library-service:latest
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace fitquest
```

### 2. Create Secrets

```bash
# Database connection string
kubectl create secret generic exercise-library-secrets \
  --from-literal=database-connection-string="Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_exercises;Username=fitquest;Password=your-password" \
  --from-literal=redis-connection-string="redis.fitquest.svc.cluster.local:6379" \
  -n fitquest
```

### 3. Update Deployment Manifest

Edit `kubernetes-deployment.yaml`:

```yaml
spec:
  template:
    spec:
      containers:
      - name: exercise-library-service
        image: your-registry/exercise-library-service:latest  # Update image
```

### 4. Deploy Service

```bash
# Apply deployment
kubectl apply -f kubernetes-deployment.yaml

# Apply service
kubectl apply -f kubernetes-service.yaml

# Verify deployment
kubectl get pods -n fitquest -l app=exercise-library-service
kubectl get svc -n fitquest -l app=exercise-library-service
```

### 5. Verify Health

```bash
# Check pod logs
kubectl logs -n fitquest -l app=exercise-library-service

# Port forward to test locally
kubectl port-forward -n fitquest svc/exercise-library-service 8080:80

# Test health endpoint
curl http://localhost:8080/health
```

## Scaling

### Horizontal Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment exercise-library-service -n fitquest --replicas=5

# Verify scaling
kubectl get pods -n fitquest -l app=exercise-library-service
```

### Resource Management

```bash
# Check resource usage
kubectl top pods -n fitquest -l app=exercise-library-service

# Update resource limits in kubernetes-deployment.yaml
```

## Updates and Rollouts

### Rolling Update

```bash
# Update image
kubectl set image deployment/exercise-library-service \
  exercise-library-service=your-registry/exercise-library-service:v2 \
  -n fitquest

# Monitor rollout
kubectl rollout status deployment/exercise-library-service -n fitquest

# View rollout history
kubectl rollout history deployment/exercise-library-service -n fitquest
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/exercise-library-service -n fitquest

# Rollback to specific revision
kubectl rollout undo deployment/exercise-library-service -n fitquest --to-revision=2
```

## Monitoring

### Logs

```bash
# View logs from all pods
kubectl logs -n fitquest -l app=exercise-library-service --tail=100 -f

# View logs from specific pod
kubectl logs -n fitquest pod-name
```

### Metrics

```bash
# View resource usage
kubectl top pods -n fitquest -l app=exercise-library-service

# View node resource usage
kubectl top nodes
```

### Port Forwarding

```bash
# Forward local port to service
kubectl port-forward -n fitquest svc/exercise-library-service 8080:80

# Access service
curl http://localhost:8080/api/exercises
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n fitquest pod-name

# Check logs
kubectl logs -n fitquest pod-name

# Check events
kubectl get events -n fitquest --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Verify database secret
kubectl get secret -n fitquest exercise-library-secrets -o yaml

# Test database connectivity from pod
kubectl exec -it -n fitquest pod-name -- /bin/bash
# Inside pod:
# apt-get update && apt-get install -y postgresql-client
# psql -h postgresql.fitquest.svc.cluster.local -U fitquest -d fitquest_exercises
```

### Redis Connection Issues

```bash
# Test Redis connectivity from pod
kubectl exec -it -n fitquest pod-name -- /bin/bash
# Inside pod:
# apt-get update && apt-get install -y redis-tools
# redis-cli -h redis.fitquest.svc.cluster.local ping
```

## Maintenance

### Database Migrations

```bash
# Run migrations in pod
kubectl exec -it -n fitquest pod-name -- dotnet ef database update

# Or create a migration job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: exercise-library-migration
  namespace: fitquest
spec:
  template:
    spec:
      containers:
      - name: migration
        image: your-registry/exercise-library-service:latest
        command: ["dotnet", "ef", "database", "update"]
        env:
        - name: ConnectionStrings__DefaultConnection
          valueFrom:
            secretKeyRef:
              name: exercise-library-secrets
              key: database-connection-string
      restartPolicy: Never
  backoffLimit: 3
EOF
```

### Backup and Restore

```bash
# Backup database
kubectl exec -n fitquest postgresql-pod -- pg_dump -U fitquest fitquest_exercises > backup.sql

# Restore database
kubectl exec -i -n fitquest postgresql-pod -- psql -U fitquest fitquest_exercises < backup.sql
```

## Production Checklist

- [ ] Image pushed to registry
- [ ] Secrets created in Kubernetes
- [ ] Deployment manifest updated with correct image
- [ ] Service deployed and verified
- [ ] Health checks passing
- [ ] Logs being collected
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security scanning passed
- [ ] Documentation updated

## Support

For issues or questions, contact the DevOps team or refer to the main README.md.
