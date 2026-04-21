# API Gateway Setup Guide

This guide provides step-by-step instructions for deploying the FitQuest API Gateway.

## Prerequisites

- Kubernetes cluster (from Task 1.1)
- kubectl configured and authenticated
- OpenSSL installed (for certificate generation)
- Helm 3+ (optional, for advanced deployments)

## Quick Start (5 minutes)

### 1. Deploy API Gateway

```bash
cd infrastructure/kubernetes/api-gateway
chmod +x scripts/*.sh
./scripts/setup-api-gateway.sh
```

### 2. Generate TLS Certificates

For development (self-signed):
```bash
./scripts/generate-certificates.sh --self-signed
```

For production (Let's Encrypt):
```bash
./scripts/generate-certificates.sh --letsencrypt --domain api.fitquest.com
```

### 3. Deploy Ingress Resource

```bash
kubectl apply -f ingress/fitquest-ingress.yaml
```

### 4. Verify Deployment

```bash
./scripts/verify-api-gateway.sh
```

## Detailed Setup

### Step 1: Create Namespace

```bash
kubectl create namespace ingress
kubectl label namespace ingress name=ingress
```

### Step 2: Deploy RBAC

```bash
kubectl apply -f deployment/nginx-rbac.yaml
```

This creates:
- ServiceAccount: `nginx-ingress-controller`
- ClusterRole: `nginx-ingress-controller`
- ClusterRoleBinding: `nginx-ingress-controller`
- Role: `nginx-ingress-controller` (namespace-scoped)
- RoleBinding: `nginx-ingress-controller`
- NetworkPolicy: `nginx-ingress-controller-network-policy`

### Step 3: Deploy ConfigMaps

```bash
kubectl apply -f deployment/nginx-configmap.yaml
```

This creates:
- `nginx-config`: Main Nginx configuration
- `tcp-services`: TCP load balancing configuration
- `udp-services`: UDP load balancing configuration
- `custom-headers`: Security headers configuration

### Step 4: Deploy Service

```bash
kubectl apply -f deployment/nginx-service.yaml
```

This creates:
- `nginx-ingress-controller`: LoadBalancer service (external access)
- `nginx-ingress-controller-metrics`: ClusterIP service (metrics)
- `nginx`: IngressClass

### Step 5: Deploy Nginx Ingress Controller

```bash
kubectl apply -f deployment/nginx-ingress-controller.yaml
```

This creates:
- Deployment: `nginx-ingress-controller` (3 replicas)
- PodDisruptionBudget: `nginx-ingress-controller-pdb`
- HorizontalPodAutoscaler: `nginx-ingress-controller-hpa`

Wait for deployment to be ready:
```bash
kubectl rollout status deployment/nginx-ingress-controller -n ingress
```

### Step 6: Generate TLS Certificates

Create a Kubernetes secret with TLS certificates:

```bash
# Generate self-signed certificate
openssl genrsa -out /tmp/tls.key 2048
openssl req -new -x509 -key /tmp/tls.key -out /tmp/tls.crt -days 365 \
  -subj "/C=US/ST=State/L=City/O=FitQuest/CN=api.fitquest.com"

# Create Kubernetes secret
kubectl create secret tls fitquest-tls \
  --cert=/tmp/tls.crt \
  --key=/tmp/tls.key \
  -n ingress

# Cleanup
rm /tmp/tls.key /tmp/tls.crt
```

Or use the provided script:
```bash
./scripts/generate-certificates.sh --self-signed
```

### Step 7: Deploy Ingress Resource

```bash
kubectl apply -f ingress/fitquest-ingress.yaml
```

This creates:
- `fitquest-api-gateway`: Main ingress with authentication
- `fitquest-api-gateway-public`: Public ingress (no auth required)

### Step 8: Deploy Rate Limiting Configuration

```bash
kubectl apply -f ingress/rate-limit-config.yaml
```

### Step 9: Deploy Authentication Middleware

```bash
kubectl apply -f auth/auth-middleware.yaml
```

### Step 10: Verify Deployment

```bash
./scripts/verify-api-gateway.sh
```

## Configuration

### Rate Limiting

Edit `ingress/rate-limit-config.yaml` to adjust limits:

```yaml
# Per-user rate limit: 100 requests per minute
limit_req_zone $http_x_user_id zone=user_limit:10m rate=100r/m;

# Per-IP rate limit: 50 requests per minute
limit_req_zone $binary_remote_addr zone=ip_limit:10m rate=50r/m;
```

Apply changes:
```bash
kubectl apply -f ingress/rate-limit-config.yaml
```

### Routing Rules

Edit `ingress/fitquest-ingress.yaml` to add/modify routes:

```yaml
- path: /new-service
  pathType: Prefix
  backend:
    service:
      name: new-service
      port:
        number: 8080
```

Apply changes:
```bash
kubectl apply -f ingress/fitquest-ingress.yaml
```

### TLS Certificates

Renew certificates before expiration:

```bash
# Check expiration date
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Regenerate certificate
./scripts/generate-certificates.sh --self-signed
```

## Monitoring

### View Logs

```bash
# View all logs
kubectl logs -n ingress -l app=nginx-ingress-controller -f

# View logs from specific pod
kubectl logs -n ingress nginx-ingress-controller-<pod-id> -f

# View logs with timestamps
kubectl logs -n ingress -l app=nginx-ingress-controller --timestamps=true -f
```

### Check Metrics

```bash
# Port forward to metrics endpoint
kubectl port-forward -n ingress svc/nginx-ingress-controller-metrics 10254:10254

# View metrics
curl http://localhost:10254/metrics
```

### Check Status

```bash
# Check deployment status
kubectl get deployment -n ingress

# Check pod status
kubectl get pods -n ingress

# Check service status
kubectl get svc -n ingress

# Check ingress status
kubectl get ingress -n ingress

# Describe ingress
kubectl describe ingress fitquest-api-gateway -n ingress
```

## Troubleshooting

### API Gateway not accessible

```bash
# Check service has external IP
kubectl get svc nginx-ingress-controller -n ingress

# If external IP is pending, wait a few minutes
# For AWS EKS, check security groups and load balancer
# For Azure AKS, check network security groups
```

### TLS certificate issues

```bash
# Check certificate secret exists
kubectl get secret fitquest-tls -n ingress

# Check certificate details
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -text

# Check certificate expiration
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate
```

### Rate limiting not working

```bash
# Check rate limit configuration
kubectl get configmap rate-limit-config -n ingress -o yaml

# Check Nginx configuration
kubectl exec -n ingress <pod-name> -- cat /etc/nginx/nginx.conf | grep limit_req

# Check rate limit logs
kubectl logs -n ingress -l app=nginx-ingress-controller | grep limit_req
```

### Authentication not working

```bash
# Check auth middleware configuration
kubectl get configmap auth-middleware-config -n ingress -o yaml

# Check JWT secret exists
kubectl get secret jwt-secret -n ingress

# Test authentication endpoint
kubectl exec -n ingress <pod-name> -- curl -v http://auth-service.fitquest.svc.cluster.local:8080/auth/validate
```

## Performance Tuning

### Increase Replicas

```bash
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=5
```

### Adjust Resource Limits

Edit `deployment/nginx-ingress-controller.yaml`:

```yaml
resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

Apply changes:
```bash
kubectl apply -f deployment/nginx-ingress-controller.yaml
```

### Enable Caching

Edit `deployment/nginx-configmap.yaml`:

```yaml
proxy-cache: "true"
proxy-cache-valid: "200 10m"
```

Apply changes:
```bash
kubectl apply -f deployment/nginx-configmap.yaml
```

## Security Hardening

### Enable WAF (ModSecurity)

Already enabled in `nginx-configmap.yaml`:

```yaml
enable-modsecurity: "true"
enable-owasp-core-rules: "true"
```

### Enable HTTPS Redirect

Already enabled in `ingress/fitquest-ingress.yaml`:

```yaml
nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
```

### Add IP Whitelist

Edit `ingress/fitquest-ingress.yaml`:

```yaml
nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.0/24,198.51.100.0/24"
```

## Next Steps

1. Deploy Message Queue (Task 1.3)
2. Deploy Monitoring Stack (Task 1.4)
3. Deploy Redis Cluster (Task 1.5)
4. Deploy PostgreSQL (Task 1.6)
5. Deploy Microservices (Phase 2)

## References

- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Ingress Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
