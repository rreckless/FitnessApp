# Redis Cluster Setup Guide

This guide provides step-by-step instructions for deploying and configuring Redis on Kubernetes with Sentinel for high availability.

## Prerequisites

- Kubernetes cluster (1.20+) with kubectl configured
- Persistent storage provisioner (e.g., local-path, EBS, Azure Disk)
- Monitoring namespace (optional, for Prometheus integration)
- 3+ nodes for high availability (recommended)
- 30+ GB persistent storage available

## Installation Steps

### 1. Verify Prerequisites

```bash
# Check kubectl connectivity
kubectl cluster-info

# Verify fitquest namespace exists
kubectl get namespace fitquest

# Check storage classes
kubectl get storageclass

# Check available nodes
kubectl get nodes
```

### 2. Deploy Redis Cluster

```bash
# Navigate to the redis directory
cd infrastructure/kubernetes/redis

# Make scripts executable
chmod +x scripts/*.sh

# Run the setup script
./scripts/setup-redis-cluster.sh
```

The setup script will:
1. Verify prerequisites
2. Deploy RBAC resources (ServiceAccount, ClusterRole, RoleBinding)
3. Deploy ConfigMap with Redis configuration
4. Deploy Services (ClusterIP for internal communication)
5. Deploy NetworkPolicy for security
6. Deploy Redis StatefulSet with 3 replicas
7. Deploy Sentinel StatefulSet with 3 replicas
8. Deploy monitoring rules (if monitoring namespace exists)
9. Initialize Redis cluster

### 3. Verify Deployment

```bash
# Run the verification script
./scripts/verify-redis-cluster.sh
```

This will check:
- Redis StatefulSet status
- Sentinel StatefulSet status
- Pod status and readiness
- Persistent volume status
- Redis cluster status
- Replication status
- Connectivity
- Services and endpoints
- Metrics collection

### 4. Access Redis

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

## Configuration

### Redis Configuration

The Redis configuration is managed via ConfigMap and includes:

- **Memory Management**
  - `maxmemory`: 2GB per node
  - `maxmemory-policy`: allkeys-lru (evict least recently used keys)

- **Persistence**
  - RDB snapshots: Every 60 seconds if 1000+ keys changed
  - AOF: Enabled with fsync every second
  - Rewrite: When AOF is 100% larger than RDB

- **Replication**
  - Automatic master-slave replication
  - Slave read-only mode enabled
  - Replication backlog: 1MB

- **Networking**
  - TCP backlog: 511
  - Timeout: 0 (no timeout)
  - TCP keepalive: 300 seconds

### Sentinel Configuration

The Sentinel configuration includes:

- **Monitoring**
  - Master monitoring interval: 30 seconds
  - Down after: 30 seconds
  - Parallel syncs: 1

- **Failover**
  - Failover timeout: 180 seconds
  - Quorum: 2 (majority of 3)
  - Notification scripts: Optional

- **Logging**
  - Log level: notice
  - Log file: /var/log/redis/sentinel.log

### Cluster Size

To change the number of replicas, edit the StatefulSet:

```bash
# Scale Redis cluster
kubectl patch statefulset redis-cluster -n fitquest -p '{"spec":{"replicas":5}}'

# Scale Sentinel cluster
kubectl patch statefulset redis-sentinel -n fitquest -p '{"spec":{"replicas":5}}'
```

### Memory Limits

To change memory limits, edit the Redis ConfigMap:

```bash
# Edit ConfigMap
kubectl edit configmap redis-config -n fitquest

# Update maxmemory value
# Then restart Redis pods for changes to take effect
kubectl rollout restart statefulset/redis-cluster -n fitquest
```

## Caching Strategy Implementation

### Exercise Library Cache

```typescript
// Set exercise library cache (7 days)
await redis.setex('exercise:library', 604800, JSON.stringify(exercises));

// Get exercise library cache
const cached = await redis.get('exercise:library');
```

### User Profile Cache

```typescript
// Set user profile cache (1 hour)
await redis.setex(`user:profile:${userId}`, 3600, JSON.stringify(profile));

// Get user profile cache
const cached = await redis.get(`user:profile:${userId}`);

// Invalidate on profile update
await redis.del(`user:profile:${userId}`);
```

### Leaderboard Cache

```typescript
// Set leaderboard rankings (5 minutes)
await redis.setex('leaderboard:global', 300, JSON.stringify(rankings));

// Get leaderboard cache
const cached = await redis.get('leaderboard:global');

// Update in real-time
await redis.zadd('leaderboard:global:sorted', xp, userId);
```

### Achievement Cache

```typescript
// Set achievement definitions (no expiry)
await redis.set('achievement:definitions', JSON.stringify(achievements));

// Get achievement definitions
const cached = await redis.get('achievement:definitions');
```

### Session Token Blacklist

```typescript
// Add token to blacklist (expires at token expiration time)
const expiresIn = Math.floor((token.expiresAt - Date.now()) / 1000);
await redis.setex(`token:blacklist:${token.id}`, expiresIn, '1');

// Check if token is blacklisted
const isBlacklisted = await redis.exists(`token:blacklist:${token.id}`);
```

## Monitoring and Alerting

### Prometheus Integration

Redis metrics are automatically scraped by Prometheus via ServiceMonitor. Metrics include:

- `redis_connected_clients`: Number of connected clients
- `redis_used_memory`: Memory usage in bytes
- `redis_total_commands_processed`: Total commands processed
- `redis_keyspace_hits`: Cache hit count
- `redis_keyspace_misses`: Cache miss count
- `redis_evicted_keys`: Keys evicted due to memory limit
- `redis_replication_role`: Master (1) or Slave (0)
- `redis_replication_connected_slaves`: Number of connected slaves

### Grafana Dashboards

Pre-configured dashboards are available in Grafana:

1. **Redis Cluster Health**: Overall cluster status and metrics
2. **Memory Usage**: Memory consumption and eviction rates
3. **Performance**: Commands per second and latency
4. **Replication**: Master-slave sync status
5. **Persistence**: RDB and AOF metrics

### Alert Rules

Alert rules are configured in `monitoring/prometheus-rules.yaml`:

- **High Memory Usage**: Memory > 80% of limit for 5 minutes
- **Replication Lag**: Slave lag > 1000 bytes for 5 minutes
- **Sentinel Down**: Sentinel pod down for 2 minutes
- **Master Down**: Master pod down for 2 minutes
- **High Eviction Rate**: Keys evicted > 100/minute for 5 minutes

## Troubleshooting

### Check Redis Status

```bash
# Connect to Redis
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli

# Check server info
> info server

# Check replication status
> info replication

# Check memory usage
> info memory

# Check connected clients
> info clients

# Check keyspace
> info keyspace
```

### Check Sentinel Status

```bash
# Connect to Sentinel
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379

# Check master status
> sentinel masters

# Check slave status
> sentinel slaves mymaster

# Check sentinel status
> sentinel sentinels mymaster
```

### Common Issues

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

## Next Steps

1. **Deploy Redis cluster**: `./scripts/setup-redis-cluster.sh`
2. **Verify deployment**: `./scripts/verify-redis-cluster.sh`
3. **Configure microservices**: Update services to use Redis
4. **Monitor metrics**: Access Grafana dashboards
5. **Test failover**: Simulate node failure and verify recovery
6. **Optimize caching**: Adjust TTLs based on usage patterns

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Replication](https://redis.io/topics/replication)
- [Redis Memory Management](https://redis.io/topics/memory-optimization)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

