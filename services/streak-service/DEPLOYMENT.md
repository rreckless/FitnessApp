# Streak Service Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Streak Tracking Service to production.

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured with cluster access
- Docker registry access
- PostgreSQL 14+ instance
- RabbitMQ 3.12+ instance

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t streak-service:1.0.0 .

# Tag for registry
docker tag streak-service:1.0.0 <registry>/streak-service:1.0.0

# Push to registry
docker push <registry>/streak-service:1.0.0
```

### 2. Create Kubernetes Namespace

```bash
kubectl create namespace fitquest
```

### 3. Create Secrets

```bash
# Database connection string
kubectl create secret generic streak-service-secrets \
  --from-literal=database-connection-string="Host=postgres.fitquest.svc.cluster.local;Port=5432;Database=fitquest_streak;Username=postgres;Password=<password>" \
  --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq.fitquest.svc.cluster.local:5672/" \
  -n fitquest
```

### 4. Update Deployment Manifest

Update `kubernetes-deployment.yaml`:
- Change image to your registry: `<registry>/streak-service:1.0.0`
- Update resource limits based on your cluster capacity

### 5. Deploy Service

```bash
# Apply deployment
kubectl apply -f kubernetes-deployment.yaml

# Apply service
kubectl apply -f kubernetes-service.yaml

# Verify deployment
kubectl get deployment streak-service -n fitquest
kubectl get pods -n fitquest -l app=streak-service
```

### 6. Verify Health

```bash
# Port forward to test locally
kubectl port-forward svc/streak-service 8080:80 -n fitquest

# Test health endpoint
curl http://localhost:8080/health

# Test API
curl http://localhost:8080/swagger
```

## Scaling

### Horizontal Pod Autoscaling

```bash
kubectl autoscale deployment streak-service \
  --min=3 --max=10 \
  --cpu-percent=80 \
  -n fitquest
```

### Manual Scaling

```bash
kubectl scale deployment streak-service --replicas=5 -n fitquest
```

## Monitoring

### View Logs

```bash
# View logs from all pods
kubectl logs -f deployment/streak-service -n fitquest

# View logs from specific pod
kubectl logs -f pod/streak-service-<pod-id> -n fitquest
```

### Check Pod Status

```bash
kubectl describe pod streak-service-<pod-id> -n fitquest
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod events
kubectl describe pod streak-service-<pod-id> -n fitquest

# Check logs
kubectl logs streak-service-<pod-id> -n fitquest
```

### Database Connection Issues

```bash
# Verify database is accessible
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- \
  psql -h postgres.fitquest.svc.cluster.local -U postgres -d fitquest_streak -c "SELECT 1"
```

### RabbitMQ Connection Issues

```bash
# Verify RabbitMQ is accessible
kubectl run -it --rm debug --image=rabbitmq:3.12 --restart=Never -- \
  rabbitmq-diagnostics -q ping -n rabbitmq.fitquest.svc.cluster.local
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/streak-service -n fitquest

# Rollback to previous version
kubectl rollout undo deployment/streak-service -n fitquest

# Rollback to specific revision
kubectl rollout undo deployment/streak-service --to-revision=2 -n fitquest
```

## Updates

### Rolling Update

```bash
# Update image
kubectl set image deployment/streak-service \
  streak-service=<registry>/streak-service:1.0.1 \
  -n fitquest

# Monitor rollout
kubectl rollout status deployment/streak-service -n fitquest
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
kubectl exec -it postgres-pod -n fitquest -- \
  pg_dump -U postgres fitquest_streak > backup.sql

# Restore backup
kubectl exec -i postgres-pod -n fitquest -- \
  psql -U postgres fitquest_streak < backup.sql
```

## Performance Tuning

### Resource Limits

Adjust in `kubernetes-deployment.yaml`:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Database Connection Pooling

Configure in `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Max Pool Size=20;Min Pool Size=5;"
  }
}
```

## Security

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: streak-service-policy
  namespace: fitquest
spec:
  podSelector:
    matchLabels:
      app: streak-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
  - to:
    - podSelector:
        matchLabels:
          app: rabbitmq
```

### Pod Security Policy

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: streak-service-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
  - ALL
  volumes:
  - 'configMap'
  - 'emptyDir'
  - 'projected'
  - 'secret'
  - 'downwardAPI'
  - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'MustRunAs'
    seLinuxOptions:
      level: "s0:c123,c456"
  fsGroup:
    rule: 'MustRunAs'
    ranges:
    - min: 1
      max: 65535
  readOnlyRootFilesystem: false
```

## Support

For issues or questions, contact the DevOps team or refer to the main README.md.
