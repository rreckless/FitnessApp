# Redis Cluster Troubleshooting Guide

This guide provides solutions for common issues encountered when deploying and operating Redis on Kubernetes.

## Common Issues

### 1. Redis Pods Not Starting

**Symptoms**: Pods stuck in Pending or CrashLoopBackOff state

**Diagnosis**:
```bash
# Check pod status
kubectl get pods -n fitquest -l app=redis-cluster

# Check pod events
kubectl describe pod redis-cluster-0 -n fitquest

# Check logs
kubectl logs redis-cluster-0 -n fitquest
```

**Solutions**:

- **Insufficient storage**: Check if PersistentVolumeClaim is bound
  ```bash
  kubectl get pvc -n fitquest
  kubectl describe pvc redis-cluster-0 -n fitquest
  ```

- **Insufficient resources**: Check node resources
  ```bash
  kubectl top nodes
  kubectl describe nodes
  ```

- **Image pull errors**: Check image availability
  ```bash
  kubectl describe pod redis-cluster-0 -n fitquest | grep -i image
  ```

### 2. Redis Cluster Not Forming

**Symptoms**: Pods running but cluster not initialized

**Diagnosis**:
```bash
# Check cluster status
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli cluster info

# Check cluster nodes
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli cluster nodes
```

**Solutions**:

- **Manual cluster initialization**:
  ```bash
  # Connect to first pod
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli
  
  # Check if cluster is initialized
  > cluster info
  
  # If not initialized, check logs for errors
  ```

- **Wait for all pods to be ready**:
  ```bash
  kubectl wait --for=condition=ready pod -l app=redis-cluster -n fitquest --timeout=300s
  ```

### 3. Replication Not Working

**Symptoms**: Slaves not syncing with master

**Diagnosis**:
```bash
# Check replication status
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info replication

# Check slave connections
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info clients
```

**Solutions**:

- **Check network connectivity**:
  ```bash
  # Test connectivity between pods
  kubectl exec -it redis-cluster-0 -n fitquest -- ping redis-cluster-1.redis-cluster.fitquest.svc.cluster.local
  ```

- **Check NetworkPolicy**:
  ```bash
  kubectl get networkpolicy -n fitquest
  kubectl describe networkpolicy redis-network-policy -n fitquest
  ```

- **Restart replication**:
  ```bash
  # Connect to slave
  kubectl exec -it redis-cluster-1 -n fitquest -- redis-cli
  
  # Restart replication
  > slaveof no one
  > slaveof redis-cluster-0.redis-cluster.fitquest.svc.cluster.local 6379
  ```

### 4. Sentinel Not Detecting Master Failure

**Symptoms**: Master fails but Sentinel doesn't trigger failover

**Diagnosis**:
```bash
# Check Sentinel status
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379 sentinel masters

# Check Sentinel logs
kubectl logs redis-sentinel-0 -n fitquest
```

**Solutions**:

- **Verify Sentinel quorum**:
  ```bash
  # Check number of Sentinel instances
  kubectl get pods -n fitquest -l app=redis-sentinel
  
  # Quorum should be 2 (majority of 3)
  ```

- **Check Sentinel configuration**:
  ```bash
  kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379 sentinel get-master-addr-by-name mymaster
  ```

- **Restart Sentinel**:
  ```bash
  kubectl rollout restart statefulset/redis-sentinel -n fitquest
  ```

### 5. High Memory Usage

**Symptoms**: Redis pods consuming excessive memory

**Diagnosis**:
```bash
# Check memory usage
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info memory

# Check keyspace
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info keyspace

# Check eviction stats
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info stats
```

**Solutions**:

- **Increase memory limit**:
  ```bash
  # Edit ConfigMap
  kubectl edit configmap redis-config -n fitquest
  
  # Update maxmemory value
  # Restart pods
  kubectl rollout restart statefulset/redis-cluster -n fitquest
  ```

- **Reduce TTLs**:
  ```bash
  # Check keys with long TTLs
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli
  > keys *
  > ttl <key>
  ```

- **Implement cache eviction policy**:
  ```bash
  # Current policy is allkeys-lru (evict least recently used)
  # Can be changed to allkeys-lfu (evict least frequently used)
  ```

### 6. Slow Queries

**Symptoms**: High latency or slow response times

**Diagnosis**:
```bash
# Check slow log
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli slowlog get 10

# Check command stats
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info commandstats
```

**Solutions**:

- **Identify slow commands**:
  ```bash
  # Review slow log entries
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli slowlog get
  ```

- **Optimize queries**:
  - Use pipelining for multiple commands
  - Use SCAN instead of KEYS for large datasets
  - Use sorted sets for range queries

- **Increase slowlog threshold**:
  ```bash
  # Edit ConfigMap to adjust slowlog-max-len
  kubectl edit configmap redis-config -n fitquest
  ```

### 7. Persistence Issues

**Symptoms**: Data loss after pod restart

**Diagnosis**:
```bash
# Check RDB file
kubectl exec -it redis-cluster-0 -n fitquest -- ls -la /data/

# Check AOF file
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info persistence

# Check disk space
kubectl exec -it redis-cluster-0 -n fitquest -- df -h /data/
```

**Solutions**:

- **Verify persistence is enabled**:
  ```bash
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli config get save
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli config get appendonly
  ```

- **Force RDB save**:
  ```bash
  kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli bgsave
  ```

- **Check disk space**:
  ```bash
  # Increase PVC size if needed
  kubectl patch pvc redis-cluster-0 -n fitquest -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
  ```

### 8. Connection Pool Exhaustion

**Symptoms**: "Too many connections" errors

**Diagnosis**:
```bash
# Check connected clients
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info clients

# Check client list
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli client list
```

**Solutions**:

- **Increase maxclients**:
  ```bash
  # Edit ConfigMap
  kubectl edit configmap redis-config -n fitquest
  
  # Update maxclients value
  # Restart pods
  kubectl rollout restart statefulset/redis-cluster -n fitquest
  ```

- **Implement connection pooling in microservices**:
  - Use connection pool with max connections limit
  - Implement connection timeout
  - Implement idle connection cleanup

### 9. Network Policy Issues

**Symptoms**: Cannot connect to Redis from microservices

**Diagnosis**:
```bash
# Check NetworkPolicy
kubectl get networkpolicy -n fitquest
kubectl describe networkpolicy redis-network-policy -n fitquest

# Test connectivity
kubectl exec -it <microservice-pod> -n fitquest -- redis-cli -h redis-cluster.fitquest.svc.cluster.local ping
```

**Solutions**:

- **Verify NetworkPolicy allows traffic**:
  ```bash
  # Check if microservice pods have correct labels
  kubectl get pods -n fitquest --show-labels
  ```

- **Temporarily disable NetworkPolicy for testing**:
  ```bash
  kubectl delete networkpolicy redis-network-policy -n fitquest
  ```

- **Update NetworkPolicy to allow traffic**:
  ```bash
  kubectl edit networkpolicy redis-network-policy -n fitquest
  ```

### 10. Monitoring Issues

**Symptoms**: No metrics in Prometheus or Grafana

**Diagnosis**:
```bash
# Check ServiceMonitor
kubectl get servicemonitor -n fitquest
kubectl describe servicemonitor redis-servicemonitor -n fitquest

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access http://localhost:9090/targets
```

**Solutions**:

- **Verify ServiceMonitor is created**:
  ```bash
  kubectl get servicemonitor -n fitquest -l app=redis-cluster
  ```

- **Check Prometheus scrape configuration**:
  ```bash
  # Verify Redis exporter is running
  kubectl get pods -n fitquest -l app=redis-exporter
  ```

- **Restart Prometheus**:
  ```bash
  kubectl rollout restart deployment/prometheus -n monitoring
  ```

## Debugging Commands

### Redis CLI Commands

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

# Check persistence
> info persistence

# Check stats
> info stats

# Check slow log
> slowlog get 10

# Check command stats
> info commandstats

# Monitor commands in real-time
> monitor

# Check cluster status
> cluster info

# Check cluster nodes
> cluster nodes
```

### Sentinel CLI Commands

```bash
# Connect to Sentinel
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379

# Check master status
> sentinel masters

# Check slave status
> sentinel slaves mymaster

# Check sentinel status
> sentinel sentinels mymaster

# Get master address
> sentinel get-master-addr-by-name mymaster

# Force failover
> sentinel failover mymaster
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
kubectl get pv
kubectl get pvc -n fitquest

# Check services
kubectl get svc -n fitquest -l app=redis-cluster

# Check endpoints
kubectl get endpoints -n fitquest -l app=redis-cluster

# Check resource usage
kubectl top pods -n fitquest -l app=redis-cluster
```

## Performance Tuning

### Memory Optimization

```bash
# Check memory usage by key type
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli --memkeys

# Check memory fragmentation
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info memory | grep fragmentation
```

### Connection Optimization

```bash
# Increase TCP backlog
# Edit ConfigMap and update tcp-backlog value

# Increase timeout
# Edit ConfigMap and update timeout value

# Implement connection pooling in microservices
```

### Persistence Optimization

```bash
# Adjust RDB save frequency
# Edit ConfigMap and update save parameters

# Adjust AOF rewrite frequency
# Edit ConfigMap and update auto-aof-rewrite-percentage
```

## Getting Help

If you encounter issues not covered in this guide:

1. Check Redis logs: `kubectl logs redis-cluster-0 -n fitquest`
2. Check Sentinel logs: `kubectl logs redis-sentinel-0 -n fitquest`
3. Check Kubernetes events: `kubectl describe pod redis-cluster-0 -n fitquest`
4. Review Redis documentation: https://redis.io/documentation
5. Check Kubernetes documentation: https://kubernetes.io/docs/

