# FitQuest API Gateway Deployment

This directory contains Kubernetes manifests for deploying the FitQuest API Gateway using Nginx Ingress Controller.

## Overview

The API Gateway serves as the single entry point for all FitQuest microservices. It provides:
- **Request Routing**: Routes requests to appropriate microservices
- **Rate Limiting**: Prevents abuse and ensures fair resource usage
- **Request Throttling**: Controls request flow and prevents overload
- **Centralized Authentication**: Validates JWT tokens before routing
- **TLS/SSL Termination**: Encrypts all external communication
- **High Availability**: 3+ replicas for fault tolerance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Clients                         │
│              (Mobile App, Web Clients, etc.)                │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (Nginx)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  TLS/SSL Termination                                 │   │
│  │  Request Routing                                     │   │
│  │  Rate Limiting (per user, per IP)                    │   │
│  │  Request Throttling                                  │   │
│  │  Authentication Validation (JWT)                     │   │
│  │  Request/Response Logging                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  3+ Replicas for High Availability                   │   │
│  │  Load Balancing across replicas                      │   │
│  │  Health Checks and Readiness Probes                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (internal)
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │  Auth   │      │ Workout │      │ User    │
   │ Service │      │ Service │      │ Profile │
   │         │      │         │      │ Service │
   └─────────┘      └─────────┘      └─────────┘
        │                ▼                │
        └────────────────┼────────────────┘
                         ▼
                  ┌─────────────┐
                  │ PostgreSQL  │
                  │ Redis Cache │
                  │ RabbitMQ    │
                  └─────────────┘
```

## Components

### 1. Nginx Ingress Controller
- Deployment with 3+ replicas
- Service with LoadBalancer type for external access
- ConfigMap for Nginx configuration
- RBAC roles and bindings

### 2. Ingress Resource
- Routes external requests to microservices
- TLS/SSL certificate configuration
- Path-based routing rules
- Host-based routing (optional)

### 3. Rate Limiting
- Per-user rate limiting (via JWT claims)
- Per-IP rate limiting (for unauthenticated requests)
- Configurable limits (default: 100 req/min per user)
- Graceful degradation under load

### 4. Authentication Validation
- JWT token validation
- Token expiration checking
- Signature verification
- Automatic token refresh handling

### 5. TLS/SSL Certificates
- Self-signed certificates for development
- Let's Encrypt integration for production
- Certificate auto-renewal
- HTTPS enforcement

## Files

```
api-gateway/
├── README.md                          # This file
├── deployment/
│   ├── nginx-ingress-controller.yaml # Nginx Ingress Controller deployment
│   ├── nginx-service.yaml            # LoadBalancer service for external access
│   ├── nginx-configmap.yaml          # Nginx configuration
│   └── nginx-rbac.yaml               # RBAC roles and bindings
├── ingress/
│   ├── fitquest-ingress.yaml         # Main ingress resource with routing rules
│   ├── tls-certificate.yaml          # TLS certificate secret
│   └── rate-limit-config.yaml        # Rate limiting configuration
├── auth/
│   ├── auth-middleware.yaml          # Authentication validation middleware
│   └── jwt-secret.yaml               # JWT secret for token validation
├── monitoring/
│   ├── prometheus-rules.yaml         # Prometheus alerting rules
│   └── grafana-dashboard.yaml        # Grafana dashboard for API Gateway
└── scripts/
    ├── setup-api-gateway.sh          # Setup script
    ├── generate-certificates.sh      # Generate TLS certificates
    ├── verify-api-gateway.sh         # Verification script
    └── cleanup.sh                    # Cleanup script
```

## Quick Start

### Prerequisites
- Kubernetes cluster (from Task 1.1)
- kubectl configured
- Helm 3+ (optional)

### 1. Create API Gateway Namespace (if not already created)

```bash
kubectl create namespace ingress
```

### 2. Deploy Nginx Ingress Controller

```bash
cd infrastructure/kubernetes/api-gateway
./scripts/setup-api-gateway.sh
```

### 3. Generate TLS Certificates

For development (self-signed):
```bash
./scripts/generate-certificates.sh --self-signed
```

For production (Let's Encrypt):
```bash
./scripts/generate-certificates.sh --letsencrypt --domain api.fitquest.com
```

### 4. Deploy Ingress Resource

```bash
kubectl apply -f ingress/fitquest-ingress.yaml
kubectl apply -f ingress/tls-certificate.yaml
```

### 5. Verify Deployment

```bash
./scripts/verify-api-gateway.sh
```

## Configuration

### Rate Limiting

Edit `ingress/rate-limit-config.yaml` to adjust limits:

```yaml
# Per-user rate limit: 100 requests per minute
user_rate_limit: 100

# Per-IP rate limit: 50 requests per minute
ip_rate_limit: 50

# Burst size: 20 requests
burst_size: 20
```

### Routing Rules

Edit `ingress/fitquest-ingress.yaml` to add/modify routes:

```yaml
- path: /auth
  backend:
    serviceName: auth-service
    servicePort: 8080

- path: /workouts
  backend:
    serviceName: workout-service
    servicePort: 8080
```

### TLS/SSL Certificates

For production, use Let's Encrypt:

```bash
./scripts/generate-certificates.sh --letsencrypt --domain api.fitquest.com
```

For development, use self-signed:

```bash
./scripts/generate-certificates.sh --self-signed
```

## Monitoring

### Prometheus Metrics

The API Gateway exposes Prometheus metrics at `/metrics`:

```bash
kubectl port-forward -n ingress svc/nginx-ingress-controller 9113:9113
curl http://localhost:9113/metrics
```

### Grafana Dashboard

Import the Grafana dashboard:

```bash
kubectl apply -f monitoring/grafana-dashboard.yaml
```

Then access Grafana and import the dashboard ID.

### Logs

View API Gateway logs:

```bash
kubectl logs -n ingress -l app=nginx-ingress-controller -f
```

## Troubleshooting

### API Gateway not accessible

```bash
# Check service status
kubectl get svc -n ingress

# Check ingress status
kubectl get ingress -n ingress

# Check pod status
kubectl get pods -n ingress

# View logs
kubectl logs -n ingress -l app=nginx-ingress-controller
```

### TLS certificate issues

```bash
# Check certificate secret
kubectl get secret -n ingress

# Describe certificate
kubectl describe secret fitquest-tls -n ingress

# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates
```

### Rate limiting not working

```bash
# Check rate limit configuration
kubectl get configmap -n ingress nginx-config -o yaml

# Check rate limit logs
kubectl logs -n ingress -l app=nginx-ingress-controller | grep rate_limit
```

## Performance Targets

- API Gateway latency: < 50ms (p95)
- Request throughput: > 10,000 req/sec
- TLS handshake time: < 100ms
- Rate limiting overhead: < 5ms per request

## Security Considerations

- All external traffic is encrypted with TLS 1.2+
- JWT tokens are validated before routing
- Rate limiting prevents DDoS attacks
- Request logging for audit trail
- RBAC controls access to API Gateway configuration
- Network policies restrict traffic to API Gateway

## Next Steps

1. **Deploy Message Queue** (Task 1.3)
2. **Deploy Monitoring Stack** (Task 1.4)
3. **Deploy Redis Cluster** (Task 1.5)
4. **Deploy PostgreSQL** (Task 1.6)
5. **Deploy Microservices** (Phase 2)

## References

- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Ingress Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [JWT Authentication](https://tools.ietf.org/html/rfc7519)

