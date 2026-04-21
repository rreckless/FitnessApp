# RabbitMQ Message Queue Infrastructure

This directory contains the Kubernetes deployment manifests and configuration for RabbitMQ cluster, which serves as the event-driven messaging backbone for the FitQuest microservices architecture.

## Overview

RabbitMQ is deployed as a StatefulSet with 3+ replicas for high availability and fault tolerance. The cluster is configured with:

- **Persistent Storage**: Each node has dedicated PersistentVolumeClaim for message durability
- **Clustering**: Nodes automatically discover and form a cluster
- **Monitoring**: Prometheus metrics exposed for observability
- **Dead Letter Queues**: Failed messages are routed to DLQ for analysis and retry
- **Message Persistence**: All exchanges and queues are durable

## Event Types and Routing

The following events are published through RabbitMQ:

### WorkoutCompleted
- **Exchange**: `fitquest.events.workout`
- **Routing Key**: `workout.completed`
- **Subscribers**: XP Service, Achievement Service, Activity Feed Service

### LevelUp
- **Exchange**: `fitquest.events.progression`
- **Routing Key**: `progression.levelup`
- **Subscribers**: Leaderboard Service, Achievement Service, Activity Feed Service

### RankUp
- **Exchange**: `fitquest.events.progression`
- **Routing Key**: `progression.rankup`
- **Subscribers**: Achievement Service, Activity Feed Service

### StreakMilestone
- **Exchange**: `fitquest.events.streak`
- **Routing Key**: `streak.milestone`
- **Subscribers**: Achievement Service, Activity Feed Service

### AchievementUnlocked
- **Exchange**: `fitquest.events.achievement`
- **Routing Key**: `achievement.unlocked`
- **Subscribers**: Activity Feed Service

### FriendshipCreated
- **Exchange**: `fitquest.events.social`
- **Routing Key**: `social.friendship.created`
- **Subscribers**: Activity Feed Service

### SubscriptionUpgraded
- **Exchange**: `fitquest.events.subscription`
- **Routing Key**: `subscription.upgraded`
- **Subscribers**: Feature Gating Service

## Directory Structure

```
message-queue/
├── README.md                          # This file
├── SETUP_GUIDE.md                     # Detailed setup instructions
├── TROUBLESHOOTING.md                 # Common issues and solutions
├── deployment/
│   ├── rabbitmq-statefulset.yaml      # RabbitMQ StatefulSet
│   ├── rabbitmq-service.yaml          # ClusterIP Service
│   ├── rabbitmq-configmap.yaml        # Configuration
│   ├── rabbitmq-rbac.yaml             # ServiceAccount, Role, RoleBinding
│   └── rabbitmq-networkpolicy.yaml    # Network security policies
├── config/
│   ├── exchanges-queues.yaml          # Exchange and queue definitions
│   └── rabbitmq.conf                  # RabbitMQ configuration file
├── monitoring/
│   ├── prometheus-rules.yaml          # Prometheus alert rules
│   └── grafana-dashboard.json         # Grafana dashboard
├── scripts/
│   ├── setup-rabbitmq.sh              # Deployment script
│   ├── verify-rabbitmq.sh             # Verification script
│   └── initialize-exchanges.sh        # Initialize exchanges and queues
└── docs/
    └── ARCHITECTURE.md                # Detailed architecture documentation
```

## Quick Start

1. **Deploy RabbitMQ cluster**:
   ```bash
   ./scripts/setup-rabbitmq.sh
   ```

2. **Verify deployment**:
   ```bash
   ./scripts/verify-rabbitmq.sh
   ```

3. **Initialize exchanges and queues**:
   ```bash
   ./scripts/initialize-exchanges.sh
   ```

## Access RabbitMQ Management UI

The RabbitMQ Management UI is available at:
- **URL**: `http://rabbitmq-management.fitquest.local:15672`
- **Default Credentials**: `guest` / `guest` (change in production)

## Monitoring

Prometheus metrics are exposed on port 15692. Grafana dashboards are available for:
- Queue depth and message rates
- Node health and memory usage
- Connection and channel statistics
- Message acknowledgment rates

## Configuration

Key configuration parameters:

- **Cluster Size**: 3 nodes (configurable in StatefulSet)
- **Memory Limit**: 512Mi per node (configurable)
- **Storage**: 10Gi per node (configurable)
- **Message TTL**: 24 hours (configurable per queue)
- **Dead Letter TTL**: 7 days

## Security

- **Network Policies**: Restrict traffic to fitquest namespace
- **RBAC**: ServiceAccount with minimal required permissions
- **TLS**: Enabled for inter-node communication
- **Authentication**: Default credentials should be changed in production

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## References

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [RabbitMQ Kubernetes Deployment](https://www.rabbitmq.com/kubernetes/operator/operator-overview.html)
- [RabbitMQ Clustering](https://www.rabbitmq.com/clustering.html)
