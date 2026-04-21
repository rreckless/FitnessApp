# API Gateway Deployment Checklist

Use this checklist to verify the API Gateway deployment is complete and operational.

## Pre-Deployment

- [ ] Kubernetes cluster is running and accessible
- [ ] kubectl is configured and authenticated
- [ ] OpenSSL is installed for certificate generation
- [ ] Sufficient cluster resources available (3+ nodes recommended)
- [ ] Ingress namespace will be created (or already exists)

## Deployment Steps

### Phase 1: RBAC and Configuration

- [ ] Run: `kubectl apply -f deployment/nginx-rbac.yaml`
- [ ] Verify ServiceAccount created: `kubectl get sa -n ingress`
- [ ] Verify ClusterRole created: `kubectl get clusterrole nginx-ingress-controller`
- [ ] Verify ClusterRoleBinding created: `kubectl get clusterrolebinding nginx-ingress-controller`

### Phase 2: ConfigMaps

- [ ] Run: `kubectl apply -f deployment/nginx-configmap.yaml`
- [ ] Verify ConfigMaps created: `kubectl get configmap -n ingress`
- [ ] Verify nginx-config exists: `kubectl get configmap nginx-config -n ingress`
- [ ] Verify tcp-services exists: `kubectl get configmap tcp-services -n ingress`
- [ ] Verify udp-services exists: `kubectl get configmap udp-services -n ingress`

### Phase 3: Services

- [ ] Run: `kubectl apply -f deployment/nginx-service.yaml`
- [ ] Verify LoadBalancer service created: `kubectl get svc nginx-ingress-controller -n ingress`
- [ ] Verify ClusterIP service created: `kubectl get svc nginx-ingress-controller-metrics -n ingress`
- [ ] Verify IngressClass created: `kubectl get ingressclass nginx`

### Phase 4: Deployment

- [ ] Run: `kubectl apply -f deployment/nginx-ingress-controller.yaml`
- [ ] Wait for rollout: `kubectl rollout status deployment/nginx-ingress-controller -n ingress`
- [ ] Verify 3+ replicas running: `kubectl get deployment nginx-ingress-controller -n ingress`
- [ ] Verify all pods in Running state: `kubectl get pods -n ingress`
- [ ] Verify PDB created: `kubectl get pdb -n ingress`
- [ ] Verify HPA created: `kubectl get hpa -n ingress`

### Phase 5: TLS Certificates

- [ ] Generate certificates: `./scripts/generate-certificates.sh --self-signed`
- [ ] Verify secret created: `kubectl get secret fitquest-tls -n ingress`
- [ ] Verify certificate details: `kubectl get secret fitquest-tls -n ingress -o yaml`

### Phase 6: Ingress Resources

- [ ] Run: `kubectl apply -f ingress/fitquest-ingress.yaml`
- [ ] Verify main ingress created: `kubectl get ingress fitquest-api-gateway -n ingress`
- [ ] Verify public ingress created: `kubectl get ingress fitquest-api-gateway-public -n ingress`
- [ ] Verify ingress has IP/hostname: `kubectl get ingress -n ingress`

### Phase 7: Rate Limiting Configuration

- [ ] Run: `kubectl apply -f ingress/rate-limit-config.yaml`
- [ ] Verify ConfigMap created: `kubectl get configmap rate-limit-config -n ingress`

### Phase 8: Authentication Configuration

- [ ] Run: `kubectl apply -f auth/auth-middleware.yaml`
- [ ] Verify ConfigMap created: `kubectl get configmap auth-middleware-config -n ingress`
- [ ] Create JWT secret: `kubectl create secret generic jwt-secret --from-literal=jwt-secret=<your-secret> -n ingress`
- [ ] Verify secret created: `kubectl get secret jwt-secret -n ingress`

## Post-Deployment Verification

### Basic Checks

- [ ] All pods in Running state: `kubectl get pods -n ingress`
- [ ] All pods ready: `kubectl get pods -n ingress -o wide`
- [ ] Service has external IP/hostname: `kubectl get svc nginx-ingress-controller -n ingress`
- [ ] Ingress has IP/hostname: `kubectl get ingress -n ingress`

### Connectivity Checks

- [ ] Can reach API Gateway: `curl -v http://<external-ip>`
- [ ] HTTPS works: `curl -v https://<external-ip> -k`
- [ ] Health endpoint responds: `curl http://<external-ip>/health`
- [ ] Metrics endpoint responds: `kubectl port-forward -n ingress svc/nginx-ingress-controller-metrics 10254:10254 && curl http://localhost:10254/metrics`

### Configuration Checks

- [ ] Rate limiting configured: `kubectl get configmap rate-limit-config -n ingress -o yaml`
- [ ] Authentication configured: `kubectl get configmap auth-middleware-config -n ingress -o yaml`
- [ ] TLS certificate valid: `kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -text`

### Routing Checks

- [ ] Auth service route works: `curl http://<external-ip>/auth/login`
- [ ] Workout service route works: `curl http://<external-ip>/workouts`
- [ ] Leaderboard service route works: `curl http://<external-ip>/leaderboards`

### Security Checks

- [ ] TLS 1.2+ enforced: `openssl s_client -connect <external-ip>:443 -tls1_2`
- [ ] Security headers present: `curl -v https://<external-ip> -k | grep -i "x-frame-options\|x-content-type\|strict-transport"`
- [ ] Rate limiting working: Send 150+ requests and verify 429 responses
- [ ] Authentication required: `curl http://<external-ip>/workouts` should return 401

### Performance Checks

- [ ] Response time < 100ms: `time curl http://<external-ip>/health`
- [ ] Handles concurrent requests: `ab -n 1000 -c 100 http://<external-ip>/health`
- [ ] CPU usage reasonable: `kubectl top pods -n ingress`
- [ ] Memory usage reasonable: `kubectl top pods -n ingress`

## Automated Verification

Run the verification script:

```bash
./scripts/verify-api-gateway.sh
```

This will check:
- [ ] Namespace exists
- [ ] RBAC configured
- [ ] ConfigMaps deployed
- [ ] Services deployed
- [ ] Deployment ready
- [ ] Pods running
- [ ] TLS certificate valid
- [ ] Ingress configured
- [ ] Metrics accessible

## Troubleshooting

If any checks fail:

1. Check logs: `kubectl logs -n ingress -l app=nginx-ingress-controller -f`
2. Describe resources: `kubectl describe pod -n ingress <pod-name>`
3. Check events: `kubectl get events -n ingress --sort-by='.lastTimestamp'`
4. Review troubleshooting guide: `docs/TROUBLESHOOTING.md`

## Configuration Verification

### Rate Limiting

Test rate limiting:

```bash
# Send 150 requests (should get 429 after 100)
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://<external-ip>/health
done
```

### Authentication

Test authentication:

```bash
# Without token (should fail)
curl -v http://<external-ip>/workouts

# With valid token (should succeed)
curl -v -H "Authorization: Bearer <token>" http://<external-ip>/workouts
```

### TLS/SSL

Test TLS:

```bash
# Check certificate
openssl s_client -connect <external-ip>:443 -showcerts

# Check certificate expiration
openssl s_client -connect <external-ip>:443 -showcerts | openssl x509 -noout -enddate
```

## Performance Benchmarking

### Latency Test

```bash
# Measure response time
time curl http://<external-ip>/health

# Measure with Apache Bench
ab -n 1000 -c 10 http://<external-ip>/health
```

### Throughput Test

```bash
# Measure requests per second
ab -n 10000 -c 100 http://<external-ip>/health
```

### Load Test

```bash
# Simulate load with wrk
wrk -t4 -c100 -d30s http://<external-ip>/health
```

## Monitoring Setup

### Prometheus Metrics

```bash
# Port forward to metrics
kubectl port-forward -n ingress svc/nginx-ingress-controller-metrics 10254:10254

# View metrics
curl http://localhost:10254/metrics | grep nginx_ingress
```

### Logs

```bash
# Stream logs
kubectl logs -n ingress -l app=nginx-ingress-controller -f

# View logs with timestamps
kubectl logs -n ingress -l app=nginx-ingress-controller --timestamps=true -f

# View logs from specific pod
kubectl logs -n ingress <pod-name> -f
```

## Maintenance Tasks

### Certificate Renewal

```bash
# Check expiration
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Renew certificate
./scripts/generate-certificates.sh --self-signed
```

### Configuration Updates

```bash
# Update rate limiting
kubectl apply -f ingress/rate-limit-config.yaml

# Update authentication
kubectl apply -f auth/auth-middleware.yaml

# Update Nginx configuration
kubectl apply -f deployment/nginx-configmap.yaml
```

### Scaling

```bash
# Increase replicas
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=5

# Decrease replicas
kubectl scale deployment nginx-ingress-controller -n ingress --replicas=3
```

## Cleanup

To remove all API Gateway resources:

```bash
./scripts/cleanup.sh
```

## Sign-Off

- [ ] All deployment steps completed
- [ ] All verification checks passed
- [ ] Performance benchmarks acceptable
- [ ] Monitoring configured
- [ ] Documentation reviewed
- [ ] Team trained on operations

**Deployment Date**: _______________

**Deployed By**: _______________

**Verified By**: _______________

**Notes**: _______________________________________________________________
