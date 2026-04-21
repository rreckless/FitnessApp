# PostgreSQL Deployment Checklist

## Pre-Deployment

- [ ] Kubernetes cluster is running and accessible
- [ ] kubectl is configured and connected to cluster
- [ ] Storage class "standard" is available
- [ ] At least 150GB total storage available
- [ ] 3+ worker nodes available (for pod anti-affinity)
- [ ] Namespace "fitquest" exists or will be created
- [ ] Review and update passwords in `postgres-secret.yaml`

## Deployment

- [ ] Run setup script: `./scripts/setup-postgres.sh`
- [ ] Wait for all pods to be ready (3-5 minutes)
- [ ] Verify deployment: `./scripts/verify-postgres.sh`
- [ ] Check pod status: `kubectl get pods -n fitquest -l app=postgres`
- [ ] Check services: `kubectl get svc -n fitquest -l app=postgres`
- [ ] Check storage: `kubectl get pvc -n fitquest -l app=postgres`

## Verification

- [ ] All 3 PostgreSQL pods are running
- [ ] All 3 pods have 2/2 containers ready
- [ ] Services are created and have endpoints
- [ ] PVCs are bound to PVs
- [ ] Can connect to primary: `kubectl exec -it postgres-0 -n fitquest -- psql -U postgres`
- [ ] Replication is working: Check `pg_stat_replication`
- [ ] Shared databases exist: users, exercises, achievements
- [ ] Backup storage is available

## Configuration

- [ ] Update PostgreSQL passwords in secrets
- [ ] Configure microservices with connection strings
- [ ] Update connection strings in application configs
- [ ] Test connectivity from microservices

## Monitoring Setup

- [ ] Prometheus is installed and running
- [ ] ServiceMonitor is deployed
- [ ] PrometheusRule is deployed
- [ ] Prometheus is scraping PostgreSQL metrics
- [ ] Grafana dashboards are configured
- [ ] Alert rules are active

## Backup Verification

- [ ] Backup CronJob is created
- [ ] Backup storage PVC is bound
- [ ] Manual backup test: `pg_dumpall | gzip > test_backup.sql.gz`
- [ ] Backup restore test (optional)
- [ ] Backup retention policy is configured (30 days)

## Security

- [ ] RBAC is configured
- [ ] NetworkPolicy is deployed
- [ ] Secrets are encrypted at rest (if enabled)
- [ ] Passwords are rotated regularly
- [ ] pg_hba.conf is configured correctly
- [ ] Replication user has limited privileges

## Performance Tuning

- [ ] PostgreSQL settings are optimized for workload
- [ ] Resource requests/limits are appropriate
- [ ] Indexes are created on frequently queried columns
- [ ] Table statistics are up to date
- [ ] Autovacuum is configured

## Operational Readiness

- [ ] Monitoring dashboards are accessible
- [ ] Alert rules are configured
- [ ] Backup procedures are documented
- [ ] Recovery procedures are documented
- [ ] Troubleshooting guide is available
- [ ] On-call runbook is prepared

## Post-Deployment

- [ ] Document connection strings for microservices
- [ ] Document backup procedures
- [ ] Document recovery procedures
- [ ] Document monitoring dashboards
- [ ] Document troubleshooting steps
- [ ] Train team on operational procedures

## Maintenance Schedule

- [ ] Daily: Monitor backup completion
- [ ] Hourly: Check replication lag
- [ ] Weekly: Review slow query logs
- [ ] Weekly: Analyze table statistics
- [ ] Monthly: Review storage usage
- [ ] Quarterly: Test backup recovery
- [ ] Annually: Review and optimize PostgreSQL settings

## Rollback Plan

- [ ] Document current configuration
- [ ] Document backup procedures
- [ ] Document rollback procedures
- [ ] Test rollback procedure (optional)
- [ ] Prepare rollback runbook

## Sign-Off

- [ ] Infrastructure team: _______________
- [ ] Database team: _______________
- [ ] Operations team: _______________
- [ ] Date: _______________

## Notes

```
[Add any additional notes or observations here]
```
