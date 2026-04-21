# API Gateway Quick Reference

Quick commands and configurations for the FitQuest API Gateway.

## Quick Start (Copy & Paste)

```bash
# Navigate to API Gateway directory
cd infrastructure/kubernetes/api-gateway

# Make scripts executable
chmod +x scripts/*.sh

# Deploy API Gateway
./scripts/setup-api-gateway.sh

# Generate TLS certificates
./scripts/generate-certificates.sh --self-signed

# Deploy Ingress
kubectl apply -f ingress/fitquest-ingress.yaml

# Verify deployment
./scripts/verify-api-gateway.sh

# Get external IP
kubectl get svc nginx-ingress-controller -n ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

## Common Commands

### Deployment Management

```bash
# Check deployment status
kubectl get deployment -n ingress

# Check pod status
kubectl get pods -n ingress

# Check service status
kubectl get svc -n ingress

# Check ingress status
kubectl get ingress -n ingress

# Describe deployment
kubectl describe deployment nginx-ingress-controller -n ingress

# Describe pod
kubectl describe pod -n ingress <pod-name>

# View logs
kubectl logs -n ingress -l app=nginx-ingress-controller -f

# Scale replicas
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=5

# Restart deployment
kubectl rollout restart deployment/nginx-ingress-controller -n ingress

# Rollback deployment
kubectl rollout undo deployment/nginx-ingress-controller -n ingress
```

### Configuration Management

```bash
# View ConfigMap
kubectl get configmap -n ingress

# Edit ConfigMap
kubectl edit configmap nginx-config -n ingress

# Apply configuration changes
kubectl apply -f deployment/nginx-configmap.yaml

# View Ingress rules
kubectl get ingress -n ingress -o yaml

# Edit Ingress
kubectl edit ingress fitquest-api-gateway -n ingress

# Apply Ingress changes
kubectl apply -f ingress/fitquest-ingress.yaml
```

### Certificate Management

```bash
# View certificate secret
kubectl get secret fitquest-tls -n ingress

# Check certificate expiration
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Regenerate certificate
./scripts/generate-certificates.sh --self-signed

# Delete certificate
kubectl delete secret fitquest-tls -n ingress
```

### Monitoring and Debugging

```bash
# Port forward to metrics
kubectl port-forward -n ingress svc/nginx-ingress-controller-metrics 10254:10254

# View metrics
curl http://localhost:10254/metrics

# Port forward to service
kubectl port-forward -n ingress svc/nginx-ingress-controller 8080:80

# Test API Gateway
curl http://localhost:8080/health

# Execute command in pod
kubectl exec -n ingress <pod-name> -- <command>

# Copy file from pod
kubectl cp ingress/<pod-name>:/etc/nginx/nginx.conf ./nginx.conf

# Get pod events
kubectl get events -n ingress --sort-by='.lastTimestamp'

# Get resource usage
kubectl top pods -n ingress
kubectl top nodes
```

## Configuration Quick Reference

### Rate Limiting

**File**: `ingress/rate-limit-config.yaml`

```yaml
# Per-user rate limit: 100 requests per minute
limit_req_zone $http_x_user_id zone=user_limit:10m rate=100r/m;

# Per-IP rate limit: 50 requests per minute
limit_req_zone $binary_remote_addr zone=ip_limit:10m rate=50r/m;
```

### Routing Rules

**File**: `ingress/fitquest-ingress.yaml`

```yaml
- path: /new-service
  pathType: Prefix
  backend:
    service:
      name: new-service
      port:
        number: 8080
```

### TLS Configuration

**File**: `deployment/nginx-configmap.yaml`

```yaml
ssl-protocols: "TLSv1.2 TLSv1.3"
ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:..."
ssl-session-cache: "shared:SSL:10m"
ssl-session-timeout: "10m"
```

### Security Headers

**File**: `deployment/nginx-configmap.yaml`

```yaml
X-Frame-Options: "SAMEORIGIN"
X-Content-Type-Options: "nosniff"
X-XSS-Protection: "1; mode=block"
Strict-Transport-Security: "max-age=31536000; includeSubDomains; preload"
Content-Security-Policy: "default-src 'self'; ..."
```

## Troubleshooting Quick Reference

### Pods not starting

```bash
# Check pod status
kubectl get pods -n ingress

# Describe pod
kubectl describe pod -n ingress <pod-name>

# View logs
kubectl logs -n ingress <pod-name>

# Check events
kubectl get events -n ingress --sort-by='.lastTimestamp'
```

### Service not accessible

```bash
# Check service has external IP
kubectl get svc nginx-ingress-controller -n ingress

# Check endpoints
kubectl get endpoints nginx-ingress-controller -n ingress

# Test connectivity
kubectl exec -n ingress <pod-name> -- curl -v http://localhost:80/health
```

### Ingress not routing

```bash
# Check ingress status
kubectl get ingress -n ingress

# Describe ingress
kubectl describe ingress fitquest-api-gateway -n ingress

# Check backend services
kubectl get svc -n fitquest

# Test from pod
kubectl exec -n ingress <pod-name> -- curl -v http://auth-service.fitquest.svc.cluster.local:8080/health
```

### TLS certificate issues

```bash
# Check certificate secret
kubectl get secret fitquest-tls -n ingress

# Check certificate expiration
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Regenerate certificate
./scripts/generate-certificates.sh --self-signed
```

### Rate limiting not working

```bash
# Check rate limit configuration
kubectl get configmap rate-limit-config -n ingress -o yaml

# Check Nginx configuration
kubectl exec -n ingress <pod-name> -- cat /etc/nginx/nginx.conf | grep limit_req

# Test rate limiting
for i in {1..150}; do curl -s -o /dev/null -w "%{http_code}\n" http://<external-ip>/health; done
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

## Testing

### Test Rate Limiting

```bash
# Send 150 requests (should get 429 after 100)
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://<external-ip>/health
done
```

### Test Authentication

```bash
# Without token (should fail)
curl -v http://<external-ip>/workouts

# With token (should succeed)
curl -v -H "Authorization: Bearer <token>" http://<external-ip>/workouts
```

### Test TLS

```bash
# Check certificate
openssl s_client -connect <external-ip>:443 -showcerts

# Check certificate expiration
openssl s_client -connect <external-ip>:443 -showcerts | openssl x509 -noout -enddate
```

### Test Performance

```bash
# Measure response time
time curl http://<external-ip>/health

# Measure with Apache Bench
ab -n 1000 -c 10 http://<external-ip>/health

# Measure with wrk
wrk -t4 -c100 -d30s http://<external-ip>/health
```

## File Locations

```
infrastructure/kubernetes/api-gateway/
├── deployment/
│   ├── nginx-ingress-controller.yaml
│   ├── nginx-service.yaml
│   ├── nginx-configmap.yaml
│   └── nginx-rbac.yaml
├── ingress/
│   ├── fitquest-ingress.yaml
│   └── rate-limit-config.yaml
├── auth/
│   ├── auth-middleware.yaml
│   └── jwt-secret-template.yaml
├── scripts/
│   ├── setup-api-gateway.sh
│   ├── generate-certificates.sh
│   ├── verify-api-gateway.sh
│   └── cleanup.sh
└── docs/
    ├── SETUP_GUIDE.md
    └── TROUBLESHOOTING.md
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# API Gateway commands
alias kgapi='kubectl get all -n ingress'
alias klapi='kubectl logs -n ingress -l app=nginx-ingress-controller -f'
alias kdapi='kubectl describe pod -n ingress'
alias keapi='kubectl get events -n ingress --sort-by=".lastTimestamp"'
alias kpapi='kubectl port-forward -n ingress svc/nginx-ingress-controller-metrics 10254:10254'
```

## External IP/Hostname

Get the external IP or hostname:

```bash
# Get external IP
kubectl get svc nginx-ingress-controller -n ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Get external hostname
kubectl get svc nginx-ingress-controller -n ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Get both
kubectl get svc nginx-ingress-controller -n ingress -o wide
```

## Important Notes

- All scripts are idempotent and can be run multiple times safely
- Configuration changes require reapplying manifests or restarting pods
- TLS certificates should be renewed before expiration
- Rate limits can be adjusted based on actual usage patterns
- Monitor resource usage and scale as needed
- Keep logs for audit trail and troubleshooting

## Support

- Setup Guide: `docs/SETUP_GUIDE.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Implementation Summary: `IMPLEMENTATION_SUMMARY.md`
- Deployment Checklist: `DEPLOYMENT_CHECKLIST.md`
