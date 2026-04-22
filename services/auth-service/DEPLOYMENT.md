# Authentication Service Deployment Guide

This guide covers building, containerizing, and deploying the Authentication Service to Kubernetes.

## Prerequisites

- Docker installed and configured
- Kubernetes cluster (AWS EKS, Azure AKS, or on-premises)
- kubectl configured to access your cluster
- Docker registry access (Docker Hub, AWS ECR, or similar)
- PostgreSQL database accessible from Kubernetes
- Redis cluster accessible from Kubernetes

## Docker Build and Push

### 1. Build Docker Image

```bash
# From the repository root
docker build -f services/auth-service/Dockerfile -t fitquest/auth-service:latest .
```

### 2. Tag Image for Registry

```bash
# For Docker Hub
docker tag fitquest/auth-service:latest <your-docker-username>/auth-service:latest

# For AWS ECR
docker tag fitquest/auth-service:latest <aws-account-id>.dkr.ecr.<region>.amazonaws.com/auth-service:latest
```

### 3. Push to Registry

```bash
# For Docker Hub
docker push <your-docker-username>/auth-service:latest

# For AWS ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.<region>.amazonaws.com
docker push <aws-account-id>.dkr.ecr.<region>.amazonaws.com/auth-service:latest
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace fitquest
```

### 2. Create Secrets

```bash
# Create database connection string secret
kubectl create secret generic auth-service-secrets \
  --from-literal=database-connection-string='Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_users;Username=fitquest;Password=<your-password>' \
  --from-literal=redis-connection-string='redis.fitquest.svc.cluster.local:6379' \
  --from-literal=jwt-secret='<your-jwt-secret-min-32-chars>' \
  -n fitquest
```

### 3. Update Deployment Manifest

Edit `kubernetes-deployment.yaml` to update the image reference:

```yaml
image: <your-registry>/auth-service:latest
```

### 4. Deploy Service

```bash
# Deploy the service
kubectl apply -f services/auth-service/kubernetes-service.yaml -n fitquest

# Deploy the deployment
kubectl apply -f services/auth-service/kubernetes-deployment.yaml -n fitquest
```

### 5. Verify Deployment

```bash
# Check deployment status
kubectl get deployments -n fitquest

# Check pods
kubectl get pods -n fitquest

# Check service
kubectl get svc -n fitquest

# View logs
kubectl logs -f deployment/auth-service -n fitquest
```

## Database Migration

### 1. Run Migrations in Container

```bash
# Port-forward to the service
kubectl port-forward svc/auth-service 5000:5000 -n fitquest

# In another terminal, run migrations
dotnet ef database update --connection "Host=localhost;Port=5432;Database=fitquest_users;Username=fitquest;Password=<password>"
```

### 2. Or Run Migrations Manually

```bash
# Connect to PostgreSQL
psql -h postgresql.fitquest.svc.cluster.local -U fitquest -d fitquest_users

# Run SQL migrations (see schema below)
```

## Database Schema

### Create Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bio VARCHAR(500),
    profile_picture_url VARCHAR(500),
    level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_password_change_at TIMESTAMP NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'FREE',
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_sync_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

### Create PasswordHistory Table

```sql
CREATE TABLE password_histories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_password_histories_user_id ON password_histories(user_id);
```

## Environment Variables

### Production

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_users;Username=fitquest;Password=<password>
ConnectionStrings__Redis=redis.fitquest.svc.cluster.local:6379
Jwt__Secret=<your-jwt-secret-min-32-chars>
Jwt__Issuer=fitquest
Jwt__Audience=fitquest-mobile
Jwt__AccessTokenExpiryMinutes=15
Jwt__RefreshTokenExpiryDays=7
```

### Development

```
ASPNETCORE_ENVIRONMENT=Development
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=fitquest_users_dev;Username=postgres;Password=postgres
ConnectionStrings__Redis=localhost:6379
Jwt__Secret=dev-secret-key-min-32-characters-long-for-security-testing
```

## Scaling

### Horizontal Pod Autoscaler

```bash
kubectl autoscale deployment auth-service --min=3 --max=10 --cpu-percent=80 -n fitquest
```

### Manual Scaling

```bash
kubectl scale deployment auth-service --replicas=5 -n fitquest
```

## Monitoring

### View Logs

```bash
# View logs from all pods
kubectl logs -f deployment/auth-service -n fitquest

# View logs from specific pod
kubectl logs -f pod/<pod-name> -n fitquest
```

### Health Check

```bash
# Port-forward to service
kubectl port-forward svc/auth-service 5000:5000 -n fitquest

# In another terminal
curl http://localhost:5000/health
```

### Metrics

```bash
# Get pod metrics (requires metrics-server)
kubectl top pods -n fitquest
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n fitquest

# Check logs
kubectl logs <pod-name> -n fitquest
```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -it <pod-name> -n fitquest -- /bin/bash
# Inside pod:
apt-get update && apt-get install -y postgresql-client
psql -h postgresql.fitquest.svc.cluster.local -U fitquest -d fitquest_users
```

### Redis Connection Issues

```bash
# Test Redis connectivity from pod
kubectl exec -it <pod-name> -n fitquest -- /bin/bash
# Inside pod:
apt-get update && apt-get install -y redis-tools
redis-cli -h redis.fitquest.svc.cluster.local -p 6379 ping
```

## Updating Deployment

### Rolling Update

```bash
# Update image
kubectl set image deployment/auth-service auth-service=<new-image>:latest -n fitquest

# Check rollout status
kubectl rollout status deployment/auth-service -n fitquest
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/auth-service -n fitquest

# Check rollout history
kubectl rollout history deployment/auth-service -n fitquest
```

## Cleanup

```bash
# Delete deployment
kubectl delete deployment auth-service -n fitquest

# Delete service
kubectl delete svc auth-service -n fitquest

# Delete secrets
kubectl delete secret auth-service-secrets -n fitquest

# Delete namespace
kubectl delete namespace fitquest
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

### Connection Pooling

Configure in `appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=...;Max Pool Size=20;Min Pool Size=5;"
}
```

## Security Best Practices

1. **Use Secrets** for sensitive data (JWT secret, database password)
2. **Enable RBAC** in Kubernetes
3. **Use Network Policies** to restrict traffic
4. **Enable Pod Security Policies**
5. **Use TLS** for all communications
6. **Rotate JWT secrets** regularly
7. **Monitor logs** for suspicious activity
8. **Use private container registry**

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Auth Service

on:
  push:
    branches: [main]
    paths:
      - 'services/auth-service/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker image
        run: docker build -f services/auth-service/Dockerfile -t fitquest/auth-service:${{ github.sha }} .
      
      - name: Push to registry
        run: docker push fitquest/auth-service:${{ github.sha }}
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/auth-service auth-service=fitquest/auth-service:${{ github.sha }} -n fitquest
```

## Support

For issues or questions, contact the DevOps team or refer to the main README.md.
