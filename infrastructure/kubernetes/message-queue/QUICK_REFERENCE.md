# RabbitMQ Quick Reference

## Deployment

```bash
# Deploy RabbitMQ cluster
cd infrastructure/kubernetes/message-queue
./scripts/setup-rabbitmq.sh

# Verify deployment
./scripts/verify-rabbitmq.sh
```

## Access

| Service | URL | Port | Credentials |
|---------|-----|------|-------------|
| AMQP | `rabbitmq.fitquest.svc.cluster.local` | 5672 | guest/guest |
| Management UI | `rabbitmq-management.fitquest.svc.cluster.local` | 15672 | guest/guest |
| Metrics | `rabbitmq.fitquest.svc.cluster.local` | 15692 | N/A |

## Port Forwarding

```bash
# AMQP
kubectl port-forward -n fitquest svc/rabbitmq-client 5672:5672

# Management UI
kubectl port-forward -n fitquest svc/rabbitmq-management 15672:15672

# Metrics
kubectl port-forward -n fitquest svc/rabbitmq 15692:15692
```

## Common Commands

### Cluster Status

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status
```

### List Exchanges

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges
```

### List Queues

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues name durable messages consumers
```

### List Bindings

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_bindings
```

### Purge Queue

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl purge_queue queue-name
```

### Check Status

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics status
```

### Ping

```bash
kubectl exec -n fitquest rabbitmq-0 -- rabbitmq-diagnostics -q ping
```

## Scaling

```bash
# Scale to N replicas
kubectl scale statefulset rabbitmq -n fitquest --replicas=N

# Check status
kubectl rollout status statefulset/rabbitmq -n fitquest
```

## Monitoring

### Prometheus Targets

```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets
```

### Alert Rules

```bash
kubectl get prometheusrule -n monitoring
kubectl describe prometheusrule rabbitmq-alerts -n monitoring
```

## Troubleshooting

### Pod Logs

```bash
kubectl logs -n fitquest rabbitmq-0
kubectl logs -n fitquest rabbitmq-1
kubectl logs -n fitquest rabbitmq-2
```

### Pod Events

```bash
kubectl describe pod rabbitmq-0 -n fitquest
```

### Pod Status

```bash
kubectl get pods -n fitquest -l app=rabbitmq
```

### PVC Status

```bash
kubectl get pvc -n fitquest -l app=rabbitmq
```

### Service Status

```bash
kubectl get svc -n fitquest -l app=rabbitmq
kubectl get endpoints -n fitquest -l app=rabbitmq
```

## Configuration

### Memory Limit

```bash
kubectl set resources statefulset rabbitmq -n fitquest --limits=memory=1Gi
```

### CPU Limit

```bash
kubectl set resources statefulset rabbitmq -n fitquest --limits=cpu=1000m
```

### Storage Size

```bash
# Note: Requires manual intervention depending on storage provisioner
kubectl patch pvc rabbitmq-data-rabbitmq-0 -n fitquest -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
```

## Event Types

| Event | Exchange | Routing Key | Subscribers |
|-------|----------|-------------|-------------|
| WorkoutCompleted | `fitquest.events.workout` | `workout.completed` | XP, Achievement, Activity Feed |
| LevelUp | `fitquest.events.progression` | `progression.levelup` | Leaderboard, Achievement, Activity Feed |
| RankUp | `fitquest.events.progression` | `progression.rankup` | Achievement, Activity Feed |
| StreakMilestone | `fitquest.events.streak` | `streak.milestone` | Achievement, Activity Feed |
| AchievementUnlocked | `fitquest.events.achievement` | `achievement.unlocked` | Activity Feed |
| FriendshipCreated | `fitquest.events.social` | `social.friendship.created` | Activity Feed |
| SubscriptionUpgraded | `fitquest.events.subscription` | `subscription.upgraded` | Feature Gating |

## Backup

```bash
# Create backup
kubectl exec -n fitquest rabbitmq-0 -- tar czf /tmp/rabbitmq-backup.tar.gz /var/lib/rabbitmq

# Copy to local
kubectl cp fitquest/rabbitmq-0:/tmp/rabbitmq-backup.tar.gz ./rabbitmq-backup.tar.gz
```

## Restore

```bash
# Copy to pod
kubectl cp ./rabbitmq-backup.tar.gz fitquest/rabbitmq-0:/tmp/rabbitmq-backup.tar.gz

# Extract
kubectl exec -n fitquest rabbitmq-0 -- tar xzf /tmp/rabbitmq-backup.tar.gz -C /
```

## Upgrade

```bash
# Update image
kubectl set image statefulset/rabbitmq rabbitmq=rabbitmq:3.13-management-alpine -n fitquest

# Monitor
kubectl rollout status statefulset/rabbitmq -n fitquest
```

## Delete

```bash
# Delete StatefulSet (keeps PVCs)
kubectl delete statefulset rabbitmq -n fitquest

# Delete all RabbitMQ resources
kubectl delete all -n fitquest -l app=rabbitmq

# Delete PVCs
kubectl delete pvc -n fitquest -l app=rabbitmq
```

## Documentation

- [README.md](README.md) - Overview and architecture
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup instructions
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Complete implementation details
- [config/exchanges-queues.yaml](config/exchanges-queues.yaml) - Event configuration

## Files

| File | Purpose |
|------|---------|
| `deployment/rabbitmq-rbac.yaml` | RBAC configuration |
| `deployment/rabbitmq-configmap.yaml` | RabbitMQ configuration |
| `deployment/rabbitmq-statefulset.yaml` | StatefulSet deployment |
| `deployment/rabbitmq-service.yaml` | Services |
| `deployment/rabbitmq-networkpolicy.yaml` | Network policies |
| `monitoring/prometheus-rules.yaml` | Prometheus rules and alerts |
| `scripts/setup-rabbitmq.sh` | Deployment script |
| `scripts/verify-rabbitmq.sh` | Verification script |
| `config/exchanges-queues.yaml` | Event configuration |

## Support

For issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or check:
- RabbitMQ logs: `kubectl logs -n fitquest rabbitmq-0`
- Kubernetes events: `kubectl get events -n fitquest`
- Pod description: `kubectl describe pod rabbitmq-0 -n fitquest`
