# Redis Cluster Quick Reference

## Quick Start

### 1. Deploy Redis Cluster
```bash
cd infrastructure/kubernetes/redis
./scripts/setup-redis-cluster.sh
```

### 2. Verify Deployment
```bash
./scripts/verify-redis-cluster.sh
```

### 3. Access Redis
```bash
# From within cluster
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli

# From outside cluster (port forwarding)
kubectl port-forward -n fitquest svc/redis-cluster 6379:6379
redis-cli -h localhost -p 6379
```

## Common Commands

### Redis CLI

```bash
# Connect to Redis
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli

# Check server info
redis-cli info server

# Check replication status
redis-cli info replication

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli info clients

# Check keyspace
redis-cli info keyspace

# Monitor commands in real-time
redis-cli monitor

# Check cluster status
redis-cli cluster info

# Check cluster nodes
redis-cli cluster nodes
```

### Sentinel CLI

```bash
# Connect to Sentinel
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379

# Check master status
sentinel masters

# Check slave status
sentinel slaves mymaster

# Check sentinel status
sentinel sentinels mymaster

# Get master address
sentinel get-master-addr-by-name mymaster

# Force failover
sentinel failover mymaster
```

### Kubernetes Commands

```bash
# Check pod status
kubectl get pods -n fitquest -l app=redis-cluster

# Check pod events
kubectl describe pod redis-cluster-0 -n fitquest

# Check logs
kubectl logs redis-cluster-0 -n fitquest

# Check persistent volumes
kubectl get pvc -n fitquest -l app=redis-cluster

# Check services
kubectl get svc -n fitquest -l app=redis-cluster

# Check endpoints
kubectl get endpoints -n fitquest -l app=redis-cluster

# Check resource usage
kubectl top pods -n fitquest -l app=redis-cluster
```

## Caching Patterns

### Set Cache with TTL
```typescript
// Set exercise library cache (7 days)
await redis.setex('exercise:library', 604800, JSON.stringify(exercises));

// Set user profile cache (1 hour)
await redis.setex(`user:profile:${userId}`, 3600, JSON.stringify(profile));

// Set leaderboard cache (5 minutes)
await redis.setex('leaderboard:global', 300, JSON.stringify(rankings));
```

### Get Cache
```typescript
// Get cache
const cached = await redis.get('exercise:library');

// Parse if exists
if (cached) {
  const data = JSON.parse(cached);
}
```

### Invalidate Cache
```typescript
// Delete cache
await redis.del('exercise:library');

// Delete multiple keys
await redis.del('user:profile:*');

// Delete by pattern
await redis.eval("return redis.call('del', unpack(redis.call('keys', ARGV[1])))", 0, 'user:profile:*');
```

### Sorted Set Operations (for Leaderboards)
```typescript
// Add to sorted set
await redis.zadd('leaderboard:global', xp, userId);

// Get range
const top100 = await redis.zrevrange('leaderboard:global', 0, 99, 'WITHSCORES');

// Get rank
const rank = await redis.zrevrank('leaderboard:global', userId);

// Get score
const score = await redis.zscore('leaderboard:global', userId);
```

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

**Redis pods not starting**
```bash
# Check pod events
kubectl describe pod redis-cluster-0 -n fitquest

# Check logs
kubectl logs redis-cluster-0 -n fitquest

# Check PVC status
kubectl get pvc -n fitquest
```

**Replication not working**
```bash
# Check replication status
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info replication

# Check network connectivity
kubectl exec -it redis-cluster-0 -n fitquest -- ping redis-cluster-1.redis-cluster.fitquest.svc.cluster.local
```

**High memory usage**
```bash
# Check memory usage
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info memory

# Check keyspace
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info keyspace

# Check eviction stats
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info stats
```

## Configuration

### Memory Limit
Edit `deployment/redis-configmap.yaml`:
```yaml
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### Persistence
Edit `deployment/redis-configmap.yaml`:
```yaml
# RDB snapshots
save 60 1000
save 300 10
save 900 1

# AOF
appendonly yes
appendfsync everysec
```

### Replication
Edit `deployment/redis-configmap.yaml`:
```yaml
repl-diskless-sync no
repl-backlog-size 1mb
repl-timeout 60
```

## Monitoring

### Prometheus Metrics
- `redis_connected_clients`: Number of connected clients
- `redis_used_memory`: Memory usage in bytes
- `redis_total_commands_processed`: Total commands processed
- `redis_keyspace_hits`: Cache hit count
- `redis_keyspace_misses`: Cache miss count
- `redis_evicted_keys`: Keys evicted due to memory limit
- `redis_replication_role`: Master (1) or Slave (0)
- `redis_replication_connected_slaves`: Number of connected slaves

### Grafana Dashboards
Access Grafana at `http://localhost:3000` (after port-forward):
```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
```

Pre-configured dashboards:
1. Redis Cluster Health
2. Memory Usage
3. Performance
4. Replication
5. Persistence

## Scaling

### Scale Redis Cluster
```bash
# Scale to 5 replicas
kubectl patch statefulset redis-cluster -n fitquest -p '{"spec":{"replicas":5}}'
```

### Scale Sentinel
```bash
# Scale to 5 replicas
kubectl patch statefulset redis-sentinel -n fitquest -p '{"spec":{"replicas":5}}'
```

## Backup and Recovery

### Manual RDB Save
```bash
# Force RDB save
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli bgsave

# Check save status
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli lastsave
```

### Backup PVC
```bash
# Create snapshot of PVC
kubectl exec -it redis-cluster-0 -n fitquest -- tar czf /data/backup.tar.gz /data/dump.rdb
```

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Replication](https://redis.io/topics/replication)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

