# FitQuest Redis Cluster for Caching

This directory contains all Kubernetes configuration files for deploying a Redis cluster with high availability for FitQuest microservices.

## Overview

The Redis cluster provides distributed caching for:
- **Exercise Library**: Weekly TTL (604,800 seconds)
- **User Profiles**: 1-hour TTL (3,600 seconds)
- **Leaderboard Rankings**: 5-minute TTL (300 seconds)
- **Achievement Definitions**: Static/no expiry
- **Session Tokens**: Blacklist management
- **Rate Limiting**: Counters and tracking

## Quick Start

### Prerequisites
- Kubernetes cluster with fitquest namespace created
- kubectl configured and authenticated
- 30+ GB persistent storage available
- 3+ nodes for high availability

### 1. Deploy Redis Cluster

```bash
./scripts/setup-redis-cluster.sh
```

### 2. Verify Deployment

```bash
./scripts/verify-redis-cluster.sh
```

### 3. Access Redis

#### From within the cluster:

```bash
# Redis connection string
redis://redis-cluster.fitquest.svc.cluster.local:6379

# Sentinel connection string
redis-sentinel://redis-sentinel.fitquest.svc.cluster.local:26379
```

#### From outside the cluster (port forwarding):

```bash
# Forward Redis port
kubectl port-forward -n fitquest svc/redis-cluster 6379:6379

# Forward Sentinel port
kubectl port-forward -n fitquest svc/redis-sentinel 26379:26379

# Test connection
redis-cli -h localhost -p 6379 ping
```

## Directory Structure

```
redis/
├── README.md                          # This file
├── SETUP_GUIDE.md                     # Detailed setup guide
├── TROUBLESHOOTING.md                 # Common issues and solutions
├── deployment/
│   ├── redis-statefulset.yaml         # Redis cluster StatefulSet
│   ├── redis-service.yaml             # Redis ClusterIP service
│   ├── redis-configmap.yaml           # Redis configuration
│   ├── redis-rbac.yaml                # RBAC for Redis
│   ├── redis-networkpolicy.yaml       # Network security policy
│   ├── sentinel-statefulset.yaml      # Redis Sentinel StatefulSet
│   ├── sentinel-service.yaml          # Sentinel service
│   ├── sentinel-configmap.yaml        # Sentinel configuration
│   └── servicemonitor.yaml            # Prometheus monitoring
├── scripts/
│   ├── setup-redis-cluster.sh         # Deployment script
│   ├── verify-redis-cluster.sh        # Verification script
│   └── redis-cli-helper.sh            # Redis CLI helper
└── monitoring/
    └── prometheus-rules.yaml          # Alert rules for Redis
```

## Components

### Redis Cluster
- **Purpose**: Distributed caching with high availability
- **Replicas**: 3 for HA
- **Storage**: 10Gi persistent volume per node
- **Persistence**: RDB snapshots + AOF
- **Memory**: 2Gi per node
- **Port**: 6379

### Redis Sentinel
- **Purpose**: Automatic failover and monitoring
- **Replicas**: 3 for HA
- **Monitoring Interval**: 30 seconds
- **Failover Timeout**: 180 seconds
- **Port**: 26379

## Caching Strategy

### Exercise Library
- **TTL**: 7 days (604,800 seconds)
- **Key Pattern**: `exercise:*`
- **Update**: Weekly refresh from database
- **Size**: ~5MB

### User Profiles
- **TTL**: 1 hour (3,600 seconds)
- **Key Pattern**: `user:profile:*`
- **Update**: On profile change
- **Size**: ~1KB per user

### Leaderboard Rankings
- **TTL**: 5 minutes (300 seconds)
- **Key Pattern**: `leaderboard:*`
- **Update**: Real-time on XP changes
- **Size**: ~100KB per leaderboard

### Achievement Definitions
- **TTL**: None (static)
- **Key Pattern**: `achievement:*`
- **Update**: On deployment
- **Size**: ~2MB

### Session Tokens (Blacklist)
- **TTL**: Token expiration time
- **Key Pattern**: `token:blacklist:*`
- **Update**: On logout
- **Size**: ~100 bytes per token

## Persistence Configuration

### RDB (Redis Database)
- **Snapshots**: Every 60 seconds if 1000+ keys changed
- **Snapshots**: Every 300 seconds if 10+ keys changed
- **Snapshots**: Every 900 seconds (15 minutes) always
- **File**: `/data/dump.rdb`

### AOF (Append-Only File)
- **Enabled**: Yes
- **Fsync**: Every second
- **File**: `/data/appendonly.aof`
- **Rewrite**: When AOF is 100% larger than RDB

## Replication

### Master-Slave Replication
- **Master**: 1 primary node
- **Slaves**: 2 replica nodes
- **Sync**: Automatic on connection
- **Failover**: Automatic via Sentinel

### Sentinel Monitoring
- **Quorum**: 2 (majority of 3)
- **Down After**: 30 seconds
- **Parallel Syncs**: 1
- **Notification**: Logs and metrics

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
- **Replication Lag**: Slave lag > 1000 bytes for 5 minutes
- **Sentinel Down**: Sentinel pod down for 2 minutes
- **Master Down**: Master pod down for 2 minutes
- **High Eviction Rate**: Keys evicted > 100/minute for 5 minutes

## Accessing Services

### Redis CLI
```bash
# From within cluster
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli

# From outside cluster (port forwarding)
kubectl port-forward -n fitquest svc/redis-cluster 6379:6379
redis-cli -h localhost -p 6379
```

### Sentinel CLI
```bash
# From within cluster
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379

# From outside cluster (port forwarding)
kubectl port-forward -n fitquest svc/redis-sentinel 26379:26379
redis-cli -h localhost -p 26379
```

### Check Cluster Status
```bash
# Check master/slave status
redis-cli -h redis-cluster.fitquest.svc.cluster.local info replication

# Check memory usage
redis-cli -h redis-cluster.fitquest.svc.cluster.local info memory

# Check connected clients
redis-cli -h redis-cluster.fitquest.svc.cluster.local info clients
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Next Steps

1. **Deploy Redis cluster**: `./scripts/setup-redis-cluster.sh`
2. **Verify deployment**: `./scripts/verify-redis-cluster.sh`
3. **Configure caching**: Update microservices to use Redis
4. **Monitor metrics**: Access Grafana dashboards
5. **Test failover**: Simulate node failure and verify recovery

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Replication](https://redis.io/topics/replication)
- [Redis Memory Management](https://redis.io/topics/memory-optimization)

