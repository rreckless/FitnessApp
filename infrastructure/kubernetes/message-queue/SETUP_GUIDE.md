# RabbitMQ Setup Guide

This guide provides step-by-step instructions for deploying and configuring RabbitMQ on Kubernetes.

## Prerequisites

- Kubernetes cluster (1.20+) with kubectl configured
- Persistent storage provisioner (e.g., local-path, EBS, Azure Disk)
- Monitoring namespace (optional, for Prometheus integration)
- 3+ nodes for high availability (recommended)

## Installation Steps

### 1. Verify Prerequisites

```bash
# Check kubectl connectivity
kubectl cluster-info

# Verify fitquest namespace exists
kubectl get namespace fitquest

# Check storage classes
kubectl get storageclass
```

### 2. Deploy RabbitMQ

```bash
# Navigate to the message-queue directory
cd infrastructure/kubernetes/message-queue

# Make scripts executable
chmod +x scripts/*.sh

# Run the setup script
./scripts/setup-rabbitmq.sh
```

The setup script will:
1. Verify prerequisites
2. Deploy RBAC resources (ServiceAccount, ClusterRole, RoleBinding)
3. Deploy ConfigMap with RabbitMQ configuration
4. Deploy Services (headless and ClusterIP)
5. Deploy NetworkPolicy for security
6. Deploy StatefulSet with 3 replicas
7. Deploy monitoring rules (if monitoring namespace exists)
8. Initialize exchanges and queues

### 3. Verify Deployment

```bash
# Run the verification script
./scripts/verify-rabbitmq.sh
```

This will check:
- StatefulSet status
- Pod status
- Cluster status
- Exchanges and queues
- Connectivity
- Services and endpoints
- Storage
- Metrics

### 4. Access RabbitMQ

#### From within the cluster:

```bash
# AMQP connection string
amqp://guest:guest@rabbitmq.fitquest.svc.cluster.local:5672

# Management UI
http://rabbitmq-management.fitquest.svc.cluster.local:15672
```

#### From outside the cluster (port forwarding):

```bash
# Forward AMQP port
kubectl port-forward -n fitquest svc/rabbitmq-client 5672:5672

# Forward Management UI port
kubectl port-forward -n fitquest svc/rabbitmq-management 15672:15672

# Access at http://localhost:15672 (guest/guest)
```

## Configuration

### Cluster Size

To change the number of replicas, edit the StatefulSet:

```bash
kubectl patch statefulset rabbitmq -n fitquest -p '{"spec":{"replicas":5}}'
```

### Memory and CPU

Edit the StatefulSet to adjust resource requests/limits:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Storage Size

To increase storage, edit the PersistentVolumeClaim:

```bash
kubectl patch pvc rabbitmq-data-rabbitmq-0 -n fitquest -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
```

### Message TTL

Default message TTL is 24 hours. To change, update the policy in ConfigMap:

```yaml
"message-ttl": 86400000  # milliseconds
```

## Event Configuration

### Adding New Events

To add a new event type:

1. Create exchange and queues in the initialization script
2. Update the ConfigMap with new definitions
3. Redeploy the ConfigMap
4. Run the initialization script again

Example:

```bash
# SSH into a RabbitMQ pod
kubectl exec -it rabbitmq-0 -n fitquest -- bash

# Declare new exchange
rabbitmqctl declare_exchange fitquest.events.newtype topic --durable

# Declare new queue
rabbitmqctl declare_queue service-newtype-event --durable

# Bind queue to exchange
rabbitmqctl bind_queue service-newtype-event fitquest.events.newtype "newtype.event"
```

### Removing Events

```bash
# Delete queue
rabbitmqctl delete_queue service-newtype-event

# Delete exchange (if no longer needed)
rabbitmqctl delete_exchange fitquest.events.newtype
```

## Monitoring

### Prometheus Integration

RabbitMQ metrics are exposed on port 15692. Prometheus is configured to scrape metrics via ServiceMonitor.

### Grafana Dashboards

Import the Grafana dashboard JSON from `monitoring/grafana-dashboard.json`:

1. Open Grafana
2. Go to Dashboards → Import
3. Upload the JSON file
4. Select Prometheus data source
5. Click Import

### Alert Rules

Alert rules are defined in `monitoring/prometheus-rules.yaml`. Alerts include:

- Node down
- Memory usage high
- Disk space low
- Queue depth high
- Connection count high
- Channel count high
- Unacknowledged messages high
- Consumer count low
- Cluster node count mismatch

## Troubleshooting

### Pods not starting

```bash
# Check pod logs
kubectl logs -n fitquest rabbitmq-0

# Check pod events
kubectl describe pod rabbitmq-0 -n fitquest

# Check PVC status
kubectl get pvc -n fitquest
```

### Cluster not forming

```bash
# Check cluster status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Check node connectivity
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q check_running
```

### Exchanges/queues not created

```bash
# Check if initialization completed
kubectl logs -n fitquest rabbitmq-0 | grep "initialized"

# Manually initialize
kubectl exec -n fitquest rabbitmq-0 -- /opt/init-scripts/init-exchanges.sh
```

### High memory usage

```bash
# Check memory status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics memory_breakdown

# Increase memory limit in StatefulSet
kubectl set resources statefulset rabbitmq -n fitquest --limits=memory=1Gi
```

### Disk space issues

```bash
# Check disk usage
kubectl exec -n fitquest rabbitmq-0 -- du -sh /var/lib/rabbitmq

# Increase PVC size
kubectl patch pvc rabbitmq-data-rabbitmq-0 -n fitquest -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
```

## Backup and Recovery

### Backup RabbitMQ Data

```bash
# Create a backup of RabbitMQ data
kubectl exec -n fitquest rabbitmq-0 -- tar czf /tmp/rabbitmq-backup.tar.gz /var/lib/rabbitmq

# Copy backup to local machine
kubectl cp fitquest/rabbitmq-0:/tmp/rabbitmq-backup.tar.gz ./rabbitmq-backup.tar.gz
```

### Restore RabbitMQ Data

```bash
# Copy backup to pod
kubectl cp ./rabbitmq-backup.tar.gz fitquest/rabbitmq-0:/tmp/rabbitmq-backup.tar.gz

# Extract backup
kubectl exec -n fitquest rabbitmq-0 -- tar xzf /tmp/rabbitmq-backup.tar.gz -C /
```

## Scaling

### Scale Up

```bash
# Increase replicas
kubectl scale statefulset rabbitmq -n fitquest --replicas=5
```

### Scale Down

```bash
# Decrease replicas (graceful shutdown)
kubectl scale statefulset rabbitmq -n fitquest --replicas=2
```

## Upgrade

### Upgrade RabbitMQ Version

1. Update the image in StatefulSet:

```bash
kubectl set image statefulset/rabbitmq rabbitmq=rabbitmq:3.13-management-alpine -n fitquest
```

2. Kubernetes will perform a rolling update

3. Verify upgrade:

```bash
./scripts/verify-rabbitmq.sh
```

## Security

### Change Default Credentials

```bash
# SSH into RabbitMQ pod
kubectl exec -it rabbitmq-0 -n fitquest -- bash

# Change password
rabbitmqctl change_password guest newpassword

# Create new user
rabbitmqctl add_user fitquest-user fitquest-password
rabbitmqctl set_permissions -p / fitquest-user ".*" ".*" ".*"
```

### Enable TLS

1. Create TLS certificates
2. Create Secret with certificates
3. Update StatefulSet to mount certificates
4. Update RabbitMQ configuration to enable TLS

### Network Policies

NetworkPolicy is configured to:
- Allow traffic only from fitquest namespace
- Allow metrics scraping from monitoring namespace
- Allow clustering between RabbitMQ nodes
- Restrict egress to necessary services

## Performance Tuning

### Connection Pooling

Configure connection pooling in microservices:

```csharp
var factory = new ConnectionFactory()
{
    HostName = "rabbitmq.fitquest.svc.cluster.local",
    Port = 5672,
    DispatchConsumersAsync = true,
    AutomaticRecoveryEnabled = true,
    NetworkRecoveryInterval = TimeSpan.FromSeconds(10)
};
```

### Message Batching

Batch messages for better throughput:

```csharp
// Publish multiple messages in a batch
using (var channel = connection.CreateModel())
{
    for (int i = 0; i < 100; i++)
    {
        channel.BasicPublish(exchange, routingKey, null, body);
    }
}
```

### Consumer Prefetch

Set appropriate prefetch count:

```csharp
channel.BasicQos(0, 10, false);  // Prefetch 10 messages per consumer
```

## References

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [RabbitMQ Kubernetes Deployment](https://www.rabbitmq.com/kubernetes/operator/operator-overview.html)
- [RabbitMQ Clustering](https://www.rabbitmq.com/clustering.html)
- [RabbitMQ Management Plugin](https://www.rabbitmq.com/management.html)
- [RabbitMQ Prometheus Plugin](https://www.rabbitmq.com/prometheus.html)
