# API Gateway Troubleshooting Guide

Common issues and solutions for the FitQuest API Gateway.

## Deployment Issues

### Pods not starting

**Symptoms**: Pods stuck in Pending, CrashLoopBackOff, or ImagePullBackOff state

**Solutions**:

```bash
# Check pod status
kubectl get pods -n ingress

# Describe pod for details
kubectl describe pod -n ingress <pod-name>

# Check events
kubectl get events -n ingress --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n ingress <pod-name>
```

**Common causes**:
- Insufficient resources: Scale down other workloads or add nodes
- Image pull errors: Check image registry credentials
- RBAC issues: Verify ServiceAccount has required permissions

### Deployment not rolling out

**Symptoms**: Deployment stuck in rolling update

**Solutions**:

```bash
# Check rollout status
kubectl rollout status deployment/nginx-ingress-controller -n ingress

# Check replica status
kubectl get deployment nginx-ingress-controller -n ingress

# Rollback if needed
kubectl rollout undo deployment/nginx-ingress-controller -n ingress
```

## Service Issues

### LoadBalancer IP not assigned

**Symptoms**: External IP shows `<pending>`

**Solutions**:

```bash
# Check service status
kubectl get svc nginx-ingress-controller -n ingress

# For AWS EKS:
# - Check security groups allow traffic on ports 80, 443
# - Check load balancer is created in AWS console
# - Wait 5-10 minutes for IP assignment

# For Azure AKS:
# - Check network security groups allow traffic
# - Check public IP is created
# - Wait 5-10 minutes for IP assignment

# For on-premises:
# - Check MetalLB is installed and configured
# - Check IP pool has available addresses
```

### Service not routing traffic

**Symptoms**: Connection refused or timeout

**Solutions**:

```bash
# Check service endpoints
kubectl get endpoints nginx-ingress-controller -n ingress

# Check service selector matches pods
kubectl get pods -n ingress -l app=nginx-ingress-controller

# Test connectivity from pod
kubectl exec -n ingress <pod-name> -- curl -v http://localhost:80/health

# Check network policies
kubectl get networkpolicy -n ingress
```

## Ingress Issues

### Ingress not routing requests

**Symptoms**: 404 Not Found or connection refused

**Solutions**:

```bash
# Check ingress status
kubectl get ingress -n ingress

# Describe ingress
kubectl describe ingress fitquest-api-gateway -n ingress

# Check ingress rules
kubectl get ingress fitquest-api-gateway -n ingress -o yaml

# Test ingress from pod
kubectl exec -n ingress <pod-name> -- curl -v http://localhost/health

# Check backend services exist
kubectl get svc -n fitquest
```

### Ingress rules not matching

**Symptoms**: Requests go to wrong backend or 404

**Solutions**:

```bash
# Verify path matching
# Check pathType: Prefix vs Exact

# Test with curl
curl -v http://<external-ip>/workouts

# Check Nginx configuration
kubectl exec -n ingress <pod-name> -- cat /etc/nginx/nginx.conf | grep -A 5 "location"

# Check logs for routing decisions
kubectl logs -n ingress <pod-name> | grep "upstream"
```

## TLS/SSL Issues

### Certificate not found

**Symptoms**: SSL certificate error or 404

**Solutions**:

```bash
# Check secret exists
kubectl get secret fitquest-tls -n ingress

# Check secret content
kubectl get secret fitquest-tls -n ingress -o yaml

# Recreate secret if needed
./scripts/generate-certificates.sh --self-signed
```

### Certificate expired

**Symptoms**: Browser warning about expired certificate

**Solutions**:

```bash
# Check expiration date
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Regenerate certificate
./scripts/generate-certificates.sh --self-signed

# For Let's Encrypt, renew automatically
./scripts/generate-certificates.sh --letsencrypt --domain api.fitquest.com
```

### HTTPS not working

**Symptoms**: Connection refused on port 443

**Solutions**:

```bash
# Check TLS is enabled in ingress
kubectl get ingress fitquest-api-gateway -n ingress -o yaml | grep -A 5 "tls:"

# Check certificate secret is referenced
kubectl get ingress fitquest-api-gateway -n ingress -o yaml | grep -A 2 "secretName"

# Test TLS connection
openssl s_client -connect <external-ip>:443

# Check Nginx TLS configuration
kubectl exec -n ingress <pod-name> -- cat /etc/nginx/nginx.conf | grep -A 5 "ssl_"
```

## Rate Limiting Issues

### Rate limiting not working

**Symptoms**: No 429 responses even with many requests

**Solutions**:

```bash
# Check rate limit configuration
kubectl get configmap rate-limit-config -n ingress -o yaml

# Check Nginx rate limit configuration
kubectl exec -n ingress <pod-name> -- cat /etc/nginx/nginx.conf | grep limit_req

# Check rate limit logs
kubectl logs -n ingress <pod-name> | grep "limiting requests"

# Test rate limiting
for i in {1..150}; do curl -s http://<external-ip>/health; done
```

### Rate limiting too strict

**Symptoms**: Legitimate requests getting 429 responses

**Solutions**:

```bash
# Increase rate limit in rate-limit-config.yaml
# Change: rate=100r/m to rate=200r/m

kubectl apply -f ingress/rate-limit-config.yaml

# Reload Nginx
kubectl exec -n ingress <pod-name> -- nginx -s reload
```

## Authentication Issues

### Authentication not validating

**Symptoms**: All requests rejected with 401

**Solutions**:

```bash
# Check auth middleware configuration
kubectl get configmap auth-middleware-config -n ingress -o yaml

# Check JWT secret exists
kubectl get secret jwt-secret -n ingress

# Test auth endpoint
kubectl exec -n ingress <pod-name> -- curl -v \
  http://auth-service.fitquest.svc.cluster.local:8080/auth/validate

# Check auth service is running
kubectl get svc auth-service -n fitquest
kubectl get pods -n fitquest -l app=auth-service
```

### JWT token validation failing

**Symptoms**: Valid tokens rejected with 401

**Solutions**:

```bash
# Check JWT secret matches between services
kubectl get secret jwt-secret -n ingress -o yaml
kubectl get secret jwt-secret -n fitquest -o yaml

# Check token expiration
# Decode JWT: echo <token> | cut -d. -f2 | base64 -d

# Check token signature
# Verify token is signed with correct secret

# Check auth service logs
kubectl logs -n fitquest -l app=auth-service
```

## Performance Issues

### High latency

**Symptoms**: Requests taking > 1 second

**Solutions**:

```bash
# Check pod resource usage
kubectl top pods -n ingress

# Check node resource usage
kubectl top nodes

# Increase replicas
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=5

# Check backend service latency
kubectl logs -n ingress <pod-name> | grep "upstream_response_time"

# Enable caching
# Edit nginx-configmap.yaml and set proxy-cache: "true"
```

### High memory usage

**Symptoms**: Pods OOMKilled or memory pressure

**Solutions**:

```bash
# Check memory usage
kubectl top pods -n ingress

# Increase memory limit
# Edit nginx-ingress-controller.yaml and increase memory limit

# Reduce cache size
# Edit nginx-configmap.yaml and reduce proxy-cache-path size

# Reduce number of connections
# Edit nginx-configmap.yaml and reduce upstream-keepalive-connections
```

### High CPU usage

**Symptoms**: Pods using 100% CPU

**Solutions**:

```bash
# Check CPU usage
kubectl top pods -n ingress

# Increase CPU limit
# Edit nginx-ingress-controller.yaml and increase CPU limit

# Increase replicas for load distribution
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=5

# Optimize Nginx configuration
# Reduce logging verbosity
# Disable unnecessary modules
```

## Logging Issues

### No logs appearing

**Symptoms**: kubectl logs returns empty

**Solutions**:

```bash
# Check pod is running
kubectl get pods -n ingress

# Check logs exist
kubectl logs -n ingress <pod-name>

# Check previous logs if pod restarted
kubectl logs -n ingress <pod-name> --previous

# Check log level
# Edit nginx-configmap.yaml and set log-level: "debug"
```

### Too many logs

**Symptoms**: Logs filling up disk

**Solutions**:

```bash
# Reduce log verbosity
# Edit nginx-configmap.yaml and set log-level: "warn"

# Disable access logs
# Edit nginx-configmap.yaml and set enable-access-log: "false"

# Configure log rotation
# Edit nginx-configmap.yaml and add log rotation settings
```

## Network Issues

### Cannot reach backend services

**Symptoms**: 502 Bad Gateway or connection refused

**Solutions**:

```bash
# Check backend service exists
kubectl get svc -n fitquest

# Check backend pods are running
kubectl get pods -n fitquest

# Check network policies
kubectl get networkpolicy -n ingress
kubectl get networkpolicy -n fitquest

# Test connectivity from ingress pod
kubectl exec -n ingress <pod-name> -- curl -v \
  http://auth-service.fitquest.svc.cluster.local:8080/health

# Check DNS resolution
kubectl exec -n ingress <pod-name> -- nslookup auth-service.fitquest.svc.cluster.local
```

### DNS resolution failing

**Symptoms**: Name resolution errors

**Solutions**:

```bash
# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Test DNS from pod
kubectl exec -n ingress <pod-name> -- nslookup kubernetes.default

# Check DNS configuration
kubectl get configmap coredns -n kube-system -o yaml

# Restart CoreDNS if needed
kubectl rollout restart deployment/coredns -n kube-system
```

## Debugging Commands

```bash
# Get all resources in namespace
kubectl get all -n ingress

# Describe all pods
kubectl describe pods -n ingress

# Get events
kubectl get events -n ingress --sort-by='.lastTimestamp'

# Check resource usage
kubectl top nodes
kubectl top pods -n ingress

# Port forward for testing
kubectl port-forward -n ingress svc/nginx-ingress-controller 8080:80

# Execute commands in pod
kubectl exec -n ingress <pod-name> -- <command>

# Copy files from pod
kubectl cp ingress/<pod-name>:/etc/nginx/nginx.conf ./nginx.conf

# Stream logs
kubectl logs -n ingress -l app=nginx-ingress-controller -f

# Get pod YAML
kubectl get pod -n ingress <pod-name> -o yaml
```

## Getting Help

If you're still having issues:

1. Check the logs: `kubectl logs -n ingress -l app=nginx-ingress-controller -f`
2. Describe the resource: `kubectl describe <resource-type> <resource-name> -n ingress`
3. Check events: `kubectl get events -n ingress --sort-by='.lastTimestamp'`
4. Review the setup guide: `docs/SETUP_GUIDE.md`
5. Check Nginx documentation: https://nginx.org/en/docs/
6. Check Kubernetes documentation: https://kubernetes.io/docs/
