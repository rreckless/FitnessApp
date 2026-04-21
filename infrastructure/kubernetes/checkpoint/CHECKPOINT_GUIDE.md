# FitQuest Phase 1 Infrastructure Checkpoint Guide

## Overview

This checkpoint verifies that all Phase 1 infrastructure components for the FitQuest Gamified Fitness application are operational and ready for microservice deployment.

## Checkpoint Scope

The Phase 1 checkpoint validates:

1. **Kubernetes Cluster** - Cluster health, nodes, namespaces, API server
2. **API Gateway** - Nginx Ingress deployment, routing, TLS certificates
3. **Message Queue** - RabbitMQ cluster, exchanges, queues, connectivity
4. **Redis Cluster** - Redis nodes, Sentinel, replication, persistence
5. **PostgreSQL Database** - Database pods, replication, backups, connectivity
6. **Monitoring Stack** - Prometheus, Grafana, Jaeger, Loki, Alertmanager
7. **Microservices Routing** - Service discovery for 16 microservices

## Quick Start

### Run Full Checkpoint Verification

```bash
cd infrastructure/kubernetes/checkpoint
chmod +x verify-all-infrastructure.sh
./verify-all-infrastructure.sh
```

### Run Individual Component Verification

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

## Verification Checklist

### 1. Kubernetes Cluster

- [ ] Cluster access verified
- [ ] All nodes in Ready state
- [ ] Required namespaces exist (fitquest, monitoring, ingress)
- [ ] API server responding
- [ ] DNS pods running
- [ ] Metrics server installed
- [ ] Storage classes available

**Expected Results:**
- 3+ nodes in Ready state
- 3 namespaces: fitquest, monitoring, ingress
- kube-dns pods running in kube-system
- metrics-server deployment in kube-system

### 2. API Gateway (Nginx Ingress)

- [ ] Deployment exists in ingress namespace
- [ ] 3+ replicas running
- [ ] LoadBalancer service has external endpoint
- [ ] TLS certificate configured
- [ ] Ingress resource created
- [ ] Metrics endpoint accessible

**Expected Results:**
- nginx-ingress-controller deployment with 3+ ready replicas
- External IP or hostname assigned to LoadBalancer service
- fitquest-tls secret exists
- fitquest-api-gateway ingress resource exists

### 3. RabbitMQ Message Queue

- [ ] StatefulSet deployed with 3+ replicas
- [ ] All pods running and ready
- [ ] Cluster status verified
- [ ] Exchanges created (12 event exchanges + 6 DLX exchanges)
- [ ] Queues created (20+ queues)
- [ ] Persistent storage configured
- [ ] Metrics endpoint accessible

**Expected Results:**
- rabbitmq StatefulSet with 3 ready replicas
- rabbitmq-0, rabbitmq-1, rabbitmq-2 pods running
- Cluster status shows all nodes connected
- All event exchanges and queues present
- 3 PVCs bound for data persistence

### 4. Redis Cluster

- [ ] 3+ Redis pods running
- [ ] 3+ Sentinel pods running
- [ ] Redis responding to ping
- [ ] Replication active (2+ slaves)
- [ ] Persistent storage configured
- [ ] Sentinel monitoring master
- [ ] ServiceMonitors configured

**Expected Results:**
- redis-cluster-0, redis-cluster-1, redis-cluster-2 pods running
- redis-sentinel-0, redis-sentinel-1, redis-sentinel-2 pods running
- Redis master with 2+ connected slaves
- 3 PVCs bound for Redis data
- 3 PVCs bound for Sentinel data

### 5. PostgreSQL Database

- [ ] 3 pods running (1 primary, 2 replicas)
- [ ] Primary pod responding to queries
- [ ] Replication active (2+ replicas connected)
- [ ] Shared databases created (users, exercises, achievements)
- [ ] Persistent storage configured
- [ ] Backup CronJob configured
- [ ] ServiceMonitor configured

**Expected Results:**
- postgres-0, postgres-1, postgres-2 pods running
- Primary accepting connections
- 2+ replicas connected to primary
- 3 PVCs bound for data persistence
- postgres-backup CronJob exists

### 6. Monitoring Stack

- [ ] Prometheus deployment ready
- [ ] Grafana deployment ready
- [ ] Jaeger deployment ready
- [ ] Loki deployment ready
- [ ] Alertmanager deployment ready
- [ ] ServiceMonitors configured
- [ ] PrometheusRules configured
- [ ] Persistent storage for metrics/logs

**Expected Results:**
- All 5 monitoring components with ready replicas
- Prometheus scraping targets
- Grafana dashboards accessible
- Jaeger collecting traces
- Loki collecting logs
- Alertmanager configured with alert rules

### 7. Microservices Routing

- [ ] All 16 microservice services exist
- [ ] Services have cluster IPs assigned
- [ ] Services have endpoints configured
- [ ] Ingress routes to services

**Expected Results:**
- 16 services in fitquest namespace:
  - auth-service
  - user-profile-service
  - workout-service
  - xp-service
  - achievement-service
  - leaderboard-service
  - streak-service
  - activity-feed-service
  - body-tracking-service
  - progress-tracking-service
  - muscle-group-rank-service
  - friend-service
  - challenge-service
  - route-service
  - sync-service
  - fraud-detection-service

## Troubleshooting

### Cluster Issues

**Problem:** Nodes not in Ready state

```bash
# Check node status
kubectl get nodes -o wide

# Describe problematic node
kubectl describe node <node-name>

# Check node logs
kubectl logs -n kube-system <node-pod>
```

**Problem:** Namespaces missing

```bash
# Create missing namespaces
kubectl apply -f namespaces/fitquest-namespace.yaml
kubectl apply -f namespaces/monitoring-namespace.yaml
kubectl apply -f namespaces/ingress-namespace.yaml
```

### API Gateway Issues

**Problem:** LoadBalancer external endpoint not assigned

```bash
# Check service status
kubectl get svc -n ingress nginx-ingress-controller

# Check ingress controller logs
kubectl logs -n ingress -l app=nginx-ingress-controller
```

**Problem:** TLS certificate not found

```bash
# Generate certificates
cd api-gateway/scripts
./generate-certificates.sh
```

### RabbitMQ Issues

**Problem:** Pods not starting

```bash
# Check pod logs
kubectl logs -n fitquest rabbitmq-0

# Check events
kubectl get events -n fitquest --sort-by='.lastTimestamp'

# Check PVC status
kubectl get pvc -n fitquest -l app=rabbitmq
```

**Problem:** Cluster not forming

```bash
# Check cluster status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Reset cluster if needed
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl reset
```

### Redis Issues

**Problem:** Replication not working

```bash
# Check replication status
kubectl exec -it -n fitquest redis-cluster-0 -- redis-cli info replication

# Check Sentinel status
kubectl exec -it -n fitquest redis-sentinel-0 -- redis-cli -p 26379 sentinel masters
```

### PostgreSQL Issues

**Problem:** Replication not active

```bash
# Check replication status
kubectl exec -it -n fitquest postgres-0 -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check primary/replica status
kubectl exec -it -n fitquest postgres-0 -- psql -U postgres -c "SELECT pg_is_in_recovery();"
```

### Monitoring Issues

**Problem:** Prometheus not scraping targets

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check ServiceMonitors
kubectl get servicemonitor -n monitoring
```

**Problem:** Grafana dashboards not loading

```bash
# Check Grafana logs
kubectl logs -n monitoring -l app=grafana

# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Visit http://localhost:3000
```

## Performance Baselines

### Expected Resource Usage

**Kubernetes Cluster:**
- Minimum 3 nodes
- 4+ CPU cores per node
- 8+ GB RAM per node

**API Gateway:**
- 3 replicas
- 500m CPU per replica
- 256Mi memory per replica

**RabbitMQ:**
- 3 replicas
- 1 CPU per replica
- 1Gi memory per replica
- 10Gi storage per replica

**Redis:**
- 3 replicas
- 500m CPU per replica
- 512Mi memory per replica
- 5Gi storage per replica

**PostgreSQL:**
- 3 replicas
- 1 CPU per replica
- 2Gi memory per replica
- 20Gi storage per replica

**Monitoring Stack:**
- Prometheus: 1 CPU, 2Gi memory, 50Gi storage
- Grafana: 500m CPU, 512Mi memory, 5Gi storage
- Jaeger: 500m CPU, 512Mi memory, 10Gi storage
- Loki: 500m CPU, 512Mi memory, 10Gi storage
- Alertmanager: 250m CPU, 256Mi memory, 1Gi storage

## Next Steps

After successful checkpoint verification:

1. **Deploy Microservices** - Deploy the 16 .NET 10 microservices
2. **Configure Service Mesh** - Set up Istio or Linkerd for service communication
3. **Deploy CI/CD Pipeline** - Configure GitHub Actions for automated deployments
4. **Load Testing** - Perform load testing to validate performance
5. **Security Hardening** - Apply security policies and network policies
6. **Backup Verification** - Test backup and recovery procedures

## Support

For issues or questions:

1. Check the TROUBLESHOOTING.md files in each component directory
2. Review logs: `kubectl logs -n <namespace> <pod-name>`
3. Check events: `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
4. Describe resources: `kubectl describe <resource-type> <resource-name> -n <namespace>`

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [RabbitMQ Kubernetes](https://www.rabbitmq.com/kubernetes/operator/operator-overview.html)
- [Redis Operator](https://github.com/spotahome/redis-operator)
- [PostgreSQL Operator](https://github.com/zalando/postgres-operator)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
