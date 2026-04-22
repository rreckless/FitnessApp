# Workout Service Deployment Guide

This guide covers deploying the Workout Service to Kubernetes.

## Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured to access the cluster
- Docker registry access (Docker Hub or AWS ECR)
- PostgreSQL database accessible from the cluster
- RabbitMQ accessible from the cluster

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t fitquest/workout-service:latest .

# Tag for registry
docker tag fitquest/workout-service:latest your-registry/fitquest/workout-service:latest

# Push to registry
docker push your-registry/fitquest/workout-service:latest
```

### 2. Create Kubernetes Namespace (if not exists)

```bash
kubectl create namespace fitquest
```

### 3. Create Secrets

```bash
# Create database connection secret
kubectl create secret generic workout-service-secrets \
  --from-literal=database-connection-string="Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_workouts;Username=fitquest;Password=your-password" \
  --from-literal=rabbitmq-connection-string="amqp://guest:guest@rabbitmq.fitquest.svc.cluster.local:5672/" \
  -n fitquest
```

### 4. Update Deployment Manifest

Edit `kubernetes-deployment.yaml` to update:
- Image registry URL if using private registry
- Resource requests/limits based on your cluster capacity
- Replica count for high availability

### 5. Deploy Service

```bash
# Apply deployment
kubectl apply -f kubernetes-deployment.yaml

# Apply service
kubectl apply -f kubernetes-service.yaml

# Verify deployment
kubectl get deployment -n fitquest workout-service
kubectl get pods -n fitquest -l app=workout-service
```

### 6. Verify Health

```bash
# Check pod status
kubectl get pods -n fitquest -l app=workout-service

# View logs
kubectl logs -n fitquest -l app=workout-service -f

# Port forward to test locally
kubectl port-forward -n fitquest svc/workout-service 8080:80

# Test health endpoint
curl http://localhost:8080/health
```

## Database Migrations

Migrations run automatically on service startup. To manually run migrations:

```bash
# Port forward to the pod
kubectl port-forward -n fitquest pod/workout-service-xxx 8080:8080

# In another terminal, run migrations
dotnet ef database update --connection "Host=localhost;Port=5432;Database=fitquest_workouts;Username=fitquest;Password=password"
```

## Scaling

### Horizontal Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment workout-service -n fitquest --replicas=5

# View current replicas
kubectl get deployment -n fitquest workout-service
```

### Vertical Scaling

Edit `kubernetes-deployment.yaml` and update resource requests/limits:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

Then apply:
```bash
kubectl apply -f kubernetes-deployment.yaml
```

## Monitoring

### View Logs

```bash
# View logs from all pods
kubectl logs -n fitquest -l app=workout-service -f

# View logs from specific pod
kubectl logs -n fitquest workout-service-xxx -f

# View previous logs (if pod crashed)
kubectl logs -n fitquest workout-service-xxx --previous
```

### Check Pod Status

```bash
# Describe pod for events
kubectl describe pod -n fitquest workout-service-xxx

# Get pod metrics (requires metrics-server)
kubectl top pod -n fitquest -l app=workout-service
```

### Health Checks

```bash
# Check liveness probe
kubectl get pod -n fitquest workout-service-xxx -o jsonpath='{.status.conditions[?(@.type=="Ready")]}'

# Manually test health endpoint
kubectl exec -n fitquest workout-service-xxx -- curl http://localhost:8080/health
```

## Updating the Service

### Rolling Update

```bash
# Update image
kubectl set image deployment/workout-service \
  workout-service=your-registry/fitquest/workout-service:v2 \
  -n fitquest

# Monitor rollout
kubectl rollout status deployment/workout-service -n fitquest

# View rollout history
kubectl rollout history deployment/workout-service -n fitquest
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/workout-service -n fitquest

# Rollback to specific revision
kubectl rollout undo deployment/workout-service -n fitquest --to-revision=2
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n fitquest workout-service-xxx

# Check logs
kubectl logs -n fitquest workout-service-xxx

# Common issues:
# - Image not found: Check image registry and credentials
# - CrashLoopBackOff: Check application logs for errors
# - Pending: Check resource availability
```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -n fitquest workout-service-xxx -- \
  dotnet tool install -g dotnet-ef

# Check connection string in secrets
kubectl get secret -n fitquest workout-service-secrets -o yaml
```

### RabbitMQ Connection Issues

```bash
# Test RabbitMQ connectivity
kubectl exec -n fitquest workout-service-xxx -- \
  curl -v amqp://rabbitmq.fitquest.svc.cluster.local:5672/
```

### High Memory Usage

```bash
# Check memory usage
kubectl top pod -n fitquest -l app=workout-service

# Increase memory limit in deployment
# Edit kubernetes-deployment.yaml and increase limits.memory
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
kubectl exec -n fitquest postgresql-xxx -- \
  pg_dump -U fitquest fitquest_workouts > backup.sql

# Restore backup
kubectl exec -n fitquest postgresql-xxx -- \
  psql -U fitquest fitquest_workouts < backup.sql
```

## Performance Tuning

### Database Connection Pooling

Update connection string in secrets:
```
Host=postgresql.fitquest.svc.cluster.local;Port=5432;Database=fitquest_workouts;Username=fitquest;Password=password;Max Pool Size=20;Min Pool Size=5;
```

### Resource Limits

Adjust based on load testing:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

## Security

### Network Policies

Create network policy to restrict traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: workout-service-policy
  namespace: fitquest
spec:
  podSelector:
    matchLabels:
      app: workout-service
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
      port: 5672
```

### Pod Security Policy

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: workout-service-psp
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
    - min: 1000
      max: 65535
  readOnlyRootFilesystem: true
```

## Maintenance

### Regular Tasks

- Monitor logs for errors
- Check resource usage
- Review performance metrics
- Update dependencies
- Test disaster recovery procedures

### Scheduled Maintenance

```bash
# Drain node for maintenance
kubectl drain node-name --ignore-daemonsets

# Perform maintenance...

# Uncordon node
kubectl uncordon node-name
```

## Support

For issues or questions:
1. Check logs: `kubectl logs -n fitquest -l app=workout-service -f`
2. Check pod status: `kubectl describe pod -n fitquest workout-service-xxx`
3. Review this guide for troubleshooting steps
4. Contact the DevOps team for infrastructure issues
