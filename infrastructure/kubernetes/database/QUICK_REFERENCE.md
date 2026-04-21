# PostgreSQL Quick Reference

## Quick Start

```bash
# Deploy PostgreSQL
cd infrastructure/kubernetes/database
./scripts/setup-postgres.sh

# Verify deployment
./scripts/verify-postgres.sh
```

## Common Commands

### Connection
```bash
# Connect to primary
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres

# Port forward
kubectl port-forward -n fitquest svc/postgres 5432:5432
psql -h localhost -U postgres
```

### Status Checks
```bash
# Pod status
kubectl get pods -n fitquest -l app=postgres

# Service status
kubectl get svc -n fitquest -l app=postgres

# Storage status
kubectl get pvc -n fitquest -l app=postgres

# Replication status
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_stat_replication;"

# Database list
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -l
```

### Logs
```bash
# PostgreSQL logs
kubectl logs -n fitquest postgres-0 -c postgres

# Exporter logs
kubectl logs -n fitquest postgres-0 -c postgres-exporter

# Follow logs
kubectl logs -n fitquest postgres-0 -c postgres -f
```

### Backup
```bash
# Manual backup
kubectl exec -it postgres-0 -n fitquest -- \
  pg_dumpall -U postgres | gzip > backup.sql.gz

# List backups
kubectl exec postgres-0 -n fitquest -- ls -lh /backups/

# Restore backup
gunzip backup.sql.gz
kubectl exec -i postgres-0 -n fitquest -- \
  psql -U postgres < backup.sql
```

### Monitoring
```bash
# Port forward Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Port forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Check metrics
curl 'http://localhost:9090/api/v1/query?query=pg_stat_activity_count'
```

### Troubleshooting
```bash
# Describe pod
kubectl describe pod postgres-0 -n fitquest

# Get events
kubectl get events -n fitquest --sort-by='.lastTimestamp'

# Test connectivity
kubectl run -it --rm debug --image=postgres:14-alpine --restart=Never -- \
  psql -h postgres.fitquest.svc.cluster.local -U postgres -c "SELECT 1;"

# Check DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup postgres.fitquest.svc.cluster.local
```

## Configuration

### Update PostgreSQL Settings
```bash
# Edit ConfigMap
kubectl edit configmap postgres-config -n fitquest

# Restart pods to apply changes
kubectl rollout restart statefulset/postgres -n fitquest
```

### Update Resource Limits
```bash
# Edit StatefulSet
kubectl edit statefulset postgres -n fitquest

# Update resources section and save
```

### Update Storage Size
```bash
# Edit StatefulSet
kubectl edit statefulset postgres -n fitquest

# Update storage in volumeClaimTemplates
# Delete pods to trigger new PVC creation
kubectl delete pod postgres-0 postgres-1 postgres-2 -n fitquest
```

## Maintenance

### Vacuum and Analyze
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "VACUUM ANALYZE;"
```

### Check Table Sizes
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

### Check Slow Queries
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Check Replication Lag
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT slot_name, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots;"
```

## Cleanup

### Delete PostgreSQL
```bash
# Delete all resources
kubectl delete -f deployment/

# Delete namespace
kubectl delete namespace fitquest

# Delete persistent volumes
kubectl get pv | grep postgres
kubectl delete pv <pv-name>
```

## Useful Links

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

## Support

For issues:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review logs: `kubectl logs -n fitquest postgres-0`
3. Check events: `kubectl describe pod postgres-0 -n fitquest`
