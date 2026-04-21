# FitQuest Monitoring and Observability Stack

This directory contains all Kubernetes configuration files for deploying the monitoring and observability stack for FitQuest microservices.

## Overview

The monitoring stack provides comprehensive observability for all FitQuest services:
- **Prometheus**: Metrics collection and time-series database
- **Grafana**: Visualization and dashboards
- **Jaeger**: Distributed tracing
- **Loki**: Centralized logging
- **Alertmanager**: Alert routing and management
- **PrometheusRule**: Alert definitions and rules

## Quick Start

### Prerequisites
- Kubernetes cluster with monitoring namespace created
- kubectl configured and authenticated
- 50+ CPU and 100Gi memory available in monitoring namespace

### 1. Deploy Monitoring Stack

```bash
./deploy-monitoring-stack.sh
```

### 2. Verify Deployment

```bash
./verify-monitoring-stack.sh
```

### 3. Access Monitoring Services

#### Grafana
```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Access at http://localhost:3000
# Default credentials: admin / admin
```

#### Prometheus
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access at http://localhost:9090
```

#### Jaeger
```bash
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
# Access at http://localhost:16686
```

#### Loki
```bash
kubectl port-forward -n monitoring svc/loki 3100:3100
# Access at http://localhost:3100
```

## Directory Structure

```
monitoring/
├── README.md                          # This file
├── SETUP_GUIDE.md                     # Detailed setup guide
├── TROUBLESHOOTING.md                 # Common issues and solutions
├── deploy-monitoring-stack.sh         # Deployment script
├── verify-monitoring-stack.sh         # Verification script
├── prometheus/
│   ├── deployment.yaml                # Prometheus deployment
│   ├── service.yaml                   # Prometheus service
│   ├── configmap.yaml                 # Prometheus configuration
│   ├── rbac.yaml                      # RBAC for Prometheus
│   └── servicemonitor.yaml            # ServiceMonitor for scraping
├── grafana/
│   ├── deployment.yaml                # Grafana deployment
│   ├── service.yaml                   # Grafana service
│   ├── configmap.yaml                 # Grafana configuration
│   └── dashboards/
│       ├── service-health.json        # Service health dashboard
│       ├── request-latency.json       # Request latency dashboard
│       ├── error-rates.json           # Error rates dashboard
│       ├── database-performance.json  # Database performance dashboard
│       ├── cache-metrics.json         # Cache hit rates dashboard
│       └── message-queue.json         # Message queue depth dashboard
├── jaeger/
│   ├── deployment.yaml                # Jaeger deployment
│   ├── service.yaml                   # Jaeger service
│   └── configmap.yaml                 # Jaeger configuration
├── loki/
│   ├── deployment.yaml                # Loki deployment
│   ├── service.yaml                   # Loki service
│   └── configmap.yaml                 # Loki configuration
├── alertmanager/
│   ├── deployment.yaml                # Alertmanager deployment
│   ├── service.yaml                   # Alertmanager service
│   └── configmap.yaml                 # Alertmanager configuration
└── rules/
    └── prometheus-rules.yaml          # PrometheusRule for alerts
```

## Components

### Prometheus
- **Purpose**: Metrics collection and time-series database
- **Replicas**: 2 for HA
- **Storage**: 50Gi persistent volume
- **Scrape Interval**: 15 seconds
- **Retention**: 30 days
- **Service Discovery**: Kubernetes API

### Grafana
- **Purpose**: Visualization and dashboards
- **Replicas**: 2 for HA
- **Storage**: 10Gi persistent volume
- **Dashboards**: 6 pre-configured dashboards
- **Data Sources**: Prometheus, Loki
- **Default Credentials**: admin / admin (change on first login)

### Jaeger
- **Purpose**: Distributed tracing
- **Replicas**: 2 for HA
- **Storage**: In-memory (can be configured for persistent storage)
- **Sampling**: 10% trace sampling
- **Query Port**: 16686
- **Collector Port**: 14268

### Loki
- **Purpose**: Centralized logging
- **Replicas**: 2 for HA
- **Storage**: 50Gi persistent volume
- **Retention**: 30 days
- **Query Port**: 3100
- **Log Format**: JSON

### Alertmanager
- **Purpose**: Alert routing and management
- **Replicas**: 2 for HA
- **Receivers**: PagerDuty, Slack, Email (configurable)
- **Grouping**: By alertname and service
- **Inhibition**: Prevents duplicate alerts

## Alert Rules

The following alert rules are configured:

### Service Health
- **High Error Rate**: Error rate > 1% for 5 minutes
- **Service Unavailable**: Service down for 2 minutes
- **High Latency**: p99 latency > 1 second for 5 minutes

### Database
- **Slow Queries**: Query duration > 1 second for 5 minutes
- **Connection Pool Exhaustion**: Available connections < 5 for 2 minutes
- **High Lock Contention**: Lock wait time > 100ms for 5 minutes

### Message Queue
- **Queue Depth**: Message queue depth > 10,000 for 5 minutes
- **Consumer Lag**: Consumer lag > 1,000 messages for 5 minutes
- **Dead Letter Queue**: Messages in DLQ > 100 for 2 minutes

### Infrastructure
- **High Memory Usage**: Memory usage > 90% for 5 minutes
- **High CPU Usage**: CPU usage > 90% for 5 minutes
- **Disk Space Low**: Available disk < 10% for 5 minutes

## Dashboards

### Service Health and Uptime
- Service availability percentage
- Service response times
- Service error rates
- Service request volume

### Request Latency
- p50, p95, p99 latency by service
- Latency trends over time
- Latency distribution

### Error Rates
- Error rate by service
- Error types and counts
- Error rate trends

### Database Performance
- Query execution time
- Query count by type
- Connection pool usage
- Lock contention

### Cache Hit Rates
- Cache hit ratio by service
- Cache eviction rate
- Cache memory usage

### Message Queue Depth
- Queue depth by exchange
- Consumer lag by queue
- Dead letter queue depth

## Configuration

### Prometheus Configuration
- **Scrape Targets**: All services in fitquest namespace
- **Service Discovery**: Kubernetes API
- **Scrape Interval**: 15 seconds
- **Evaluation Interval**: 15 seconds
- **Retention**: 30 days

### Grafana Configuration
- **Data Sources**: Prometheus, Loki
- **Dashboards**: 6 pre-configured dashboards
- **Authentication**: Admin user (change password on first login)
- **Provisioning**: Automatic dashboard provisioning

### Jaeger Configuration
- **Sampling**: 10% trace sampling
- **Storage**: In-memory (configurable)
- **Query Port**: 16686
- **Collector Port**: 14268

### Loki Configuration
- **Retention**: 30 days
- **Storage**: 50Gi persistent volume
- **Query Port**: 3100
- **Log Format**: JSON

### Alertmanager Configuration
- **Receivers**: PagerDuty, Slack, Email (configurable)
- **Grouping**: By alertname and service
- **Inhibition**: Prevents duplicate alerts
- **Routing**: Based on alert labels

## Accessing Services

### Grafana
```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Access at http://localhost:3000
# Default credentials: admin / admin
```

### Prometheus
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access at http://localhost:9090
```

### Jaeger
```bash
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
# Access at http://localhost:16686
```

### Loki
```bash
kubectl port-forward -n monitoring svc/loki 3100:3100
# Access at http://localhost:3100
```

### Alertmanager
```bash
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# Access at http://localhost:9093
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Next Steps

1. **Deploy monitoring stack**: `./deploy-monitoring-stack.sh`
2. **Verify deployment**: `./verify-monitoring-stack.sh`
3. **Access Grafana**: `kubectl port-forward -n monitoring svc/grafana 3000:3000`
4. **Configure PagerDuty**: Update alertmanager configmap with PagerDuty integration key
5. **Create custom dashboards**: Use Grafana UI to create additional dashboards

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
