# PostgreSQL Implementation Summary

## Overview

This document summarizes the PostgreSQL 14+ infrastructure implementation for FitQuest, including architecture, deployment, configuration, and operational procedures.

## Architecture

### Components

1. **PostgreSQL Cluster (3 nodes)**
   - Primary node (postgres-0)
   - Replica nodes (postgres-1, postgres-2)
   - Streaming replication with WAL
   - Persistent storage (50Gi per node)
   - Memory limit: 2GB per node

2. **PostgreSQL Exporter (3 nodes)**
   - Prometheus metrics collection
   - One exporter per PostgreSQL pod
   - Metrics on port 9187

3. **Backup System**
   - Daily CronJob at 2 AM UTC
   - pg_dumpall with gzip compression
   - 30-day retention policy
   - 100GB backup storage

4. **Monitoring**
   - Prometheus ServiceMonitor
   - PrometheusRule for alerting
   - Grafana dashboards (optional)

### Network Architecture

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

## Deployment Files

### RBAC (`postgres-rbac.yaml`)
- ServiceAccount: `postgres`
- ClusterRole: Permissions to read pods, endpoints, services, configmaps
- ClusterRoleBinding: Binds role to service account

### Configuration (`postgres-configmap.yaml`)
- PostgreSQL configuration with replication settings
- pg_hba.conf for client authentication
- Database initialization script

### Network Policy (`postgres-networkpolicy.yaml`)
- Ingress: PostgreSQL nodes, microservices, Prometheus
- Egress: DNS, inter-pod communication, external HTTPS

### StatefulSet (`postgres-statefulset.yaml`)
- 3 replicas with pod anti-affinity
- PostgreSQL container with health checks
- PostgreSQL exporter for Prometheus metrics
- Persistent volume claims (50Gi each)
- Resource requests/limits

### Secrets (`postgres-secret.yaml`)
- PostgreSQL password
- Replicator password
- Connection strings for microservices

### Backup CronJob (`postgres-backup-cronjob.yaml`)
- Daily backup at 2 AM UTC
- pg_dumpall with gzip compression
- 30-day retention policy
- 100GB backup storage

### Monitoring (`servicemonitor.yaml`)
- ServiceMonitor for Prometheus scraping
- PrometheusRule for alerting

## Shared Databases

### users
- **Purpose**: User accounts, profiles, preferences
- **Tables**: users, user_preferences, user_xp, muscle_group_ranks
- **Size**: ~5GB (estimated)
- **Replicated**: Yes
- **Accessed by**: Auth Service, User Profile Service, XP Service

### exercises
- **Purpose**: Exercise library and definitions
- **Tables**: exercises, exercise_muscle_groups
- **Size**: ~500MB (estimated)
- **Replicated**: Yes
- **Accessed by**: Exercise Service, Workout Service

### achievements
- **Purpose**: Achievement definitions and unlocks
- **Tables**: achievements, user_achievements
- **Size**: ~1GB (estimated)
- **Replicated**: Yes
- **Accessed by**: Achievement Service

## Replication Configuration

### Streaming Replication
- **Type**: Asynchronous streaming replication
- **WAL Level**: replica
- **Max WAL Senders**: 10
- **Max Replication Slots**: 10
- **WAL Keep Size**: 1GB
- **Hot Standby**: Enabled
- **Synchronous Commit**: On

### Failover
- **Automatic**: Via Kubernetes pod restart
- **Manual**: Promote replica using `pg_ctl promote`
- **Recovery Time**: ~30 seconds

### Replication Slots
- **Purpose**: Prevent WAL deletion before replicas consume
- **Count**: 10 maximum
- **Retention**: Automatic based on WAL keep size

## Backup Strategy

### Automated Backups
- **Schedule**: Daily at 2 AM UTC
- **Method**: pg_dumpall with gzip compression
- **Retention**: 30 days
- **Storage**: 100GB PVC
- **Location**: `/backups/postgres_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Size**: ~5-10GB per backup (estimated)

### Backup Lifecycle
1. CronJob triggers daily at 2 AM UTC
2. pg_dumpall dumps all databases
3. Output piped to gzip for compression
4. Backup stored in `/backups/` directory
5. Old backups (>30 days) automatically deleted

### Recovery Procedures
1. **Point-in-Time Recovery**: Restore from backup + WAL replay
2. **Full Recovery**: Restore from latest backup
3. **Selective Recovery**: Restore specific database or table

## Monitoring and Alerting

### Prometheus Metrics
- `pg_stat_activity_count`: Number of active connections
- `pg_database_size_bytes`: Database size in bytes
- `pg_replication_lag_seconds`: Replication lag
- `pg_stat_statements_mean_exec_time`: Average query execution time
- `pg_stat_database_blks_hit`: Cache hits
- `pg_stat_database_blks_read`: Cache misses
- `pg_stat_user_tables_last_autovacuum_age_seconds`: Time since last autovacuum

### Alert Rules
- **High Connection Count**: >150 connections for 5 minutes
- **Database Size High**: >40GB for 5 minutes
- **Replication Lag**: >60 seconds for 5 minutes
- **Slow Queries**: >1000ms average for 5 minutes
- **Low Cache Hit Ratio**: <99% for 10 minutes
- **Autovacuum Running Long**: >1 hour for 5 minutes
- **Pod Down**: >2 minutes
- **Replication Slot Lag**: >500MB for 5 minutes

### Grafana Dashboards
- PostgreSQL Overview
- Replication Status
- Query Performance
- Storage Usage
- Backup Status

## Performance Configuration

### Memory Settings
- `shared_buffers`: 256MB (25% of pod memory)
- `effective_cache_size`: 1GB
- `maintenance_work_mem`: 64MB
- `work_mem`: 4MB
- `wal_buffers`: 16MB

### Connection Settings
- `max_connections`: 200
- `superuser_reserved_connections`: 10
- `tcp_keepalives_idle`: 900 seconds
- `tcp_keepalives_interval`: 100 seconds
- `tcp_keepalives_count`: 5

### Autovacuum Settings
- `autovacuum`: On
- `autovacuum_max_workers`: 3
- `autovacuum_naptime`: 10 seconds
- `autovacuum_vacuum_threshold`: 50
- `autovacuum_analyze_threshold`: 50

### Logging Settings
- `log_min_duration_statement`: 1000ms (log slow queries)
- `log_connections`: On
- `log_disconnections`: On
- `log_statement`: all
- `log_lock_waits`: On

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
- Prevents unauthorized access to PostgreSQL

### Secrets
- Stored in Kubernetes Secrets
- Encrypted at rest (if enabled in cluster)
- Rotated regularly
- Never committed to version control

### Authentication
- PostgreSQL password authentication
- Replication user with limited privileges
- pg_hba.conf for client authentication

## Maintenance

### Regular Tasks
- Monitor backup completion (daily)
- Check replication lag (hourly)
- Review slow query logs (weekly)
- Analyze table statistics (weekly)
- Vacuum and analyze (automatic)

### Scaling
- Increase storage: Edit PVC size
- Increase replicas: Not recommended for PostgreSQL (use read replicas instead)
- Increase resources: Edit resource requests/limits

### Upgrades
- PostgreSQL version: Create new cluster, migrate data
- Kubernetes: Rolling update of StatefulSet

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
   - Create ConfigMap
   - Create Secret

4. **Deploy Network Policy**
   - Create NetworkPolicy

5. **Deploy PostgreSQL**
   - Deploy StatefulSet
   - Deploy Services

6. **Deploy Backup**
   - Deploy CronJob
   - Deploy backup storage

7. **Deploy Monitoring**
   - Deploy ServiceMonitor
   - Deploy PrometheusRule

8. **Verify Deployment**
   - Check pod status
   - Verify connectivity
   - Check replication status

## Access Methods

### From Within Cluster
```
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/users
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/exercises
postgresql://postgres:password@postgres.fitquest.svc.cluster.local:5432/achievements
```

### From Outside Cluster (Port Forwarding)
```bash
kubectl port-forward -n fitquest svc/postgres 5432:5432
postgresql://postgres:password@localhost:5432/users
```

### Direct Pod Access
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres
```

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
