# FitQuest Infrastructure Checkpoint - Quick Reference Card

## Quick Start

```bash
cd infrastructure/kubernetes/checkpoint
chmod +x verify-all-infrastructure.sh
./verify-all-infrastructure.sh
```

## Verification Checklist

### Kubernetes Cluster
- [ ] Cluster access verified
- [ ] All nodes Ready
- [ ] Namespaces: fitquest, monitoring, ingress
- [ ] API server responding
- [ ] DNS pods running
- [ ] Metrics server installed

### API Gateway (Nginx Ingress)
- [ ] Deployment: 3+ replicas ready
- [ ] Service: LoadBalancer with external IP
- [ ] TLS certificate: fitquest-tls secret exists
- [ ] Ingress: fitquest-api-gateway exists
- [ ] Metrics: Endpoint accessible

### RabbitMQ
- [ ] StatefulSet: 3 replicas ready
- [ ] Pods: rabbitmq-0, rabbitmq-1, rabbitmq-2 running
- [ ] Cluster: All nodes connected
- [ ] Exchanges: 12 event + 6 DLX created
- [ ] Queues: 20+ queues created
- [ ] Storage: 3 PVCs bound

### Redis
- [ ] Pods: redis-cluster-0, redis-cluster-1, redis-cluster-2 running
- [ ] Sentinel: redis-sentinel-0, redis-sentinel-1, redis-sentinel-2 running
- [ ] Replication: 2+ slaves connected
- [ ] Storage: 6 PVCs bound (3 Redis + 3 Sentinel)

### PostgreSQL
- [ ] Pods: postgres-0, postgres-1, postgres-2 running
- [ ] Primary: Accepting connections
- [ ] Replication: 2+ replicas connected
- [ ] Databases: users, exercises, achievements created
- [ ] Storage: 3 PVCs bound
- [ ] Backups: postgres-backup CronJob exists

### Monitoring Stack
- [ ] Prometheus: Deployment ready
- [ ] Grafana: Deployment ready
- [ ] Jaeger: Deployment ready
- [ ] Loki: Deployment ready
- [ ] Alertmanager: Deployment ready
- [ ] ServiceMonitors: Configured
- [ ] Storage: All PVCs bound

### Microservices (16 services)
- [ ] auth-service
- [ ] user-profile-service
- [ ] workout-service
- [ ] xp-service
- [ ] achievement-service
- [ ] leaderboard-service
- [ ] streak-service
- [ ] activity-feed-service
- [ ] body-tracking-service
- [ ] progress-tracking-service
- [ ] muscle-group-rank-service
- [ ] friend-service
- [ ] challenge-service
- [ ] route-service
- [ ] sync-service
- [ ] fraud-detection-service

## Common Commands

### Cluster Status
```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get namespaces
kubectl get all -A
```

### Component Status
```bash
# API Gateway
kubectl get all -n ingress

# RabbitMQ
kubectl get statefulset -n fitquest rabbitmq
kubectl get pods -n fitquest -l app=rabbitmq

# Redis
kubectl get statefulset -n fitquest redis-cluster
kubectl get pods -n fitquest -l app=redis-cluster

# PostgreSQL
kubectl get statefulset -n fitquest postgres
kubectl get pods -n fitquest -l app=postgres

# Monitoring
kubectl get all -n monitoring
```

### Logs and Debugging
```bash
# View logs
kubectl logs -n <namespace> <pod-name>

# Follow logs
kubectl logs -f -n <namespace> <pod-name>

# Previous logs (if pod crashed)
kubectl logs -n <namespace> <pod-name> --previous

# Describe pod
kubectl describe pod -n <namespace> <pod-name>

# Get events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Port Forwarding
```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Jaeger
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686

# Loki
kubectl port-forward -n monitoring svc/loki 3100:3100

# PostgreSQL
kubectl port-forward -n fitquest svc/postgres 5432:5432

# Redis
kubectl port-forward -n fitquest svc/redis-cluster 6379:6379
```

### Component-Specific Verification
```bash
# Kubernetes cluster
../scripts/verify-cluster.sh

# API Gateway
../api-gateway/scripts/verify-api-gateway.sh

# RabbitMQ
../message-queue/scripts/verify-rabbitmq.sh

# Redis
../redis/scripts/verify-redis-cluster.sh

# PostgreSQL
../database/scripts/verify-postgres.sh

# Monitoring
../monitoring/verify-monitoring-stack.sh
```

## Troubleshooting Quick Reference

### Pods Not Starting
```bash
# Check pod status
kubectl get pods -n <namespace>

# View logs
kubectl logs -n <namespace> <pod-name>

# Describe pod
kubectl describe pod -n <namespace> <pod-name>

# Check events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Storage Issues
```bash
# Check PVCs
kubectl get pvc -n <namespace>

# Check PVs
kubectl get pv

# Describe PVC
kubectl describe pvc <pvc-name> -n <namespace>

# Check storage classes
kubectl get storageclass
```

### Connectivity Issues
```bash
# Test DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service-name>.fitquest.svc.cluster.local

# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>.fitquest.svc.cluster.local

# Check endpoints
kubectl get endpoints -n <namespace>

# Check services
kubectl get svc -n <namespace>
```

### RabbitMQ Issues
```bash
# Check cluster status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Check exchanges
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges

# Check queues
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues

# Check connectivity
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q ping
```

### Redis Issues
```bash
# Check replication
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info replication

# Check memory
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info memory

# Check Sentinel status
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379 sentinel masters

# Test connectivity
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli ping
```

### PostgreSQL Issues
```bash
# Check replication
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check databases
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -l

# Check connectivity
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SELECT 1;"

# Check recovery status
kubectl exec -it postgres-1 -n fitquest -- psql -U postgres -c "SELECT pg_is_in_recovery();"
```

### Monitoring Issues
```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check Grafana datasources
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Visit http://localhost:3000

# Check ServiceMonitors
kubectl get servicemonitor -n monitoring

# Check PrometheusRules
kubectl get prometheusrule -n monitoring
```

## Resource Limits

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| API Gateway (per replica) | 500m | 256Mi | - |
| RabbitMQ (per replica) | 1 | 1Gi | 10Gi |
| Redis (per replica) | 500m | 512Mi | 5Gi |
| PostgreSQL (per replica) | 1 | 2Gi | 20Gi |
| Prometheus | 1 | 2Gi | 50Gi |
| Grafana | 500m | 512Mi | 5Gi |
| Jaeger | 500m | 512Mi | 10Gi |
| Loki | 500m | 512Mi | 10Gi |
| Alertmanager | 250m | 256Mi | 1Gi |

## Expected Latencies

| Operation | Latency |
|-----------|---------|
| API Gateway response | < 100ms |
| Database query | < 50ms |
| Message queue processing | < 1s |
| Metrics collection | < 5s |
| DNS resolution | < 10ms |

## Useful URLs (After Port Forwarding)

| Service | URL | Port |
|---------|-----|------|
| Prometheus | http://localhost:9090 | 9090 |
| Grafana | http://localhost:3000 | 3000 |
| Jaeger | http://localhost:16686 | 16686 |
| Loki | http://localhost:3100 | 3100 |
| Alertmanager | http://localhost:9093 | 9093 |

## Default Credentials

| Service | Username | Password | Notes |
|---------|----------|----------|-------|
| Grafana | admin | admin | Change on first login |
| PostgreSQL | postgres | [secret] | Check postgres-secret |
| RabbitMQ | guest | guest | Default user |

## Documentation Files

| File | Purpose |
|------|---------|
| README.md | Overview and quick reference |
| CHECKPOINT_GUIDE.md | Comprehensive guide |
| VERIFICATION_TEMPLATE.md | Results template |
| ISSUES_AND_REMEDIATION.md | Troubleshooting guide |
| IMPLEMENTATION_SUMMARY.md | Implementation details |
| QUICK_REFERENCE.md | This file |

## Next Steps After Checkpoint

1. ✓ Review checkpoint report
2. ✓ Address any critical issues
3. → Deploy 16 microservices
4. → Configure service mesh
5. → Set up CI/CD pipeline
6. → Perform load testing
7. → Implement security hardening

## Support

- **Documentation:** See files in this directory
- **Logs:** `kubectl logs -n <namespace> <pod-name>`
- **Events:** `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
- **Metrics:** Port forward to Prometheus/Grafana
- **Traces:** Port forward to Jaeger

---

**Last Updated:** 2024  
**Version:** 1.0
