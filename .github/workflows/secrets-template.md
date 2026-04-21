# GitHub Actions Secrets Configuration

This document describes the secrets that need to be configured in GitHub for the CI/CD pipeline to work properly.

## Required Secrets

### Container Registry Secrets

- **GITHUB_TOKEN**: Automatically provided by GitHub Actions for pushing to GHCR
  - Used for: Docker image push to ghcr.io
  - Scope: `packages:write`

### Kubernetes Secrets

- **KUBE_CONFIG_STAGING**: Base64-encoded kubeconfig for staging Kubernetes cluster
  - Used for: Deploying to staging environment
  - Format: `base64 -i ~/.kube/config-staging | tr -d '\n'`
  - Permissions: Cluster admin or deployment permissions

- **KUBE_CONFIG_PRODUCTION**: Base64-encoded kubeconfig for production Kubernetes cluster
  - Used for: Deploying to production environment
  - Format: `base64 -i ~/.kube/config-prod | tr -d '\n'`
  - Permissions: Cluster admin or deployment permissions

### Database Secrets

- **DB_HOST_STAGING**: PostgreSQL host for staging
  - Example: `postgres-staging.example.com`

- **DB_HOST_PRODUCTION**: PostgreSQL host for production
  - Example: `postgres-prod.example.com`

- **DB_PASSWORD_STAGING**: PostgreSQL password for staging
  - Used for: Database initialization and migrations

- **DB_PASSWORD_PRODUCTION**: PostgreSQL password for production
  - Used for: Database initialization and migrations

### Redis Secrets

- **REDIS_HOST_STAGING**: Redis host for staging
  - Example: `redis-staging.example.com`

- **REDIS_HOST_PRODUCTION**: Redis host for production
  - Example: `redis-prod.example.com`

- **REDIS_PASSWORD_STAGING**: Redis password for staging (if required)

- **REDIS_PASSWORD_PRODUCTION**: Redis password for production (if required)

### RabbitMQ Secrets

- **RABBITMQ_HOST_STAGING**: RabbitMQ host for staging
  - Example: `rabbitmq-staging.example.com`

- **RABBITMQ_HOST_PRODUCTION**: RabbitMQ host for production
  - Example: `rabbitmq-prod.example.com`

- **RABBITMQ_USER_STAGING**: RabbitMQ username for staging

- **RABBITMQ_USER_PRODUCTION**: RabbitMQ username for production

- **RABBITMQ_PASSWORD_STAGING**: RabbitMQ password for staging

- **RABBITMQ_PASSWORD_PRODUCTION**: RabbitMQ password for production

### Notification Secrets

- **SLACK_WEBHOOK_URL**: Slack webhook for deployment notifications
  - Used for: Notifying deployment status
  - Format: `https://hooks.slack.com/services/...`

- **PAGERDUTY_INTEGRATION_KEY**: PagerDuty integration key for alerts
  - Used for: Incident escalation

### Container Scanning Secrets

- **TRIVY_GITHUB_TOKEN**: GitHub token for Trivy vulnerability scanner
  - Used for: Scanning Docker images for vulnerabilities
  - Scope: `security_events:write`

## How to Add Secrets

### Via GitHub Web UI

1. Go to your repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Enter the secret name and value
5. Click "Add secret"

### Via GitHub CLI

```bash
gh secret set SECRET_NAME --body "secret_value"
```

## Environment-Specific Variables

Create environment-specific variables in GitHub:

### Staging Environment Variables

- **ENVIRONMENT**: `staging`
- **REGISTRY**: `ghcr.io`
- **NAMESPACE**: `fitquest-staging`
- **REPLICAS**: `2`

### Production Environment Variables

- **ENVIRONMENT**: `production`
- **REGISTRY**: `ghcr.io`
- **NAMESPACE**: `fitquest`
- **REPLICAS**: `3`

## Security Best Practices

1. **Rotate secrets regularly** - Update credentials every 90 days
2. **Use least privilege** - Grant only necessary permissions
3. **Audit secret access** - Monitor who accesses secrets
4. **Never commit secrets** - Use GitHub Secrets, not .env files
5. **Use separate credentials** - Different secrets for staging and production
6. **Enable secret scanning** - GitHub will alert on exposed secrets
7. **Use short-lived tokens** - Prefer temporary credentials when possible

## Troubleshooting

### Secret not found error

- Verify secret name matches exactly (case-sensitive)
- Ensure secret is added to the correct repository
- Check that the workflow has access to the secret

### Authentication failures

- Verify secret value is correct and not truncated
- Check that credentials haven't expired
- Ensure proper permissions are granted

### Deployment failures

- Check Kubernetes cluster connectivity
- Verify kubeconfig is valid and not expired
- Ensure service account has deployment permissions
