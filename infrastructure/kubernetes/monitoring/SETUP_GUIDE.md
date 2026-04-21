# FitQuest Monitoring Stack Setup Guide

This guide provides detailed instructions for setting up and configuring the FitQuest monitoring and observability stack.

## Prerequisites

- Kubernetes cluster (1.24+) with monitoring namespace created
- kubectl configured and authenticated
- 50+ CPU and 100Gi memory available in monitoring namespace
- Bash shell for running deployment scripts

## Step 1: Create Monitoring Namespace

If not already created, create the monitoring namespace:

```bash
kubectl create namespace monitoring
```

Verify the namespace was created:

```bash
kubectl get namespace monitoring
```

## Step 2: Deploy Monitoring Stack

Navigate to the monitoring directory:

```bash
cd infrastructure/kubernetes/monitoring
```

Make the deployment script executable:

```bash
chmod +x deploy-monitoring-stack.sh
chmod +x verify-monitoring-stack.sh
```

Deploy the monitoring stack:

```bash
./deploy-monitoring-stack.sh
```

This script will:
1. Deploy Prometheus with RBAC and configuration
2. Deploy Grafana with pre-configured dashboards
3. Deploy Jaeger for distributed tracing
4. Deploy Loki for centralized logging
5. Deploy Alertmanager for alert routing
6. Wait for all deployments to be ready

## Step 3: Verify Deployment

Verify the monitoring stack is running:

```bash
./verify-monitoring-stack.sh
```

This script will check:
- All deployments are ready
- All services are available
- All pods are running
- All persistent volumes are bound
- Resource usage

## Step 4: Access Monitoring Services

### Grafana

Access Grafana for visualization and dashboards:

```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
```

Open http://localhost:3000 in your browser.

**Default credentials:**
- Username: admin
- Password: admin

**Important:** Change the admin password on first login.

### Prometheus

Access Prometheus for metrics queries:

```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

Open http://localhost:9090 in your browser.

### Jaeger

Access Jaeger for distributed tracing:

```bash
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
```

Open http://localhost:16686 in your browser.

### Loki

Access Loki for log queries:

```bash
kubectl port-forward -n monitoring svc/loki 3100:3100
```

Open http://localhost:3100 in your browser.

### Alertmanager

Access Alertmanager for alert management:

```bash
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
```

Open http://localhost:9093 in your browser.

## Step 5: Configure Alerting

### Configure Slack Integration

1. Create a Slack webhook URL:
   - Go to https://api.slack.com/apps
   - Create a new app or select existing app
   - Enable Incoming Webhooks
   - Create a new webhook for your channel
   - Copy the webhook URL

2. Update the Alertmanager secret:

```bash
kubectl patch secret alertmanager-secrets -n monitoring \
  -p '{"data":{"slack-webhook-url":"'$(echo -n "YOUR_SLACK_WEBHOOK_URL" | base64)'"}}'
```

3. Restart Alertmanager:

```bash
kubectl rollout restart deployment/alertmanager -n monitoring
```

### Configure PagerDuty Integration

1. Get your PagerDuty service key:
   - Go to https://www.pagerduty.com
   - Navigate to Services
   - Select your service
   - Copy the Integration Key

2. Update the Alertmanager secret:

```bash
kubectl patch secret alertmanager-secrets -n monitoring \
  -p '{"data":{"pagerduty-service-key":"'$(echo -n "YOUR_PAGERDUTY_SERVICE_KEY" | base64)'"}}'
```

3. Restart Alertmanager:

```bash
kubectl rollout restart deployment/alertmanager -n monitoring
```

## Step 6: Configure Prometheus Scraping

Prometheus automatically discovers and scrapes metrics from:
- Kubernetes API server
- Kubernetes nodes
- Kubernetes pods with `prometheus.io/scrape: "true"` annotation
- FitQuest microservices
- RabbitMQ
- Redis
- PostgreSQL

To enable metrics scraping for your services, add these annotations to your pod spec:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"
```

## Step 7: Create Custom Dashboards

1. Access Grafana at http://localhost:3000
2. Click "+" in the left sidebar
3. Select "Dashboard"
4. Add panels with Prometheus queries
5. Save the dashboard

Example queries:

**Service availability:**
```promql
up{job=~"fitquest-services"}
```

**Request rate:**
```promql
rate(http_requests_total{job=~"fitquest-services"}[5m])
```

**Error rate:**
```promql
rate(http_requests_total{status=~"5..",job=~"fitquest-services"}[5m])
```

**Latency (p95):**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=~"fitquest-services"}[5m]))
```

## Step 8: Configure Alert Rules

Alert rules are defined in `rules/prometheus-rules.yaml`. To modify alert rules:

1. Edit `rules/prometheus-rules.yaml`
2. Update the ConfigMap:

```bash
kubectl apply -f rules/prometheus-rules.yaml
```

3. Prometheus will automatically reload the rules

## Step 9: Monitor Microservices

To monitor your FitQuest microservices:

1. Ensure microservices expose metrics on port 8080 at `/metrics`
2. Add Prometheus annotations to microservice pod specs
3. Verify metrics are being scraped in Prometheus UI
4. Create dashboards in Grafana to visualize metrics

## Step 10: Set Up Log Aggregation

To aggregate logs from microservices:

1. Configure your microservices to output JSON logs
2. Deploy Promtail to collect logs:

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

3. Create Promtail configuration:

```bash
kubectl create configmap promtail-config -n monitoring \
  --from-literal=config.yml='
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
'
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Next Steps

1. Configure alerting integrations (Slack, PagerDuty)
2. Create custom dashboards for your services
3. Set up log aggregation with Promtail
4. Configure backup and retention policies
5. Set up high availability for production

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
