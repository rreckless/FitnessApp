# FitQuest Monitoring Stack Troubleshooting Guide

This guide provides solutions for common issues with the monitoring stack.

## Common Issues

### Prometheus

#### Issue: Prometheus pod not starting

**Symptoms:**
- Pod stuck in CrashLoopBackOff
- Logs show configuration errors

**Solution:**
1. Check pod logs:
```bash
kubectl logs -n monitoring deployment/prometheus
```

2. Verify ConfigMap is valid:
```bash
kubectl get configmap prometheus-config -n monitoring -o yaml
```

3. Check RBAC permissions:
```bash
kubectl get clusterrole prometheus
kubectl get clusterrolebinding prometheus
```

4. Restart Prometheus:
```bash
kubectl rollout restart deployment/prometheus -n monitoring
```

#### Issue: Prometheus not scraping metrics

**Symptoms:**
- No targets in Prometheus UI
- Metrics not appearing in dashboards

**Solution:**
1. Check Prometheus targets:
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/targets
```

2. Verify service discovery:
```bash
kubectl get pods -n fitquest -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
```

3. Check pod annotations:
```bash
kubectl get pods -n fitquest -o jsonpath='{range .items[*]}{.metadata.annotations.prometheus\.io/scrape}{"\n"}{end}'
```

4. Verify metrics endpoint:
```bash
kubectl port-forward -n fitquest svc/<service-name> 8080:8080
curl http://localhost:8080/metrics
```

#### Issue: Prometheus storage full

**Symptoms:**
- Prometheus pod evicted
- "No space left on device" errors

**Solution:**
1. Check PVC usage:
```bash
kubectl get pvc -n monitoring
kubectl describe pvc prometheus-storage -n monitoring
```

2. Increase PVC size:
```bash
kubectl patch pvc prometheus-storage -n monitoring -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
```

3. Reduce retention period:
```bash
kubectl set env deployment/prometheus -n monitoring PROMETHEUS_RETENTION_TIME=7d
```

### Grafana

#### Issue: Grafana pod not starting

**Symptoms:**
- Pod stuck in CrashLoopBackOff
- Cannot access Grafana UI

**Solution:**
1. Check pod logs:
```bash
kubectl logs -n monitoring deployment/grafana
```

2. Check storage:
```bash
kubectl get pvc -n monitoring grafana-storage
```

3. Reset Grafana database:
```bash
kubectl exec -n monitoring deployment/grafana -- rm /var/lib/grafana/grafana.db
kubectl rollout restart deployment/grafana -n monitoring
```

#### Issue: Grafana dashboards not loading

**Symptoms:**
- Dashboards appear empty
- "No data" message in panels

**Solution:**
1. Verify Prometheus data source:
   - Go to Grafana Settings > Data Sources
   - Click Prometheus
   - Click "Test" button
   - Should show "Data source is working"

2. Check Prometheus connectivity:
```bash
kubectl exec -n monitoring deployment/grafana -- curl http://prometheus:9090/api/v1/query?query=up
```

3. Verify dashboard queries:
   - Edit dashboard
   - Check each panel's query
   - Run query in Prometheus UI

#### Issue: Cannot login to Grafana

**Symptoms:**
- "Invalid username or password" error
- Locked out of admin account

**Solution:**
1. Reset admin password:
```bash
kubectl exec -n monitoring deployment/grafana -- grafana-cli admin reset-admin-password newpassword
```

2. Or delete and recreate secret:
```bash
kubectl delete secret grafana-admin -n monitoring
kubectl create secret generic grafana-admin -n monitoring --from-literal=password=newpassword
kubectl rollout restart deployment/grafana -n monitoring
```

### Jaeger

#### Issue: Jaeger pod not starting

**Symptoms:**
- Pod stuck in CrashLoopBackOff
- Cannot access Jaeger UI

**Solution:**
1. Check pod logs:
```bash
kubectl logs -n monitoring deployment/jaeger
```

2. Verify configuration:
```bash
kubectl get configmap jaeger-config -n monitoring -o yaml
```

3. Restart Jaeger:
```bash
kubectl rollout restart deployment/jaeger -n monitoring
```

#### Issue: No traces appearing in Jaeger

**Symptoms:**
- Jaeger UI shows no services
- No traces in search

**Solution:**
1. Verify microservices are sending traces:
```bash
kubectl logs -n fitquest deployment/<service-name> | grep -i jaeger
```

2. Check Jaeger collector is accessible:
```bash
kubectl port-forward -n monitoring svc/jaeger-collector 14268:14268
curl http://localhost:14268/
```

3. Verify trace sampling configuration:
```bash
kubectl get configmap jaeger-config -n monitoring -o yaml
```

4. Increase sampling rate:
```bash
kubectl edit configmap jaeger-config -n monitoring
# Change "param": 0.1 to "param": 1.0 for 100% sampling
kubectl rollout restart deployment/jaeger -n monitoring
```

### Loki

#### Issue: Loki pod not starting

**Symptoms:**
- Pod stuck in CrashLoopBackOff
- Cannot access Loki

**Solution:**
1. Check pod logs:
```bash
kubectl logs -n monitoring deployment/loki
```

2. Verify storage:
```bash
kubectl get pvc -n monitoring loki-storage
```

3. Check configuration:
```bash
kubectl get configmap loki-config -n monitoring -o yaml
```

4. Restart Loki:
```bash
kubectl rollout restart deployment/loki -n monitoring
```

#### Issue: No logs appearing in Loki

**Symptoms:**
- Loki shows no data
- Cannot query logs

**Solution:**
1. Deploy Promtail to collect logs:
```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:latest
        args:
          - -config.file=/etc/promtail/config.yml
        volumeMounts:
        - name: config
          mountPath: /etc/promtail
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: promtail-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
EOF
```

2. Verify Promtail is running:
```bash
kubectl get pods -n monitoring -l app=promtail
```

3. Check Promtail logs:
```bash
kubectl logs -n monitoring -l app=promtail
```

### Alertmanager

#### Issue: Alertmanager pod not starting

**Symptoms:**
- Pod stuck in CrashLoopBackOff
- Cannot access Alertmanager UI

**Solution:**
1. Check pod logs:
```bash
kubectl logs -n monitoring deployment/alertmanager
```

2. Verify configuration:
```bash
kubectl get configmap alertmanager-config -n monitoring -o yaml
```

3. Restart Alertmanager:
```bash
kubectl rollout restart deployment/alertmanager -n monitoring
```

#### Issue: Alerts not firing

**Symptoms:**
- Alert rules defined but not triggering
- No notifications received

**Solution:**
1. Verify alert rules are loaded:
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/alerts
```

2. Check Prometheus logs:
```bash
kubectl logs -n monitoring deployment/prometheus | grep -i alert
```

3. Verify Alertmanager is connected:
```bash
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# Open http://localhost:9093
```

4. Check alert routing:
```bash
kubectl get configmap alertmanager-config -n monitoring -o yaml
```

#### Issue: Notifications not being sent

**Symptoms:**
- Alerts firing but no Slack/PagerDuty messages
- Alertmanager shows alerts but no notifications

**Solution:**
1. Verify webhook URLs are configured:
```bash
kubectl get secret alertmanager-secrets -n monitoring -o yaml
```

2. Test webhook URL manually:
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_SLACK_WEBHOOK_URL
```

3. Check Alertmanager logs:
```bash
kubectl logs -n monitoring deployment/alertmanager
```

4. Verify network connectivity:
```bash
kubectl exec -n monitoring deployment/alertmanager -- curl -v https://hooks.slack.com/
```

## Performance Issues

### High Memory Usage

**Solution:**
1. Check memory usage:
```bash
kubectl top pods -n monitoring
```

2. Reduce retention period:
```bash
kubectl set env deployment/prometheus -n monitoring PROMETHEUS_RETENTION_TIME=7d
```

3. Increase memory limits:
```bash
kubectl set resources deployment/prometheus -n monitoring --limits=memory=4Gi
```

### High CPU Usage

**Solution:**
1. Check CPU usage:
```bash
kubectl top pods -n monitoring
```

2. Reduce scrape frequency:
```bash
kubectl edit configmap prometheus-config -n monitoring
# Change scrape_interval from 15s to 30s
```

3. Increase CPU limits:
```bash
kubectl set resources deployment/prometheus -n monitoring --limits=cpu=4000m
```

## Debugging Commands

### Check all monitoring resources:
```bash
kubectl get all -n monitoring
```

### Check resource usage:
```bash
kubectl top pods -n monitoring
kubectl top nodes
```

### Check events:
```bash
kubectl get events -n monitoring --sort-by='.lastTimestamp'
```

### Check logs:
```bash
kubectl logs -n monitoring deployment/prometheus
kubectl logs -n monitoring deployment/grafana
kubectl logs -n monitoring deployment/jaeger
kubectl logs -n monitoring deployment/loki
kubectl logs -n monitoring deployment/alertmanager
```

### Describe resources:
```bash
kubectl describe deployment prometheus -n monitoring
kubectl describe pvc prometheus-storage -n monitoring
```

### Port forward for debugging:
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
kubectl port-forward -n monitoring svc/grafana 3000:3000
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
kubectl port-forward -n monitoring svc/loki 3100:3100
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
```

## Getting Help

If you encounter issues not covered here:

1. Check Kubernetes events:
```bash
kubectl describe pod <pod-name> -n monitoring
```

2. Check application logs:
```bash
kubectl logs <pod-name> -n monitoring
```

3. Check resource limits:
```bash
kubectl describe node
```

4. Consult official documentation:
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Jaeger Docs](https://www.jaegertracing.io/docs/)
- [Loki Docs](https://grafana.com/docs/loki/)
