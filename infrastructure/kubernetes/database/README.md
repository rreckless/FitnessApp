# PostgreSQL Database Infrastructure for FitQuest

This directory contains the Kubernetes deployment configuration for PostgreSQL 14+ with streaming replication, automated backups, and monitoring for the FitQuest gamified fitness application.

## Overview

The PostgreSQL infrastructure provides:

- **High Availability**: 3-node StatefulSet with streaming replication
- **Data Persistence**: 50GB persistent storage per node
- **Automated Backups**: Daily backups with 30-day retention
- **Monitoring**: Prometheus metrics and alerting
- **Shared Databases**: users, exercises, achievements
- **Security**: RBAC, NetworkPolicy, and encrypted secrets

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         PostgreSQL Cluster (3 nodes)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ Primary  │  │ Replica1 │  │ Replica2 │           │   │
│  │  │ 5432     │  │ 5432     │  │ 5432     │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │       ↕              ↕              ↕                │   │
│  │  Streaming Replication (WAL)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Microservices (fitquest namespace)           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │Auth Svc  │  │Workout   │  │Leaderboard           │   │
│  │  │          │  │Svc       │  │Svc       │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │         ↓              ↓              ↓              │   │
│  │    postgres.fitquest.svc.cluster.local:5432         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Monitoring (monitoring namespace)            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │Prometheus│  │Grafana   │  │Alertmanager           │   │
│  │  │          │  │          │  │          │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │         ↓              ↓              ↓              │   │
│  │    postgres_exporter metrics (9187)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Backup Storage (100GB)                       │   │
│  │  Daily backups with 30-day retention                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
database/
├── deployment/
│   ├── postgres-rbac.yaml              # RBAC configuration
│   ├── postgres-configmap.yaml         # PostgreSQL configuration
│   ├── postgres-networkpolicy.yaml     # Network policies
│   ├── postgres-statefulset.yaml       # StatefulSet and Services
│   ├── postgres-secret.yaml            # Secrets (passwords, connection strings)
│   ├── postgres-backup-cronjob.yaml    # Automated backup CronJob
│   └── servicemonitor.yaml             # Prometheus monitoring
├── scripts/
│   ├── setup-postgres.sh               # Deployment script
│   └── verify-postgres.sh              # Verification script
├── monitoring/
│   └── prometheus-rules.yaml           # Alert rules
├── README.md                           # This file
├── SETUP_GUIDE.md                      # Detailed setup instructions
├── TROUBLESHOOTING.md                  # Troubleshooting guide
└── IMPLEMENTATION_SUMMARY.md           # Implementation details
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured and connected to cluster
- Storage class named "standard" available
- 150GB total storage (50GB × 3 nodes + 100GB backups)

### Deployment

1. **Deploy PostgreSQL**:
   ```bash
   cd infrastructure/kubernetes/database
   chmod +x scripts/setup-postgres.sh
   ./scripts/setup-postgres.sh
   ```

2. **Verify Deployment**:
   ```bash
   chmod +x scripts/verify-postgres.sh
   ./scripts/verify-postgres.sh
   ```

3. **Check Status**:
   ```bash
   kubectl get pods -n fitquest -l app=postgres
   kubectl get svc -n fitquest -l app=postgres
   kubectl get pvc -n fitquest -l app=postgres
   ```

## Shared Databases

### users
- **Purpose**: User accounts, profiles, preferences
- **Tables**: users, user_preferences, user_xp, muscle_group_ranks
- **Size**: ~5GB (estimated)
- **Replicated**: Yes

### exercises
- **Purpose**: Exercise library and definitions
- **Tables**: exercises, exercise_muscle_groups
- **Size**: ~500MB (estimated)
- **Replicated**: Yes

### achievements
- **Purpose**: Achievement definitions and unlocks
- **Tables**: achievements, user_achievements
- **Size**: ~1GB (estimated)
- **Replicated**: Yes

## Replication Configuration

### Streaming Replication
- **Type**: Asynchronous streaming replication
- **WAL Level**: replica
- **Max WAL Senders**: 10
- **Max Replication Slots**: 10
- **WAL Keep Size**: 1GB
- **Hot Standby**: Enabled

### Failover
- **Automatic**: Via Kubernetes pod restart
- **Manual**: Promote replica using `pg_ctl promote`
- **Recovery Time**: ~30 seconds

## Backup Strategy

### Automated Backups
- **Schedule**: Daily at 2 AM UTC
- **Method**: pg_dumpall with gzip compression
- **Retention**: 30 days
- **Storage**: 100GB PVC
- **Location**: `/backups/postgres_backup_YYYYMMDD_HHMMSS.sql.gz`

### Manual Backup
```bash
kubectl exec -it postgres-0 -n fitquest -- \
  pg_dumpall -U postgres | gzip > backup.sql.gz
```

### Restore from Backup
```bash
# Extract backup
gunzip backup.sql.gz

# Restore to new database
kubectl exec -i postgres-0 -n fitquest -- \
  psql -U postgres < backup.sql
```

## Monitoring and Alerting

### Prometheus Metrics
- `pg_stat_activity_count`: Number of active connections
- `pg_database_size_bytes`: Database size in bytes
- `pg_replication_lag_seconds`: Replication lag
- `pg_stat_statements_mean_exec_time`: Average query execution time
- `pg_stat_database_blks_hit`: Cache hits
- `pg_stat_database_blks_read`: Cache misses

### Alert Rules
- High connection count (>150)
- Database size high (>40GB)
- Replication lag (>60s)
- Slow queries (>1000ms average)
- Low cache hit ratio (<99%)
- Autovacuum running long (>1 hour)
- Pod down (>2 minutes)
- Replication slot lag (>500MB)

### Grafana Dashboards
- PostgreSQL Overview
- Replication Status
- Query Performance
- Storage Usage
- Backup Status

## Connection Strings

### From Within Cluster
```
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/users
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/exercises
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/achievements
```

### From Outside Cluster (Port Forward)
```bash
kubectl port-forward -n fitquest svc/postgres 5432:5432
postgresql://postgres:password@localhost:5432/users
```

## Resource Requirements

### PostgreSQL Pods
- **CPU Request**: 250m per pod
- **CPU Limit**: 1000m per pod
- **Memory Request**: 512Mi per pod
- **Memory Limit**: 2Gi per pod
- **Storage**: 50Gi per pod

### Exporter Pods
- **CPU Request**: 50m per pod
- **CPU Limit**: 200m per pod
- **Memory Request**: 64Mi per pod
- **Memory Limit**: 256Mi per pod

### Backup Job
- **CPU Request**: 100m
- **CPU Limit**: 500m
- **Memory Request**: 256Mi
- **Memory Limit**: 1Gi

### Total Resources
- **CPU**: 900m request, 3.6 CPU limit
- **Memory**: 2.5Gi request, 8Gi limit
- **Storage**: 150Gi (50Gi × 3 + 100Gi backups)

## Security

### RBAC
- ServiceAccount: `postgres`
- ClusterRole: Read pods, endpoints, services, configmaps
- ClusterRoleBinding: Binds role to service account

### NetworkPolicy
- Ingress: PostgreSQL nodes, microservices, Prometheus
- Egress: DNS, inter-pod communication, external HTTPS

### Secrets
- Stored in Kubernetes Secrets
- Encrypted at rest (if enabled in cluster)
- Rotated regularly
- Never committed to version control

## Maintenance

### Regular Tasks
- Monitor backup completion (daily)
- Check replication lag (hourly)
- Review slow query logs (weekly)
- Analyze table statistics (weekly)
- Vacuum and analyze (automatic)

### Scaling
- Increase storage: Edit PVC size
- Increase replicas: Edit StatefulSet replicas (not recommended for PostgreSQL)
- Increase resources: Edit resource requests/limits

### Upgrades
- PostgreSQL version: Create new cluster, migrate data
- Kubernetes: Rolling update of StatefulSet

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

Common issues:
- Pods not starting: Check storage class, node resources
- Replication lag: Check network, WAL archiving
- Backup failures: Check backup storage, permissions
- Connection issues: Check NetworkPolicy, service DNS

## Next Steps

1. Deploy PostgreSQL: `./scripts/setup-postgres.sh`
2. Verify deployment: `./scripts/verify-postgres.sh`
3. Configure microservices to use PostgreSQL
4. Set up monitoring dashboards
5. Test backup and recovery procedures
6. Configure automated failover (optional)

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
