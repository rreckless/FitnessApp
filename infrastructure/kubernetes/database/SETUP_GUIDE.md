# PostgreSQL Setup Guide for FitQuest

This guide provides detailed instructions for deploying and configuring PostgreSQL for FitQuest.

## Prerequisites

### System Requirements
- Kubernetes cluster 1.20 or later
- kubectl CLI tool configured
- At least 150GB available storage
- 3+ worker nodes (for pod anti-affinity)

### Cluster Verification
```bash
# Check cluster version
kubectl version

# Check available storage classes
kubectl get storageclass

# Check available nodes
kubectl get nodes

# Check available storage
kubectl describe nodes | grep -A 5 "Allocated resources"
```

## Pre-Deployment Steps

### 1. Create Namespace
```bash
kubectl create namespace fitquest
```

### 2. Verify Storage Class
```bash
# List available storage classes
kubectl get storageclass

# If "standard" doesn't exist, create one
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs  # or your provisioner
parameters:
  type: gp2
  iops: "100"
  fstype: ext4
EOF
```

### 3. Update Secrets
Edit `deployment/postgres-secret.yaml` and update passwords:
```bash
# Generate secure passwords
openssl rand -base64 32

# Update the secret file with new passwords
# IMPORTANT: Never commit passwords to version control
```

## Deployment Steps

### Step 1: Deploy RBAC
```bash
kubectl apply -f deployment/postgres-rbac.yaml

# Verify
kubectl get serviceaccount -n fitquest postgres
kubectl get clusterrole postgres
kubectl get clusterrolebinding postgres
```

### Step 2: Deploy ConfigMap
```bash
kubectl apply -f deployment/postgres-configmap.yaml

# Verify
kubectl get configmap -n fitquest postgres-config
kubectl describe configmap -n fitquest postgres-config
```

### Step 3: Deploy Secret
```bash
kubectl apply -f deployment/postgres-secret.yaml

# Verify (don't display values)
kubectl get secret -n fitquest postgres-secret
```

### Step 4: Deploy NetworkPolicy
```bash
kubectl apply -f deployment/postgres-networkpolicy.yaml

# Verify
kubectl get networkpolicy -n fitquest postgres
```

### Step 5: Deploy StatefulSet and Services
```bash
kubectl apply -f deployment/postgres-statefulset.yaml

# Verify
kubectl get statefulset -n fitquest postgres
kubectl get svc -n fitquest -l app=postgres
kubectl get pvc -n fitquest -l app=postgres
```

### Step 6: Wait for Pods to Be Ready
```bash
# Watch pod startup
kubectl get pods -n fitquest -l app=postgres -w

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n fitquest --timeout=300s

# Check pod status
kubectl get pods -n fitquest -l app=postgres -o wide
```

### Step 7: Deploy Backup CronJob
```bash
kubectl apply -f deployment/postgres-backup-cronjob.yaml

# Verify
kubectl get cronjob -n fitquest postgres-backup
kubectl get pvc -n fitquest postgres-backup-pvc
```

### Step 8: Deploy Monitoring (Optional)
```bash
# Only if Prometheus is installed
kubectl apply -f deployment/servicemonitor.yaml

# Verify
kubectl get servicemonitor -n fitquest postgres
kubectl get prometheusrule -n fitquest postgres
```

## Post-Deployment Verification

### 1. Check Pod Status
```bash
kubectl get pods -n fitquest -l app=postgres

# Expected output:
# NAME         READY   STATUS    RESTARTS   AGE
# postgres-0   2/2     Running   0          5m
# postgres-1   2/2     Running   0          4m
# postgres-2   2/2     Running   0          3m
```

### 2. Check Services
```bash
kubectl get svc -n fitquest -l app=postgres

# Expected output:
# NAME                TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)
# postgres            ClusterIP   None         <none>        5432/TCP,9187/TCP
# postgres-headless   ClusterIP   None         <none>        5432/TCP
```

### 3. Check Storage
```bash
kubectl get pvc -n fitquest -l app=postgres

# Expected output:
# NAME                           STATUS   VOLUME   CAPACITY   ACCESS MODES
# postgres-storage-postgres-0    Bound    pv-xxx   50Gi       RWO
# postgres-storage-postgres-1    Bound    pv-xxx   50Gi       RWO
# postgres-storage-postgres-2    Bound    pv-xxx   50Gi       RWO
```

### 4. Test Database Connectivity
```bash
# Connect to primary pod
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres

# In psql:
postgres=# SELECT version();
postgres=# \l
postgres=# \q
```

### 5. Check Replication Status
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_stat_replication;"

# Expected output:
# pid | usesysid | usename | application_name | client_addr | ...
# 123 |       10 | replicator | walreceiver | 10.x.x.x | ...
# 124 |       10 | replicator | walreceiver | 10.x.x.x | ...
```

### 6. Verify Databases
```bash
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -l

# Expected output should include:
# users       | postgres | UTF8 | en_US.UTF-8 | en_US.UTF-8 |
# exercises   | postgres | UTF8 | en_US.UTF-8 | en_US.UTF-8 |
# achievements| postgres | UTF8 | en_US.UTF-8 | en_US.UTF-8 |
```

## Configuration

### Adjust PostgreSQL Settings
Edit `deployment/postgres-configmap.yaml` and update `postgresql.conf`:

```yaml
data:
  postgresql.conf: |
    max_connections = 200
    shared_buffers = 256MB
    # ... other settings
```

Then apply:
```bash
kubectl apply -f deployment/postgres-configmap.yaml
kubectl rollout restart statefulset/postgres -n fitquest
```

### Adjust Resource Limits
Edit `deployment/postgres-statefulset.yaml` and update resources:

```yaml
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 2Gi
```

Then apply:
```bash
kubectl apply -f deployment/postgres-statefulset.yaml
```

### Adjust Storage Size
Edit `deployment/postgres-statefulset.yaml` and update volumeClaimTemplates:

```yaml
volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      resources:
        requests:
          storage: 100Gi  # Increase from 50Gi
```

Then apply:
```bash
kubectl apply -f deployment/postgres-statefulset.yaml
```

## Backup and Recovery

### Manual Backup
```bash
# Create backup
kubectl exec -it postgres-0 -n fitquest -- \
  pg_dumpall -U postgres | gzip > postgres_backup.sql.gz

# Verify backup
gunzip -t postgres_backup.sql.gz
```

### Restore from Backup
```bash
# Restore to new database
gunzip postgres_backup.sql.gz
kubectl exec -i postgres-0 -n fitquest -- \
  psql -U postgres < postgres_backup.sql
```

### Check Automated Backups
```bash
# List backup jobs
kubectl get jobs -n fitquest -l app=postgres

# Check backup job logs
kubectl logs -n fitquest job/postgres-backup-xxx

# Check backup storage
kubectl exec -it postgres-0 -n fitquest -- \
  ls -lh /backups/
```

## Monitoring Setup

### Port Forward to Prometheus
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090
```

### Port Forward to Grafana
```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Visit http://localhost:3000
```

### View PostgreSQL Metrics
```bash
# Query Prometheus for PostgreSQL metrics
curl 'http://localhost:9090/api/v1/query?query=pg_stat_activity_count'
```

## Troubleshooting

### Pods Not Starting
```bash
# Check pod events
kubectl describe pod postgres-0 -n fitquest

# Check pod logs
kubectl logs postgres-0 -n fitquest -c postgres
kubectl logs postgres-0 -n fitquest -c postgres-exporter

# Check storage
kubectl get pvc -n fitquest
kubectl describe pvc postgres-storage-postgres-0 -n fitquest
```

### Replication Not Working
```bash
# Check replication status
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_stat_replication;"

# Check WAL archiving
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SHOW archive_mode;"

# Check replication slots
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c \
  "SELECT * FROM pg_replication_slots;"
```

### Connection Issues
```bash
# Test connectivity from pod
kubectl run -it --rm debug --image=postgres:14-alpine --restart=Never -- \
  psql -h postgres.fitquest.svc.cluster.local -U postgres -c "SELECT 1;"

# Check NetworkPolicy
kubectl get networkpolicy -n fitquest postgres
kubectl describe networkpolicy postgres -n fitquest

# Check DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup postgres.fitquest.svc.cluster.local
```

## Cleanup

### Remove PostgreSQL Deployment
```bash
# Delete all resources
kubectl delete -f deployment/

# Delete namespace
kubectl delete namespace fitquest

# Delete persistent volumes (if not auto-deleted)
kubectl get pv | grep postgres
kubectl delete pv <pv-name>
```

## Next Steps

1. Configure microservices to use PostgreSQL
2. Set up monitoring dashboards in Grafana
3. Test backup and recovery procedures
4. Configure automated failover (optional)
5. Optimize PostgreSQL settings based on workload
6. Set up log aggregation (optional)

## Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review PostgreSQL logs: `kubectl logs -n fitquest postgres-0`
3. Check Kubernetes events: `kubectl describe pod postgres-0 -n fitquest`
4. Consult PostgreSQL documentation: https://www.postgresql.org/docs/
