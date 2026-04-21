# RabbitMQ Troubleshooting Guide

This guide provides solutions for common RabbitMQ issues.

## Common Issues

### 1. Pods Not Starting

**Symptoms:**
- Pods stuck in `Pending` or `CrashLoopBackOff` state
- StatefulSet replicas not ready

**Diagnosis:**

```bash
# Check pod status
kubectl get pods -n fitquest -l app=rabbitmq

# Check pod events
kubectl describe pod rabbitmq-0 -n fitquest

# Check pod logs
kubectl logs -n fitquest rabbitmq-0
```

**Solutions:**

**Issue: Insufficient resources**
```bash
# Check node resources
kubectl top nodes

# Check PVC status
kubectl get pvc -n fitquest

# If PVC is pending, check storage class
kubectl get storageclass
```

**Issue: Storage not available**
```bash
# Create storage class if missing
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp2
  iops: "100"
  fstype: ext4
EOF
```

**Issue: Image pull errors**
```bash
# Check image availability
docker pull rabbitmq:3.12-management-alpine

# Check image pull secrets
kubectl get secrets -n fitquest
```

### 2. Cluster Not Forming

**Symptoms:**
- Pods running but cluster status shows only 1 node
- Nodes unable to communicate

**Diagnosis:**

```bash
# Check cluster status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Check node connectivity
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q check_running

# Check logs for clustering errors
kubectl logs -n fitquest rabbitmq-0 | grep -i cluster
```

**Solutions:**

**Issue: DNS resolution**
```bash
# Test DNS from pod
kubectl exec -n fitquest rabbitmq-0 -- nslookup rabbitmq.fitquest.svc.cluster.local

# Check service endpoints
kubectl get endpoints rabbitmq -n fitquest
```

**Issue: Network connectivity**
```bash
# Test connectivity between pods
kubectl exec -n fitquest rabbitmq-0 -- ping rabbitmq-1.rabbitmq.fitquest.svc.cluster.local

# Check NetworkPolicy
kubectl get networkpolicy -n fitquest
```

**Issue: Erlang cookie mismatch**
```bash
# Check Erlang cookie
kubectl exec -n fitquest rabbitmq-0 -- cat /var/lib/rabbitmq/.erlang.cookie

# Verify all nodes have same cookie
for i in 0 1 2; do
  echo "Pod rabbitmq-$i:"
  kubectl exec -n fitquest rabbitmq-$i -- cat /var/lib/rabbitmq/.erlang.cookie
done
```

### 3. Exchanges/Queues Not Created

**Symptoms:**
- Exchanges and queues missing after deployment
- Initialization script failed

**Diagnosis:**

```bash
# Check if exchanges exist
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges

# Check if queues exist
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues

# Check initialization logs
kubectl logs -n fitquest rabbitmq-0 | grep -i "exchange\|queue"
```

**Solutions:**

**Issue: Initialization script not run**
```bash
# Manually run initialization
kubectl exec -n fitquest rabbitmq-0 -- /bin/sh -c '
  rabbitmqctl declare_exchange fitquest.events.workout topic --durable
  rabbitmqctl declare_queue xp-service-workout-completed --durable
  rabbitmqctl bind_queue xp-service-workout-completed fitquest.events.workout "workout.completed"
'
```

**Issue: Permission denied**
```bash
# Check user permissions
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_user_permissions guest

# Grant permissions if needed
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl set_permissions -p / guest ".*" ".*" ".*"
```

### 4. High Memory Usage

**Symptoms:**
- Pod memory usage exceeds limits
- OOMKilled pods

**Diagnosis:**

```bash
# Check memory usage
kubectl top pod -n fitquest -l app=rabbitmq

# Check RabbitMQ memory breakdown
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics memory_breakdown

# Check queue depths
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name messages
```

**Solutions:**

**Issue: Large queue depth**
```bash
# Purge queue if needed
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl purge_queue queue-name

# Check consumer status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_consumers
```

**Issue: Memory limit too low**
```bash
# Increase memory limit
kubectl set resources statefulset rabbitmq -n fitquest --limits=memory=1Gi

# Or edit StatefulSet directly
kubectl edit statefulset rabbitmq -n fitquest
```

**Issue: Message accumulation**
```bash
# Check message TTL
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_policies

# Set message TTL if not configured
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl set_policy -p / message-ttl ".*" '{"message-ttl":86400000}' --apply-to queues
```

### 5. Disk Space Issues

**Symptoms:**
- RabbitMQ stops accepting messages
- Disk space warnings in logs

**Diagnosis:**

```bash
# Check disk usage
kubectl exec -n fitquest rabbitmq-0 -- du -sh /var/lib/rabbitmq

# Check PVC usage
kubectl exec -n fitquest rabbitmq-0 -- df -h /var/lib/rabbitmq

# Check disk free limit
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics status | grep disk
```

**Solutions:**

**Issue: PVC too small**
```bash
# Increase PVC size
kubectl patch pvc rabbitmq-data-rabbitmq-0 -n fitquest -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# Note: This may require manual intervention depending on storage provisioner
```

**Issue: Old messages accumulating**
```bash
# Check message TTL
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_policies

# Purge old messages
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl purge_queue queue-name
```

### 6. Connection Issues

**Symptoms:**
- Microservices unable to connect to RabbitMQ
- Connection timeout errors

**Diagnosis:**

```bash
# Check service endpoints
kubectl get endpoints rabbitmq-client -n fitquest

# Test connectivity from pod
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside pod:
nc -zv rabbitmq-client.fitquest.svc.cluster.local 5672

# Check service DNS
nslookup rabbitmq-client.fitquest.svc.cluster.local
```

**Solutions:**

**Issue: Service not ready**
```bash
# Check service status
kubectl get svc rabbitmq-client -n fitquest

# Check endpoints
kubectl get endpoints rabbitmq-client -n fitquest

# Restart service if needed
kubectl delete svc rabbitmq-client -n fitquest
kubectl apply -f deployment/rabbitmq-service.yaml
```

**Issue: NetworkPolicy blocking traffic**
```bash
# Check NetworkPolicy
kubectl get networkpolicy -n fitquest

# Verify rules
kubectl describe networkpolicy rabbitmq -n fitquest

# Temporarily disable if needed for testing
kubectl delete networkpolicy rabbitmq -n fitquest
```

**Issue: Firewall/Security group**
```bash
# Check security group rules (AWS)
aws ec2 describe-security-groups --filters Name=group-name,Values=kubernetes-cluster

# Check network ACLs (Azure)
az network nsg rule list --resource-group myResourceGroup --nsg-name myNSG
```

### 7. Message Delivery Issues

**Symptoms:**
- Messages not being delivered to consumers
- Messages stuck in queue

**Diagnosis:**

```bash
# Check queue status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name messages consumers

# Check consumer status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_consumers

# Check bindings
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_bindings
```

**Solutions:**

**Issue: No consumers**
```bash
# Verify microservices are running
kubectl get pods -n fitquest -l app=xp-service

# Check microservice logs
kubectl logs -n fitquest -l app=xp-service

# Verify queue bindings
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_bindings queue exchange routing_key
```

**Issue: Message format mismatch**
```bash
# Check message content
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name messages

# Inspect message (if possible)
# Use RabbitMQ Management UI to view message details
```

**Issue: Dead letter queue accumulation**
```bash
# Check dead letter queues
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name messages | grep dlq

# Investigate failed messages
# Check microservice logs for error details
```

### 8. Performance Issues

**Symptoms:**
- Slow message throughput
- High latency

**Diagnosis:**

```bash
# Check message rates
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name messages_details.avg_ingress_rate messages_details.avg_egress_rate

# Check connection count
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_connections

# Check channel count
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_channels
```

**Solutions:**

**Issue: Insufficient prefetch**
```bash
# Increase prefetch count in microservices
# Update consumer configuration to prefetch more messages
```

**Issue: Single consumer**
```bash
# Scale microservice replicas
kubectl scale deployment xp-service -n fitquest --replicas=3
```

**Issue: Network latency**
```bash
# Check pod placement
kubectl get pods -n fitquest -o wide

# Use pod affinity to co-locate pods
# Update StatefulSet affinity rules
```

### 9. Monitoring Issues

**Symptoms:**
- Prometheus not scraping metrics
- Grafana dashboard empty

**Diagnosis:**

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n fitquest

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check metrics endpoint
kubectl exec -n fitquest rabbitmq-0 -- wget -q -O - http://localhost:15692/metrics | head -20
```

**Solutions:**

**Issue: ServiceMonitor not created**
```bash
# Apply monitoring rules
kubectl apply -f monitoring/prometheus-rules.yaml

# Verify ServiceMonitor
kubectl get servicemonitor -n fitquest
```

**Issue: Metrics endpoint not accessible**
```bash
# Check if prometheus plugin is enabled
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-plugins list | grep prometheus

# Enable if needed
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-plugins enable rabbitmq_prometheus
```

### 10. Upgrade Issues

**Symptoms:**
- Pods not updating after image change
- Cluster becomes unavailable during upgrade

**Diagnosis:**

```bash
# Check StatefulSet status
kubectl get statefulset rabbitmq -n fitquest

# Check rollout status
kubectl rollout status statefulset/rabbitmq -n fitquest

# Check pod images
kubectl get pods -n fitquest -l app=rabbitmq -o jsonpath='{.items[*].spec.containers[0].image}'
```

**Solutions:**

**Issue: Slow rollout**
```bash
# Check pod termination grace period
kubectl get statefulset rabbitmq -n fitquest -o jsonpath='{.spec.template.spec.terminationGracePeriodSeconds}'

# Increase if needed
kubectl patch statefulset rabbitmq -n fitquest -p '{"spec":{"template":{"spec":{"terminationGracePeriodSeconds":60}}}}'
```

**Issue: Cluster unavailable**
```bash
# Check cluster status during upgrade
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Wait for cluster to stabilize
kubectl rollout status statefulset/rabbitmq -n fitquest --timeout=10m
```

## Debugging Commands

### General Diagnostics

```bash
# Get RabbitMQ status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics status

# Check running status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q check_running

# Ping RabbitMQ
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q ping

# Get environment info
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics environment
```

### Queue Management

```bash
# List all queues
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues

# List queue details
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name durable messages consumers

# Purge queue
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl purge_queue queue-name

# Delete queue
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl delete_queue queue-name
```

### Exchange Management

```bash
# List all exchanges
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges

# List exchange details
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges name type durable

# Delete exchange
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl delete_exchange exchange-name
```

### User Management

```bash
# List users
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_users

# Change password
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl change_password username newpassword

# List permissions
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_permissions
```

## Getting Help

If issues persist:

1. Collect logs:
```bash
kubectl logs -n fitquest rabbitmq-0 > rabbitmq.log
kubectl describe pod rabbitmq-0 -n fitquest > pod-describe.log
kubectl get events -n fitquest > events.log
```

2. Check RabbitMQ documentation: https://www.rabbitmq.com/documentation.html

3. Review Kubernetes events:
```bash
kubectl get events -n fitquest --sort-by='.lastTimestamp'
```

4. Contact support with logs and diagnostic information
