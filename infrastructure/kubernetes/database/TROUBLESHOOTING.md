# PostgreSQL Troubleshooting Guide

This guide provides solutions for common PostgreSQL deployment issues.

## Pod Issues

### Pods Not Starting

**Symptoms**: Pods stuck in Pending, CrashLoopBackOff, or ImagePullBackOff state

**Diagnosis**:
```bash
# Check pod status
kubectl get pods -n fitquest -l app=postgres

# Get detailed pod information
kubectl describe pod postgres-0 -n fitquest

# Check pod events
kubectl get events -n fitquest --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs postgres-0 -n fitquest -c postgres
kubectl logs postgres-0 -n fitquest -c postgres-exporter
```

**Solutions**:

1. **Insufficient Storage**
   ```bash
   # Check available storage
   kubectl get pvc -n fitquest
   kubectl describe pvc postgres-storage-postgres-0 -n fitquest
   
   # If PVC is pending, check storage class
   kubectl get storageclass
   kubectl describe storageclass standard
   ```
   
   **Fix**: Create storage class or increase available storage

2. **Insufficient Resources**
   ```bash
   # Check node resources
   kubectl describe nodes
   kubectl top nodes
   kubectl top pods -n fitquest
   ```
   
   **Fix**: Add more nodes or reduce resource requests

3. **Image Pull Issues**
   ```bash
   # Check image availability
   docker pull postgres:14-alpine
   docker pull prometheuscommunity/postgres-exporter:v0.11.1
   ```
   
   **Fix**: Ensure images are available or use private registry

4. **Configuration Issues**
   ```bash
   # Check ConfigMap
   kubectl get configmap -n fitquest postgres-config
   kubectl describe configmap -n fitquest postgres-config
   ```
   
   **Fix**: Verify ConfigMap syntax and values

### Pod Crashes

**Symptoms**: Pods restart repeatedly

**Diagnosis**:
```bash
# Check restart count
kubectl get pods -n fitquest -l app=postgres

# Check logs for errors
kubectl logs postgres-0 -n fitquest -c postgres --previous
kubectl logs postgres-0 -n fitquest -c postgres-exporter --previous
```

**Solutions**:

1. **PostgreSQL Initialization Failure**
   ```bash
   # Check initialization logs
   kubectl logs postgres-0 -n fitquest -c postgres
   
   # Check data directory
   kubectl exec postgres-0 -n fitquest -- ls -la /var/lib/postgresql/data/
   ```
   
   **Fix**: Delete PVC and let it reinitialize
   ```bash
   kubectl delete pvc postgres-storage-postgres-0 -n fitquest
   kubectl delete pod postgres-0 -n fitquest
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   kubectl top pod postgres-0 -n fitquest
   ```
   
   **Fix**: Increase memory limits in StatefulSet

3. **Exporter Connection Issues**
   ```bash
   # Check exporter logs
   kubectl logs postgres-0 -n fitquest -c postgres-exporter
   ```
   
   **Fix**: Verify PostgreSQL is running and exporter has correct credentials

## Connectivity Issues

### Cannot Connect to PostgreSQL

**Symptoms**: Connection refused or timeout

**Diagnosis**:
```bash
# Test connectivity from pod
kubectl run -it --rm debug --image=postgres:14-alpine --restart=Never -- \
  psql -h postgres.fitquest.svc.cluster.local -U postgres -c "SELECT 1;"

# Check service
kubectl get svc -n fitquest postgres
kubectl describe svc -n fitquest postgres

# Check endpoints
kubectl get endpoints -n fitquest postgres
```

**Solutions**:

1. **Service Not Ready**
   ```bash
   # Check pod readiness
   kubectl get pods -n fitquest -l app=postgres
   
   # Check readiness probe
   kubectl describe pod postgres-0 -n fitquest | grep -A 5 "Readiness"
   ```
   
   **Fix**: Wait for pods to be ready or check pod logs

2. **NetworkPolicy Blocking**
   ```bash
   # Check NetworkPolicy
   kubectl get networkpolicy -n fitquest postgres
   kubectl describe networkpolicy -n fitquest postgres
   ```
   
   **Fix**: Update NetworkPolicy to allow traffic

3. **DNS Resolution Issues**
   ```bash
   # Test DNS
   kubectl run -it --rm debug --image=busybox --restart=Never -- \
     nslookup postgres.fitquest.svc.cluster.local
   
   # Check CoreDNS
   kubectl get pods -n kube-system -l k8s-app=kube-dns
   kubectl logs -n kube-system -l k8s-app=kube-dns
   ```
   
   **Fix**: Restart CoreDNS or check DNS configuration

4. **Wrong Credentials**
   ```bash
   # Check secret
   kubectl get secret -n fitquest postgres-secret
   
   # Verify password
   kubectl exec postgres-0 -n fitquest -- psql -U postgres -c "SELECT 1;"
   ```
   
   **Fix**: Update secret with correct credentials

## Replication Issues

### Replication Not Working

**Symptoms**: No replicas connected, replication lag increasing

**Diagnosis**:
```bash
# Check replication status
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_stat_replication;"

# Check replication slots
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_replication_slots;"

# Check WAL archiving
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SHOW archive_mode; SHOW archive_command;"

# Check replica status
kubectl exec -it postgres-1 -n fitquest -- psql -U postgres -c \
  "SELECT pg_is_in_recovery();"
```

**Solutions**:

1. **Replication User Issues**
   ```bash
   # Check replication user
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "SELECT * FROM pg_user WHERE usename = 'replicator';"
   
   # Recreate replication user
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'password';"
   ```
   
   **Fix**: Ensure replication user exists and has correct permissions

2. **WAL Archiving Issues**
   ```bash
   # Check WAL files
   kubectl exec postgres-0 -n fitquest -- ls -la /var/lib/postgresql/data/pgdata/pg_wal/
   
   # Check WAL keep size
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "SHOW wal_keep_size;"
   ```
   
   **Fix**: Increase wal_keep_size or fix archive_command

3. **Network Issues Between Pods**
   ```bash
   # Test connectivity between pods
   kubectl exec postgres-0 -n fitquest -- ping postgres-1.postgres.fitquest.svc.cluster.local
   
   # Check NetworkPolicy
   kubectl get networkpolicy -n fitquest postgres
   ```
   
   **Fix**: Update NetworkPolicy or check network connectivity

4. **Replica Lag**
   ```bash
   # Check replication lag
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "SELECT slot_name, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots;"
   
   # Check replica apply lag
   kubectl exec -it postgres-1 -n fitquest -- psql -U postgres -c \
     "SELECT now() - pg_last_xact_replay_time() AS replication_lag;"
   ```
   
   **Fix**: Increase max_wal_senders or optimize queries

## Storage Issues

### Storage Full

**Symptoms**: Disk full errors, pods evicted

**Diagnosis**:
```bash
# Check storage usage
kubectl exec postgres-0 -n fitquest -- du -sh /var/lib/postgresql/data/

# Check PVC usage
kubectl get pvc -n fitquest
kubectl describe pvc postgres-storage-postgres-0 -n fitquest

# Check node disk usage
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**Solutions**:

1. **Increase PVC Size**
   ```bash
   # Edit StatefulSet
   kubectl edit statefulset postgres -n fitquest
   
   # Update storage size in volumeClaimTemplates
   # Note: This only affects new pods
   ```
   
   **Fix**: Delete pods to trigger new PVC creation with larger size

2. **Clean Up Old Data**
   ```bash
   # Run VACUUM
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "VACUUM ANALYZE;"
   
   # Check table sizes
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
   ```
   
   **Fix**: Archive or delete old data

3. **Backup Storage Full**
   ```bash
   # Check backup storage
   kubectl exec postgres-0 -n fitquest -- ls -lh /backups/
   
   # Clean up old backups
   kubectl exec postgres-0 -n fitquest -- find /backups -name "*.sql.gz" -mtime +30 -delete
   ```
   
   **Fix**: Increase backup storage or delete old backups

## Performance Issues

### Slow Queries

**Symptoms**: High query latency, slow application response

**Diagnosis**:
```bash
# Check slow query log
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check query plans
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "EXPLAIN ANALYZE SELECT * FROM users WHERE id = 1;"
```

**Solutions**:

1. **Add Indexes**
   ```bash
   # Create index
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "CREATE INDEX idx_users_id ON users(id);"
   ```
   
   **Fix**: Identify missing indexes and create them

2. **Analyze Tables**
   ```bash
   # Update statistics
   kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
     "ANALYZE;"
   ```
   
   **Fix**: Run ANALYZE to update query planner statistics

3. **Increase Resources**
   ```bash
   # Check resource usage
   kubectl top pod postgres-0 -n fitquest
   ```
   
   **Fix**: Increase CPU/memory limits in StatefulSet

### High Memory Usage

**Symptoms**: Pod OOMKilled, memory pressure

**Diagnosis**:
```bash
# Check memory usage
kubectl top pod postgres-0 -n fitquest

# Check PostgreSQL memory settings
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SHOW shared_buffers; SHOW work_mem; SHOW maintenance_work_mem;"
```

**Solutions**:

1. **Reduce Memory Settings**
   ```bash
   # Edit ConfigMap
   kubectl edit configmap postgres-config -n fitquest
   
   # Reduce shared_buffers, work_mem, etc.
   ```
   
   **Fix**: Restart pods to apply changes

2. **Increase Pod Memory Limit**
   ```bash
   # Edit StatefulSet
   kubectl edit statefulset postgres -n fitquest
   
   # Increase memory limit
   ```
   
   **Fix**: Restart pods to apply changes

## Backup Issues

### Backup Job Failing

**Symptoms**: Backup CronJob not running or failing

**Diagnosis**:
```bash
# Check CronJob
kubectl get cronjob -n fitquest postgres-backup
kubectl describe cronjob -n fitquest postgres-backup

# Check backup jobs
kubectl get jobs -n fitquest -l app=postgres

# Check job logs
kubectl logs -n fitquest job/postgres-backup-xxx

# Check backup storage
kubectl get pvc -n fitquest postgres-backup-pvc
kubectl describe pvc -n fitquest postgres-backup-pvc
```

**Solutions**:

1. **Backup Storage Full**
   ```bash
   # Check storage usage
   kubectl exec postgres-0 -n fitquest -- du -sh /backups/
   
   # Clean up old backups
   kubectl exec postgres-0 -n fitquest -- find /backups -name "*.sql.gz" -mtime +30 -delete
   ```
   
   **Fix**: Increase backup storage or delete old backups

2. **PostgreSQL Connection Issues**
   ```bash
   # Test backup manually
   kubectl exec -it postgres-0 -n fitquest -- \
     pg_dumpall -U postgres | gzip > /tmp/test_backup.sql.gz
   ```
   
   **Fix**: Check PostgreSQL connectivity and credentials

3. **Permission Issues**
   ```bash
   # Check backup directory permissions
   kubectl exec postgres-0 -n fitquest -- ls -la /backups/
   ```
   
   **Fix**: Update permissions or mount options

## Monitoring Issues

### Prometheus Not Scraping Metrics

**Symptoms**: No PostgreSQL metrics in Prometheus

**Diagnosis**:
```bash
# Check ServiceMonitor
kubectl get servicemonitor -n fitquest postgres
kubectl describe servicemonitor -n fitquest postgres

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check exporter metrics
kubectl port-forward -n fitquest svc/postgres 9187:9187
# Visit http://localhost:9187/metrics
```

**Solutions**:

1. **ServiceMonitor Not Found**
   ```bash
   # Check if Prometheus Operator is installed
   kubectl get crd servicemonitors.monitoring.coreos.com
   
   # Deploy ServiceMonitor
   kubectl apply -f deployment/servicemonitor.yaml
   ```
   
   **Fix**: Install Prometheus Operator or deploy ServiceMonitor

2. **Exporter Not Running**
   ```bash
   # Check exporter pod
   kubectl logs postgres-0 -n fitquest -c postgres-exporter
   ```
   
   **Fix**: Check exporter logs and restart pod

3. **Prometheus Not Configured**
   ```bash
   # Check Prometheus configuration
   kubectl get configmap -n monitoring prometheus-config
   ```
   
   **Fix**: Update Prometheus configuration to scrape ServiceMonitor

## General Debugging

### Collect Diagnostic Information
```bash
# Pod information
kubectl get pods -n fitquest -l app=postgres -o yaml > postgres_pods.yaml

# StatefulSet information
kubectl get statefulset -n fitquest postgres -o yaml > postgres_statefulset.yaml

# Events
kubectl get events -n fitquest --sort-by='.lastTimestamp' > postgres_events.txt

# Logs
kubectl logs -n fitquest postgres-0 -c postgres > postgres_0_logs.txt
kubectl logs -n fitquest postgres-0 -c postgres-exporter > postgres_0_exporter_logs.txt

# PostgreSQL information
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT version(); SELECT * FROM pg_stat_replication; SHOW all;" > postgres_info.txt
```

### Common Commands
```bash
# Connect to PostgreSQL
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres

# View logs
kubectl logs -n fitquest postgres-0 -c postgres -f

# Port forward
kubectl port-forward -n fitquest svc/postgres 5432:5432

# Execute command in pod
kubectl exec -it postgres-0 -n fitquest -- bash

# Describe pod
kubectl describe pod postgres-0 -n fitquest

# Get pod events
kubectl get events -n fitquest --field-selector involvedObject.name=postgres-0
```

## Getting Help

If you're still experiencing issues:

1. Collect diagnostic information (see above)
2. Check PostgreSQL logs: `kubectl logs -n fitquest postgres-0`
3. Check Kubernetes events: `kubectl describe pod postgres-0 -n fitquest`
4. Review PostgreSQL documentation: https://www.postgresql.org/docs/
5. Check Kubernetes documentation: https://kubernetes.io/docs/
6. Open an issue with diagnostic information

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Troubleshooting](https://www.postgresql.org/docs/current/runtime.html)
- [Kubernetes Troubleshooting](https://kubernetes.io/docs/tasks/debug-application-cluster/)
- [StatefulSet Troubleshooting](https://kubernetes.io/docs/tasks/run-application/run-stateful-application/)
