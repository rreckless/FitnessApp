# User Profile Service Deployment Guide

This guide provides step-by-step instructions for deploying the User Profile Service to Kubernetes.

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured to access your cluster
- Docker registry access (Docker Hub, AWS ECR, etc.)
- PostgreSQL database accessible from the cluster
- Redis cache accessible from the cluster
- AWS S3 bucket for profile pictures
- AWS credentials with S3 access

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t fitquest/user-profile-service:1.0.0 .

# Tag for your registry
docker tag fitquest/user-profile-service:1.0.0 your-registry/user-profile-service:1.0.0

# Push to registry
docker push your-registry/user-profile-service:1.0.0
```

### 2. Create Kubernetes Namespace

```bash
kubectl create namespace fitquest
```

### 3. Create Secrets

Create a secret file `user-profile-service-secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: user-profile-service-secrets
  namespace: fitquest
type: Opaque
stringData:
  database-connection-string: "Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_users;Username=fitquest;Password=your-password"
  redis-connection-string: "redis.fitquest.svc.cluster.local:6379"
  aws-access-key-id: "your-aws-access-key"
  aws-secret-access-key: "your-aws-secret-key"
```

Apply the secret:
```bash
kubectl apply -f user-profile-service-secrets.yaml
```

### 4. Create ConfigMap

Create a ConfigMap file `user-profile-service-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: user-profile-service-config
  namespace: fitquest
data:
  s3-bucket-name: "fitquest-profiles"
  s3-presigned-url-expiration: "15"
  aws-region: "us-east-1"
```

Apply the ConfigMap:
```bash
kubectl apply -f user-profile-service-config.yaml
```

### 5. Update Deployment Image

Update the image in `kubernetes-deployment.yaml`:

```yaml
image: your-registry/user-profile-service:1.0.0
```

### 6. Deploy the Service

```bash
# Deploy the service
kubectl apply -f kubernetes-service.yaml

# Deploy the deployment
kubectl apply -f kubernetes-deployment.yaml
```

### 7. Verify Deployment

```bash
# Check deployment status
kubectl get deployment -n fitquest user-profile-service

# Check pods
kubectl get pods -n fitquest -l app=user-profile-service

# Check service
kubectl get service -n fitquest user-profile-service

# View logs
kubectl logs -n fitquest -l app=user-profile-service -f
```

### 8. Test the Service

Port forward to test locally:
```bash
kubectl port-forward -n fitquest svc/user-profile-service 8080:80
```

Test the health endpoint:
```bash
curl http://localhost:8080/health
```

## Scaling

### Manual Scaling

```bash
kubectl scale deployment user-profile-service -n fitquest --replicas=5
```

### Horizontal Pod Autoscaler

Create `hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-profile-service-hpa
  namespace: fitquest
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-profile-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Apply the HPA:
```bash
kubectl apply -f hpa.yaml
```

## Monitoring

### View Metrics

```bash
# CPU and memory usage
kubectl top pods -n fitquest -l app=user-profile-service

# Node metrics
kubectl top nodes
```

### View Logs

```bash
# Real-time logs
kubectl logs -n fitquest -l app=user-profile-service -f

# Last 100 lines
kubectl logs -n fitquest -l app=user-profile-service --tail=100

# Logs from specific pod
kubectl logs -n fitquest user-profile-service-<pod-id>
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n fitquest user-profile-service-<pod-id>

# Check events
kubectl get events -n fitquest --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -it -n fitquest user-profile-service-<pod-id> -- \
  dotnet user-profile-service.dll --test-db
```

### Redis Connection Issues

```bash
# Test Redis connectivity
kubectl exec -it -n fitquest user-profile-service-<pod-id> -- \
  redis-cli -h redis.fitquest.svc.cluster.local ping
```

### S3 Access Issues

```bash
# Verify AWS credentials
kubectl get secret -n fitquest user-profile-service-secrets -o yaml

# Check S3 bucket permissions
aws s3 ls s3://fitquest-profiles/
```

## Updating the Service

### Rolling Update

```bash
# Update the image
kubectl set image deployment/user-profile-service \
  user-profile-service=your-registry/user-profile-service:1.0.1 \
  -n fitquest

# Monitor the rollout
kubectl rollout status deployment/user-profile-service -n fitquest
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/user-profile-service -n fitquest

# Check rollout history
kubectl rollout history deployment/user-profile-service -n fitquest
```

## Database Migrations

Migrations are automatically run on service startup. To manually run migrations:

```bash
# Connect to pod
kubectl exec -it -n fitquest user-profile-service-<pod-id> -- /bin/bash

# Run migrations
dotnet ef database update
```

## Backup and Recovery

### Backup Database

```bash
# Backup PostgreSQL
kubectl exec -it -n fitquest postgresql-<pod-id> -- \
  pg_dump -U fitquest fitquest_users > backup.sql
```

### Restore Database

```bash
# Restore PostgreSQL
kubectl exec -it -n fitquest postgresql-<pod-id> -- \
  psql -U fitquest fitquest_users < backup.sql
```

## Performance Tuning

### Resource Limits

Adjust resource requests and limits in `kubernetes-deployment.yaml`:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Connection Pool Size

Configure in `appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=...;Max Pool Size=20;..."
}
```

## Security

### Network Policies

Create `network-policy.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-profile-service-policy
  namespace: fitquest
spec:
  podSelector:
    matchLabels:
      app: user-profile-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: fitquest
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: fitquest
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

Apply the network policy:
```bash
kubectl apply -f network-policy.yaml
```

### Pod Security Policy

Ensure the deployment uses non-root user and read-only filesystem (already configured in `kubernetes-deployment.yaml`).

## Cleanup

```bash
# Delete deployment
kubectl delete deployment user-profile-service -n fitquest

# Delete service
kubectl delete service user-profile-service -n fitquest

# Delete secrets and configmaps
kubectl delete secret user-profile-service-secrets -n fitquest
kubectl delete configmap user-profile-service-config -n fitquest

# Delete namespace
kubectl delete namespace fitquest
```

## Support

For issues or questions, please refer to the main README.md or contact the development team.
