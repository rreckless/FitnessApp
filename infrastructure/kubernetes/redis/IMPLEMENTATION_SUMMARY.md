# Redis Cluster Implementation Summary

## Overview

This document summarizes the Redis cluster implementation for FitQuest, including architecture, deployment, configuration, and caching strategy.

## Architecture

### Components

1. **Redis Cluster (3 nodes)**
   - Master-slave replication
   - Persistent storage (10Gi per node)
   - Memory limit: 2GB per node
   - Persistence: RDB + AOF

2. **Redis Sentinel (3 nodes)**
   - Automatic failover
   - Master monitoring
   - Quorum-based decision making
   - Persistent storage (1Gi per node)

3. **Monitoring**
   - Prometheus metrics via redis_exporter
   - ServiceMonitor for automatic scraping
   - PrometheusRule for alerting
   - Grafana dashboards

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Redis Cluster (3 nodes)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ Master   │  │ Slave 1  │  │ Slave 2  │           │   │
│  │  │ 6379     │  │ 6379     │  │ 6379     │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │       ↕              ↕              ↕                │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │    Redis Sentinel (3 nodes)                  │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │   │
│  │  │  │Sentinel 1│  │Sentinel 2│  │Sentinel 3│   │   │   │
│  │  │  │ 26379    │  │ 26379    │  │ 26379    │   │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Microservices (fitquest namespace)           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │Auth Svc  │  │Workout   │  │Leaderboard           │   │
│  │  │          │  │Svc       │  │Svc       │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │         ↓              ↓              ↓              │   │
│  │    redis-cluster.fitquest.svc.cluster.local:6379    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Monitoring (monitoring namespace)            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │Prometheus│  │Grafana   │  │Alertmanager           │   │
│  │  │          │  │          │  │          │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │         ↓              ↓              ↓              │   │
│  │    redis_exporter metrics (9121)                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Files

### RBAC (`redis-rbac.yaml`)
- ServiceAccount: `redis`
- ClusterRole: Permissions to read pods, endpoints, services
- ClusterRoleBinding: Binds role to service account

### Configuration (`redis-configmap.yaml`)
- Redis configuration with persistence settings
- Sentinel configuration with master monitoring
- Memory limits and eviction policies

### Network Policy (`redis-networkpolicy.yaml`)
- Ingress: Allow Redis communication between nodes
- Ingress: Allow Sentinel communication
- Ingress: Allow microservices to connect
- Ingress: Allow Prometheus scraping
- Egress: Allow DNS, inter-node communication

### Redis StatefulSet (`redis-statefulset.yaml`)
- 3 replicas with pod anti-affinity
- Redis container with health checks
- Redis exporter for Prometheus metrics
- Persistent volume claims (10Gi each)
- Resource requests/limits

### Sentinel StatefulSet (`sentinel-statefulset.yaml`)
- 3 replicas with pod anti-affinity
- Sentinel container with health checks
- Sentinel exporter for Prometheus metrics
- Persistent volume claims (1Gi each)
- Resource requests/limits

### Monitoring (`servicemonitor.yaml`)
- ServiceMonitor for Redis metrics scraping
- ServiceMonitor for Sentinel metrics scraping
- Prometheus integration

### Alerts (`prometheus-rules.yaml`)
- High memory usage alerts
- Replication lag alerts
- Failover alerts
- Pod down alerts
- Cache hit ratio alerts

## Caching Strategy

### Exercise Library
- **Key Pattern**: `exercise:*`
- **TTL**: 7 days (604,800 seconds)
- **Size**: ~5MB
- **Update**: Weekly refresh from database
- **Implementation**:
  ```typescript
  await redis.setex('exercise:library', 604800, JSON.stringify(exercises));
  ```

### User Profiles
- **Key Pattern**: `user:profile:*`
- **TTL**: 1 hour (3,600 seconds)
- **Size**: ~1KB per user
- **Update**: On profile change
- **Implementation**:
  ```typescript
  await redis.setex(`user:profile:${userId}`, 3600, JSON.stringify(profile));
  ```

### Leaderboard Rankings
- **Key Pattern**: `leaderboard:*`
- **TTL**: 5 minutes (300 seconds)
- **Size**: ~100KB per leaderboard
- **Update**: Real-time on XP changes
- **Implementation**:
  ```typescript
  await redis.zadd('leaderboard:global', xp, userId);
  ```

### Achievement Definitions
- **Key Pattern**: `achievement:*`
- **TTL**: None (static)
- **Size**: ~2MB
- **Update**: On deployment
- **Implementation**:
  ```typescript
  await redis.set('achievement:definitions', JSON.stringify(achievements));
  ```

### Session Token Blacklist
- **Key Pattern**: `token:blacklist:*`
- **TTL**: Token expiration time
- **Size**: ~100 bytes per token
- **Update**: On logout
- **Implementation**:
  ```typescript
  const expiresIn = Math.floor((token.expiresAt - Date.now()) / 1000);
  await redis.setex(`token:blacklist:${token.id}`, expiresIn, '1');
  ```

## Persistence Configuration

### RDB (Redis Database)
- **Snapshots**: Every 60 seconds if 1000+ keys changed
- **Snapshots**: Every 300 seconds if 10+ keys changed
- **Snapshots**: Every 900 seconds (15 minutes) always
- **File**: `/data/dump.rdb`
- **Compression**: Enabled

### AOF (Append-Only File)
- **Enabled**: Yes
- **Fsync**: Every second
- **File**: `/data/appendonly.aof`
- **Rewrite**: When AOF is 100% larger than RDB

## Replication Configuration

### Master-Slave Replication
- **Master**: 1 primary node (redis-cluster-0)
- **Slaves**: 2 replica nodes (redis-cluster-1, redis-cluster-2)
- **Sync**: Automatic on connection
- **Failover**: Automatic via Sentinel

### Sentinel Monitoring
- **Quorum**: 2 (majority of 3)
- **Down After**: 30 seconds
- **Parallel Syncs**: 1
- **Failover Timeout**: 180 seconds

## Monitoring and Alerting

### Prometheus Metrics
- `redis_connected_clients`: Number of connected clients
- `redis_used_memory`: Memory usage in bytes
- `redis_total_commands_processed`: Total commands processed
- `redis_keyspace_hits`: Cache hit count
- `redis_keyspace_misses`: Cache miss count
- `redis_evicted_keys`: Keys evicted due to memory limit
- `redis_replication_role`: Master (1) or Slave (0)
- `redis_replication_connected_slaves`: Number of connected slaves

### Alert Rules
- **High Memory Usage**: Memory > 80% of limit for 5 minutes
- **Memory Limit Exceeded**: Memory > 95% of limit for 2 minutes
- **High Eviction Rate**: Keys evicted > 100/minute for 5 minutes
- **Replication Lag**: Backlog size > 1MB for 5 minutes
- **Slave Disconnected**: No connected slaves for 2 minutes
- **Slow Queries**: More than 10 slow queries for 5 minutes
- **Connection Pool Exhaustion**: > 9000 connected clients for 2 minutes
- **Persistence Issues**: Last RDB save > 1 hour ago for 5 minutes
- **Sentinel Master Down**: Master detected as down for 2 minutes
- **Pod Down**: Redis or Sentinel pod down for 2 minutes

## Deployment Steps

1. **Prerequisites Check**
   - Verify kubectl connectivity
   - Check namespace exists
   - Verify storage class available

2. **Deploy RBAC**
   - Create ServiceAccount
   - Create ClusterRole
   - Create ClusterRoleBinding

3. **Deploy Configuration**
   - Create Redis ConfigMap
   - Create Sentinel ConfigMap

4. **Deploy Network Policy**
   - Create Redis NetworkPolicy
   - Create Sentinel NetworkPolicy

5. **Deploy Redis**
   - Deploy Redis StatefulSet
   - Deploy Redis Service

6. **Deploy Sentinel**
   - Deploy Sentinel StatefulSet
   - Deploy Sentinel Service

7. **Deploy Monitoring**
   - Deploy ServiceMonitor
   - Deploy PrometheusRule

8. **Verify Deployment**
   - Check pod status
   - Verify connectivity
   - Check replication status

## Access Methods

### From Within Cluster
```bash
# Redis
redis://redis-cluster.fitquest.svc.cluster.local:6379

# Sentinel
redis-sentinel://redis-sentinel.fitquest.svc.cluster.local:26379
```

### From Outside Cluster (Port Forwarding)
```bash
# Redis
kubectl port-forward -n fitquest svc/redis-cluster 6379:6379
redis-cli -h localhost -p 6379

# Sentinel
kubectl port-forward -n fitquest svc/redis-sentinel 26379:26379
redis-cli -h localhost -p 26379
```

### Direct Pod Access
```bash
# Redis CLI
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli

# Sentinel CLI
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379
```

## Resource Requirements

### Redis Pods
- **CPU Request**: 100m
- **CPU Limit**: 500m
- **Memory Request**: 256Mi
- **Memory Limit**: 2Gi
- **Storage**: 10Gi per pod

### Sentinel Pods
- **CPU Request**: 50m
- **CPU Limit**: 200m
- **Memory Request**: 128Mi
- **Memory Limit**: 512Mi
- **Storage**: 1Gi per pod

### Total Resources
- **CPU**: 450m request, 2.1 CPU limit
- **Memory**: 1.5Gi request, 7.5Gi limit
- **Storage**: 33Gi (30Gi Redis + 3Gi Sentinel)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

## Next Steps

1. Deploy Redis cluster: `./scripts/setup-redis-cluster.sh`
2. Verify deployment: `./scripts/verify-redis-cluster.sh`
3. Configure microservices to use Redis
4. Monitor metrics in Grafana
5. Test failover scenarios
6. Optimize caching based on usage patterns

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Replication](https://redis.io/topics/replication)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

