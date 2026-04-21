# FitQuest Infrastructure Checkpoint - Issues and Remediation Guide

## Overview

This guide documents common issues found during infrastructure checkpoint verification and their remediation steps.

## Issue Categories

1. **Cluster Issues** - Kubernetes cluster health and configuration
2. **API Gateway Issues** - Nginx Ingress deployment and routing
3. **Message Queue Issues** - RabbitMQ cluster and connectivity
4. **Cache Issues** - Redis cluster and replication
5. **Database Issues** - PostgreSQL deployment and replication
6. **Monitoring Issues** - Prometheus, Grafana, Jaeger, Loki, Alertmanager
7. **Networking Issues** - Service discovery and routing

---

## 1. Cluster Issues

### Issue 1.1: Nodes Not Ready

**Symptoms:**
- `kubectl get nodes` shows nodes in NotReady state
- Pods cannot be scheduled
- Cluster operations fail

**Root Causes:**
- Node resource exhaustion (CPU, memory, disk)
- Network connectivity issues
- Kubelet service not running
- Container runtime issues

**Remediation Steps:**

```bash
# Check node status
kubectl get nodes -o wide

# Describe problematic node
kubectl describe node <node-name>

# Check node conditions
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, conditions: .status.conditions}'

# Check kubelet logs
ssh <node-ip>
journalctl -u kubelet -n 50

# Check disk space
df -h

# Check memory
free -h

# Restart kubelet if needed
sudo systemctl restart kubelet

# Drain and uncordon node
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node-name>
```

**Prevention:**
- Monitor node resources regularly
- Set resource requests and limits on pods
- Configure cluster autoscaling
- Implement node maintenance windows

---

### Issue 1.2: API Server Not Responding

**Symptoms:**
- kubectl commands timeout
- `kubectl cluster-info` fails
- API server pods in CrashLoopBackOff

**Root Causes:**
- API server pod crashed
- etcd connectivity issues
- Resource exhaustion
- Network issues

**Remediation Steps:**

```bash
# Check API server pods
kubectl get pods -n kube-system -l component=kube-apiserver

# Check API server logs
kubectl logs -n kube-system -l component=kube-apiserver

# Check etcd status
kubectl get pods -n kube-system -l component=etcd

# Check etcd logs
kubectl logs -n kube-system -l component=etcd

# Verify API server is listening
netstat -tlnp | grep 6443

# Restart API server (if using kubeadm)
sudo systemctl restart kubelet
```

**Prevention:**
- Monitor API server metrics
- Set resource requests for API server
- Implement API server HA
- Regular etcd backups

---

### Issue 1.3: DNS Not Working

**Symptoms:**
- Pods cannot resolve service names
- DNS queries timeout
- CoreDNS pods not running

**Root Causes:**
- CoreDNS pods crashed
- DNS service not configured
- Network policies blocking DNS
- Resource exhaustion

**Remediation Steps:**

```bash
# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns

# Check DNS service
kubectl get svc -n kube-system kube-dns

# Test DNS from pod
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default

# Check DNS configuration
kubectl get configmap -n kube-system coredns -o yaml

# Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system
```

**Prevention:**
- Monitor CoreDNS metrics
- Set resource requests for CoreDNS
- Implement CoreDNS HA
- Regular DNS testing

---

### Issue 1.4: Persistent Volume Claims Not Binding

**Symptoms:**
- PVCs stuck in Pending state
- Pods cannot start due to PVC issues
- Storage provisioning fails

**Root Causes:**
- Storage class not available
- Storage provisioner not running
- Insufficient storage capacity
- Storage class misconfiguration

**Remediation Steps:**

```bash
# Check storage classes
kubectl get storageclass

# Check PVC status
kubectl get pvc -n <namespace>

# Describe PVC for events
kubectl describe pvc <pvc-name> -n <namespace>

# Check storage provisioner logs
kubectl logs -n kube-system -l app=<provisioner-name>

# Check available storage
kubectl get pv

# Create storage class if missing
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: <provisioner-name>
parameters:
  type: gp2
EOF

# Delete and recreate PVC if needed
kubectl delete pvc <pvc-name> -n <namespace>
kubectl apply -f <pvc-manifest>
```

**Prevention:**
- Verify storage class before deployment
- Monitor storage capacity
- Set storage quotas
- Regular storage cleanup

---

## 2. API Gateway Issues

### Issue 2.1: LoadBalancer External Endpoint Not Assigned

**Symptoms:**
- LoadBalancer service shows `<pending>` for external IP
- Cannot access API Gateway from outside cluster
- Ingress not working

**Root Causes:**
- Cloud provider integration not configured
- LoadBalancer controller not running
- Insufficient resources
- Network configuration issues

**Remediation Steps:**

```bash
# Check service status
kubectl get svc -n ingress nginx-ingress-controller

# Check service events
kubectl describe svc nginx-ingress-controller -n ingress

# Check ingress controller logs
kubectl logs -n ingress -l app=nginx-ingress-controller

# Check if LoadBalancer controller is running
kubectl get pods -n kube-system -l app=cloud-controller-manager

# For AWS EKS
aws elb describe-load-balancers

# For Azure AKS
az network lb list

# For GKE
gcloud compute forwarding-rules list

# Manually assign external IP if needed
kubectl patch svc nginx-ingress-controller -n ingress -p '{"spec":{"externalIPs":["<external-ip>"]}}'
```

**Prevention:**
- Verify cloud provider integration before deployment
- Monitor LoadBalancer service status
- Set up DNS records for external IP
- Implement health checks

---

### Issue 2.2: TLS Certificate Issues

**Symptoms:**
- HTTPS connections fail
- Certificate validation errors
- Ingress shows certificate errors

**Root Causes:**
- Certificate not generated
- Certificate expired
- Certificate secret not found
- Certificate misconfiguration

**Remediation Steps:**

```bash
# Check certificate secret
kubectl get secret fitquest-tls -n ingress

# View certificate details
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout

# Check certificate expiration
kubectl get secret fitquest-tls -n ingress -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -enddate

# Generate new certificate
cd infrastructure/kubernetes/api-gateway/scripts
./generate-certificates.sh

# Update secret
kubectl create secret tls fitquest-tls --cert=tls.crt --key=tls.key -n ingress --dry-run=client -o yaml | kubectl apply -f -

# Restart ingress controller
kubectl rollout restart deployment/nginx-ingress-controller -n ingress
```

**Prevention:**
- Set up certificate renewal automation
- Monitor certificate expiration
- Use cert-manager for automatic renewal
- Regular certificate validation

---

### Issue 2.3: Ingress Routes Not Working

**Symptoms:**
- Requests to ingress fail
- 404 errors for valid routes
- Ingress shows no backends

**Root Causes:**
- Ingress resource misconfigured
- Backend services not running
- Service endpoints not configured
- Network policies blocking traffic

**Remediation Steps:**

```bash
# Check ingress resource
kubectl get ingress -n ingress

# Describe ingress for details
kubectl describe ingress fitquest-api-gateway -n ingress

# Check ingress controller logs
kubectl logs -n ingress -l app=nginx-ingress-controller | grep fitquest

# Check backend services
kubectl get svc -n fitquest

# Check service endpoints
kubectl get endpoints -n fitquest

# Test connectivity to backend
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>.<namespace>.svc.cluster.local

# Verify ingress configuration
kubectl get ingress fitquest-api-gateway -n ingress -o yaml

# Recreate ingress if needed
kubectl delete ingress fitquest-api-gateway -n ingress
kubectl apply -f infrastructure/kubernetes/api-gateway/ingress/fitquest-ingress.yaml
```

**Prevention:**
- Validate ingress configuration before deployment
- Monitor ingress status
- Regular connectivity testing
- Implement ingress monitoring

---

## 3. Message Queue Issues

### Issue 3.1: RabbitMQ Pods Not Starting

**Symptoms:**
- RabbitMQ pods in CrashLoopBackOff
- StatefulSet not ready
- Cluster formation fails

**Root Causes:**
- Insufficient resources
- Storage issues
- Configuration errors
- Network connectivity issues

**Remediation Steps:**

```bash
# Check pod status
kubectl get pods -n fitquest -l app=rabbitmq

# Check pod logs
kubectl logs -n fitquest rabbitmq-0

# Check pod events
kubectl describe pod rabbitmq-0 -n fitquest

# Check storage
kubectl get pvc -n fitquest -l app=rabbitmq

# Check resource requests
kubectl get pod rabbitmq-0 -n fitquest -o yaml | grep -A 5 resources

# Check node resources
kubectl top nodes

# Increase resource limits if needed
kubectl set resources statefulset rabbitmq -n fitquest --limits=cpu=2,memory=2Gi --requests=cpu=1,memory=1Gi

# Delete and recreate if necessary
kubectl delete statefulset rabbitmq -n fitquest
kubectl apply -f infrastructure/kubernetes/message-queue/deployment/rabbitmq-statefulset.yaml
```

**Prevention:**
- Verify resource availability before deployment
- Monitor pod resource usage
- Set appropriate resource requests and limits
- Regular pod health checks

---

### Issue 3.2: RabbitMQ Cluster Not Forming

**Symptoms:**
- Cluster status shows disconnected nodes
- Exchanges and queues not created
- Message routing fails

**Root Causes:**
- Network connectivity issues
- DNS resolution problems
- Erlang cookie mismatch
- Node initialization issues

**Remediation Steps:**

```bash
# Check cluster status
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl cluster_status

# Check node connectivity
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl eval 'nodes().'

# Check Erlang cookie
kubectl exec -n fitquest rabbitmq-0 -- cat /var/lib/rabbitmq/.erlang.cookie

# Verify DNS resolution
kubectl exec -n fitquest rabbitmq-0 -- nslookup rabbitmq-0.rabbitmq.fitquest.svc.cluster.local

# Reset cluster if needed
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl reset

# Restart cluster formation
kubectl delete pod rabbitmq-0 -n fitquest
kubectl delete pod rabbitmq-1 -n fitquest
kubectl delete pod rabbitmq-2 -n fitquest

# Wait for pods to restart and cluster to reform
kubectl wait --for=condition=ready pod -l app=rabbitmq -n fitquest --timeout=300s
```

**Prevention:**
- Verify network connectivity before deployment
- Monitor cluster status regularly
- Implement cluster health checks
- Regular cluster testing

---

### Issue 3.3: Exchanges and Queues Not Created

**Symptoms:**
- Expected exchanges not present
- Queues not created
- Message routing fails

**Root Causes:**
- Initialization script not run
- RabbitMQ not fully started
- Configuration errors
- Permission issues

**Remediation Steps:**

```bash
# Check existing exchanges
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_exchanges

# Check existing queues
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl list_queues

# Create exchanges manually
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl declare_exchange fitquest.events.workout topic durable

# Create queues manually
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl declare_queue xp-service-workout-completed durable

# Bind queue to exchange
kubectl exec -n fitquest rabbitmq-0 -- rabbitmqctl bind_queue xp-service-workout-completed fitquest.events.workout "workout.completed"

# Run initialization script
kubectl exec -n fitquest rabbitmq-0 -- bash /scripts/init-rabbitmq.sh

# Check RabbitMQ logs
kubectl logs -n fitquest rabbitmq-0
```

**Prevention:**
- Verify initialization script runs successfully
- Monitor exchange and queue creation
- Implement configuration validation
- Regular configuration testing

---

## 4. Cache Issues

### Issue 4.1: Redis Pods Not Starting

**Symptoms:**
- Redis pods in CrashLoopBackOff
- StatefulSet not ready
- Replication fails

**Root Causes:**
- Insufficient resources
- Storage issues
- Configuration errors
- Port conflicts

**Remediation Steps:**

```bash
# Check pod status
kubectl get pods -n fitquest -l app=redis-cluster

# Check pod logs
kubectl logs -n fitquest redis-cluster-0

# Check pod events
kubectl describe pod redis-cluster-0 -n fitquest

# Check storage
kubectl get pvc -n fitquest -l app=redis-cluster

# Check resource usage
kubectl top pod redis-cluster-0 -n fitquest

# Increase resource limits if needed
kubectl set resources statefulset redis-cluster -n fitquest --limits=cpu=1,memory=1Gi --requests=cpu=500m,memory=512Mi

# Delete and recreate if necessary
kubectl delete statefulset redis-cluster -n fitquest
kubectl apply -f infrastructure/kubernetes/redis/deployment/redis-statefulset.yaml
```

**Prevention:**
- Verify resource availability before deployment
- Monitor pod resource usage
- Set appropriate resource requests and limits
- Regular pod health checks

---

### Issue 4.2: Redis Replication Not Working

**Symptoms:**
- Replication status shows 0 slaves
- Data not replicated to slaves
- Sentinel failover not working

**Root Causes:**
- Network connectivity issues
- Slave configuration issues
- Master-slave synchronization problems
- Sentinel misconfiguration

**Remediation Steps:**

```bash
# Check replication status
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli info replication

# Check slave status
kubectl exec -it redis-cluster-1 -n fitquest -- redis-cli info replication

# Check network connectivity
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli ping

# Check Sentinel status
kubectl exec -it redis-sentinel-0 -n fitquest -- redis-cli -p 26379 sentinel masters

# Restart replication
kubectl exec -it redis-cluster-0 -n fitquest -- redis-cli slaveof no one
kubectl exec -it redis-cluster-1 -n fitquest -- redis-cli slaveof redis-cluster-0.redis-cluster.fitquest.svc.cluster.local 6379

# Check Sentinel logs
kubectl logs -n fitquest redis-sentinel-0

# Restart Sentinel if needed
kubectl delete pod redis-sentinel-0 -n fitquest
```

**Prevention:**
- Verify network connectivity before deployment
- Monitor replication status regularly
- Implement replication health checks
- Regular replication testing

---

## 5. Database Issues

### Issue 5.1: PostgreSQL Pods Not Starting

**Symptoms:**
- PostgreSQL pods in CrashLoopBackOff
- StatefulSet not ready
- Database not accessible

**Root Causes:**
- Insufficient resources
- Storage issues
- Configuration errors
- Permission issues

**Remediation Steps:**

```bash
# Check pod status
kubectl get pods -n fitquest -l app=postgres

# Check pod logs
kubectl logs -n fitquest postgres-0

# Check pod events
kubectl describe pod postgres-0 -n fitquest

# Check storage
kubectl get pvc -n fitquest -l app=postgres

# Check resource usage
kubectl top pod postgres-0 -n fitquest

# Increase resource limits if needed
kubectl set resources statefulset postgres -n fitquest --limits=cpu=2,memory=4Gi --requests=cpu=1,memory=2Gi

# Delete and recreate if necessary
kubectl delete statefulset postgres -n fitquest
kubectl apply -f infrastructure/kubernetes/database/deployment/postgres-statefulset.yaml
```

**Prevention:**
- Verify resource availability before deployment
- Monitor pod resource usage
- Set appropriate resource requests and limits
- Regular pod health checks

---

### Issue 5.2: PostgreSQL Replication Not Working

**Symptoms:**
- Replication status shows 0 replicas
- Data not replicated to standby
- Failover not working

**Root Causes:**
- Network connectivity issues
- Replication slot issues
- WAL archiving problems
- Standby configuration issues

**Remediation Steps:**

```bash
# Check replication status
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check standby status
kubectl exec -it postgres-1 -n fitquest -- psql -U postgres -c "SELECT pg_is_in_recovery();"

# Check replication slots
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SELECT * FROM pg_replication_slots;"

# Check WAL archiving
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SHOW archive_mode;"

# Restart replication
kubectl exec -it postgres-0 -n fitquest -- psql -U postgres -c "SELECT pg_wal_replay_resume();"

# Check PostgreSQL logs
kubectl logs -n fitquest postgres-0

# Restart PostgreSQL if needed
kubectl delete pod postgres-1 -n fitquest
kubectl delete pod postgres-2 -n fitquest
```

**Prevention:**
- Verify network connectivity before deployment
- Monitor replication status regularly
- Implement replication health checks
- Regular replication testing

---

### Issue 5.3: Database Connectivity Issues

**Symptoms:**
- Cannot connect to database
- Connection timeouts
- Authentication failures

**Root Causes:**
- Service not running
- Network policies blocking access
- Credentials incorrect
- Firewall rules

**Remediation Steps:**

```bash
# Check service status
kubectl get svc -n fitquest postgres

# Check service endpoints
kubectl get endpoints -n fitquest postgres

# Test connectivity from pod
kubectl run -it --rm debug --image=postgres:14-alpine --restart=Never -- psql -h postgres.fitquest.svc.cluster.local -U postgres -d postgres -c "SELECT 1;"

# Check network policies
kubectl get networkpolicy -n fitquest

# Check credentials
kubectl get secret -n fitquest postgres-secret -o yaml

# Check PostgreSQL logs
kubectl logs -n fitquest postgres-0

# Port forward for local testing
kubectl port-forward -n fitquest svc/postgres 5432:5432
psql -h localhost -U postgres -d postgres
```

**Prevention:**
- Verify connectivity before deployment
- Monitor service status regularly
- Implement connectivity health checks
- Regular connectivity testing

---

## 6. Monitoring Issues

### Issue 6.1: Prometheus Not Scraping Targets

**Symptoms:**
- Prometheus shows no targets
- Metrics not being collected
- Grafana dashboards empty

**Root Causes:**
- ServiceMonitors not created
- Prometheus configuration issues
- Target endpoints not responding
- Network policies blocking access

**Remediation Steps:**

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check ServiceMonitors
kubectl get servicemonitor -n monitoring

# Check Prometheus configuration
kubectl get configmap -n monitoring prometheus-config -o yaml

# Check Prometheus logs
kubectl logs -n monitoring -l app=prometheus

# Verify target endpoints
kubectl get endpoints -n fitquest

# Create missing ServiceMonitors
kubectl apply -f infrastructure/kubernetes/monitoring/servicemonitor.yaml

# Restart Prometheus
kubectl rollout restart deployment/prometheus -n monitoring
```

**Prevention:**
- Verify ServiceMonitors before deployment
- Monitor Prometheus targets regularly
- Implement target health checks
- Regular metrics validation

---

### Issue 6.2: Grafana Dashboards Not Loading

**Symptoms:**
- Grafana shows no dashboards
- Dashboard errors
- Data source connection failures

**Root Causes:**
- Data source not configured
- Dashboards not imported
- Prometheus not responding
- Permission issues

**Remediation Steps:**

```bash
# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Visit http://localhost:3000

# Check Grafana logs
kubectl logs -n monitoring -l app=grafana

# Check data sources
kubectl get configmap -n monitoring grafana-datasources -o yaml

# Verify Prometheus connectivity
kubectl exec -it -n monitoring <grafana-pod> -- curl http://prometheus:9090/api/v1/query?query=up

# Import dashboards manually
# 1. Go to Grafana UI
# 2. Click "+" -> "Import"
# 3. Enter dashboard ID or JSON

# Restart Grafana
kubectl rollout restart deployment/grafana -n monitoring
```

**Prevention:**
- Verify data sources before deployment
- Monitor dashboard status regularly
- Implement dashboard health checks
- Regular dashboard validation

---

### Issue 6.3: Jaeger Not Collecting Traces

**Symptoms:**
- Jaeger shows no traces
- Trace collection fails
- Jaeger UI empty

**Root Causes:**
- Jaeger agent not running
- Application not sending traces
- Network connectivity issues
- Configuration errors

**Remediation Steps:**

```bash
# Check Jaeger pods
kubectl get pods -n monitoring -l app=jaeger

# Check Jaeger logs
kubectl logs -n monitoring -l app=jaeger

# Check Jaeger service
kubectl get svc -n monitoring -l app=jaeger

# Verify application is sending traces
# Check application logs for trace errors

# Port forward to Jaeger UI
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
# Visit http://localhost:16686

# Check Jaeger configuration
kubectl get configmap -n monitoring jaeger-config -o yaml

# Restart Jaeger
kubectl rollout restart deployment/jaeger -n monitoring
```

**Prevention:**
- Verify Jaeger configuration before deployment
- Monitor trace collection regularly
- Implement trace health checks
- Regular trace validation

---

### Issue 6.4: Loki Not Collecting Logs

**Symptoms:**
- Loki shows no logs
- Log collection fails
- Grafana Loki datasource empty

**Root Causes:**
- Promtail not running
- Loki not receiving logs
- Network connectivity issues
- Configuration errors

**Remediation Steps:**

```bash
# Check Loki pods
kubectl get pods -n monitoring -l app=loki

# Check Promtail pods
kubectl get pods -n monitoring -l app=promtail

# Check Loki logs
kubectl logs -n monitoring -l app=loki

# Check Promtail logs
kubectl logs -n monitoring -l app=promtail

# Verify Loki service
kubectl get svc -n monitoring loki

# Check Loki configuration
kubectl get configmap -n monitoring loki-config -o yaml

# Test Loki connectivity
kubectl exec -it -n monitoring <loki-pod> -- curl http://localhost:3100/loki/api/v1/labels

# Restart Loki and Promtail
kubectl rollout restart deployment/loki -n monitoring
kubectl rollout restart daemonset/promtail -n monitoring
```

**Prevention:**
- Verify Loki configuration before deployment
- Monitor log collection regularly
- Implement log health checks
- Regular log validation

---

## 7. Networking Issues

### Issue 7.1: Service Discovery Not Working

**Symptoms:**
- Services cannot resolve DNS names
- Pod-to-pod communication fails
- Service endpoints not available

**Root Causes:**
- DNS not working
- Service not created
- Endpoints not configured
- Network policies blocking traffic

**Remediation Steps:**

```bash
# Check service
kubectl get svc -n fitquest <service-name>

# Check endpoints
kubectl get endpoints -n fitquest <service-name>

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service-name>.fitquest.svc.cluster.local

# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>.fitquest.svc.cluster.local

# Check network policies
kubectl get networkpolicy -n fitquest

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Restart CoreDNS if needed
kubectl rollout restart deployment/coredns -n kube-system
```

**Prevention:**
- Verify service creation before deployment
- Monitor service status regularly
- Implement service health checks
- Regular connectivity testing

---

### Issue 7.2: Network Policies Blocking Traffic

**Symptoms:**
- Pod-to-pod communication fails
- Service access denied
- Ingress traffic blocked

**Root Causes:**
- Network policy too restrictive
- Ingress/egress rules misconfigured
- Label selectors incorrect
- Policy order issues

**Remediation Steps:**

```bash
# Check network policies
kubectl get networkpolicy -n fitquest

# Describe network policy
kubectl describe networkpolicy <policy-name> -n fitquest

# Test connectivity with policy disabled
kubectl delete networkpolicy <policy-name> -n fitquest

# Review policy configuration
kubectl get networkpolicy <policy-name> -n fitquest -o yaml

# Fix policy if needed
kubectl apply -f <corrected-policy-yaml>

# Re-enable policy
kubectl apply -f infrastructure/kubernetes/deployments/network-policy.yaml

# Test connectivity again
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>.fitquest.svc.cluster.local
```

**Prevention:**
- Test network policies before deployment
- Monitor policy effectiveness regularly
- Implement policy validation
- Regular connectivity testing

---

## Summary

This guide covers the most common issues found during infrastructure checkpoint verification. For each issue:

1. **Identify** the symptoms
2. **Diagnose** the root cause
3. **Remediate** using provided steps
4. **Prevent** future occurrences

Always:
- Check logs first: `kubectl logs -n <namespace> <pod-name>`
- Describe resources: `kubectl describe <resource-type> <resource-name> -n <namespace>`
- Check events: `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
- Monitor metrics: `kubectl top nodes` and `kubectl top pods`

For additional support, refer to component-specific TROUBLESHOOTING.md files in each infrastructure directory.
