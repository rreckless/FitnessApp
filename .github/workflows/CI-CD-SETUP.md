# FitQuest CI/CD Pipeline Setup Guide

This document provides comprehensive instructions for setting up and managing the CI/CD pipeline for the FitQuest microservices architecture.

## Overview

The CI/CD pipeline consists of four main workflows:

1. **CI Build and Test** (`ci-build-test.yml`) - Builds and tests all microservices
2. **Docker Build and Push** (`docker-build-push.yml`) - Builds Docker images and pushes to registry
3. **Deploy to Kubernetes** (`deploy-kubernetes.yml`) - Deploys to staging and production
4. **Integration Tests** (`integration-tests.yml`) - Runs integration and E2E tests

## Prerequisites

### GitHub Setup

1. **Repository Settings**
   - Enable GitHub Actions
   - Configure branch protection rules
   - Set up required status checks

2. **Secrets Configuration**
   - See `secrets-template.md` for required secrets
   - Add all secrets to GitHub repository settings

3. **Environments**
   - Create "staging" environment
   - Create "production" environment
   - Configure environment protection rules

### Infrastructure Setup

1. **Kubernetes Clusters**
   - Staging cluster (minimum 2 nodes)
   - Production cluster (minimum 3 nodes)
   - Both clusters should have:
     - Nginx Ingress Controller
     - Cert-Manager for TLS
     - Prometheus for monitoring
     - Loki for logging

2. **Container Registry**
   - GitHub Container Registry (GHCR) enabled
   - Or AWS ECR configured

3. **External Services**
   - PostgreSQL database (staging and production)
   - Redis cluster (staging and production)
   - RabbitMQ cluster (staging and production)

## Workflow Triggers

### CI Build and Test

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**What it does:**
- Builds all microservices
- Runs unit tests
- Performs code analysis
- Publishes test results

**Duration:** ~10-15 minutes

### Docker Build and Push

**Triggers:**
- Push to `main` or `develop` branches (when backend-dotnet files change)
- Pull requests to `main` or `develop` branches (when backend-dotnet files change)

**What it does:**
- Builds Docker images for all microservices
- Pushes images to GHCR
- Scans images for vulnerabilities
- Uploads security reports

**Duration:** ~20-30 minutes

### Deploy to Kubernetes

**Triggers:**
- Push to `develop` branch (deploys to staging)
- Manual workflow dispatch (deploys to staging or production)
- Push to `main` branch (requires manual approval for production)

**What it does:**
- Deploys microservices to Kubernetes
- Runs smoke tests
- Verifies service health
- Performs rollback on failure

**Duration:** ~5-10 minutes

### Integration Tests

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Daily schedule (2 AM UTC)

**What it does:**
- Runs integration tests
- Runs end-to-end tests
- Runs performance tests
- Publishes test results

**Duration:** ~15-20 minutes

## Setting Up Secrets

### Step 1: Generate Kubeconfig

```bash
# For staging cluster
kubectl config view --flatten > ~/.kube/config-staging
base64 -i ~/.kube/config-staging | tr -d '\n' > kube-config-staging.b64

# For production cluster
kubectl config view --flatten > ~/.kube/config-prod
base64 -i ~/.kube/config-prod | tr -d '\n' > kube-config-prod.b64
```

### Step 2: Add Secrets to GitHub

```bash
# Using GitHub CLI
gh secret set KUBE_CONFIG_STAGING --body "$(cat kube-config-staging.b64)"
gh secret set KUBE_CONFIG_PRODUCTION --body "$(cat kube-config-prod.b64)"

# Or via GitHub Web UI
# Settings → Secrets and variables → Actions → New repository secret
```

### Step 3: Verify Secrets

```bash
# List all secrets
gh secret list

# Verify secret is accessible (will show masked value)
gh secret view KUBE_CONFIG_STAGING
```

## Deploying to Staging

### Automatic Deployment

Staging automatically deploys on every push to `develop` branch:

```bash
git push origin develop
```

The workflow will:
1. Build and test all services
2. Build Docker images
3. Deploy to staging Kubernetes cluster
4. Run smoke tests
5. Verify service health

### Manual Deployment

To manually deploy to staging:

```bash
# Via GitHub CLI
gh workflow run deploy-kubernetes.yml -f environment=staging

# Or via GitHub Web UI
# Actions → Deploy to Kubernetes → Run workflow → Select "staging"
```

## Deploying to Production

### Prerequisites

1. All tests must pass on `main` branch
2. Code review and approval required
3. Production environment protection rules must be satisfied

### Deployment Process

1. **Trigger Deployment**
   ```bash
   # Via GitHub CLI
   gh workflow run deploy-kubernetes.yml -f environment=production
   
   # Or via GitHub Web UI
   # Actions → Deploy to Kubernetes → Run workflow → Select "production"
   ```

2. **Approve Deployment**
   - Navigate to the workflow run
   - Click "Review deployments"
   - Select "production" environment
   - Click "Approve and deploy"

3. **Monitor Deployment**
   - Watch the workflow progress
   - Check Kubernetes cluster for pod status
   - Verify services are healthy

4. **Verify Production**
   ```bash
   # Check pod status
   kubectl get pods -n fitquest
   
   # Check service status
   kubectl get services -n fitquest
   
   # Check ingress
   kubectl get ingress -n fitquest
   
   # Check logs
   kubectl logs -n fitquest -l app=AuthenticationService --tail=100
   ```

## Monitoring and Troubleshooting

### Viewing Workflow Runs

```bash
# List recent workflow runs
gh run list --workflow=ci-build-test.yml

# View specific run details
gh run view <run-id>

# View run logs
gh run view <run-id> --log
```

### Common Issues

#### Build Failures

**Issue:** Build fails with "dotnet restore" error

**Solution:**
```bash
# Check .csproj files for correct package references
# Verify NuGet package sources are accessible
# Check for circular dependencies
```

**Issue:** Docker build fails

**Solution:**
```bash
# Verify Dockerfile exists in service directory
# Check base image is accessible
# Verify build context is correct
```

#### Deployment Failures

**Issue:** Deployment fails with "ImagePullBackOff"

**Solution:**
```bash
# Verify image exists in registry
gh run view <run-id> --log | grep "image"

# Check image pull secret
kubectl get secrets -n fitquest

# Verify registry credentials
kubectl describe secret ghcr-secret -n fitquest
```

**Issue:** Deployment fails with "CrashLoopBackOff"

**Solution:**
```bash
# Check pod logs
kubectl logs -n fitquest <pod-name>

# Check pod events
kubectl describe pod -n fitquest <pod-name>

# Verify environment variables
kubectl get configmap fitquest-config -n fitquest -o yaml
```

#### Test Failures

**Issue:** Integration tests fail

**Solution:**
```bash
# Check database connectivity
kubectl exec -n fitquest <pod-name> -- psql -h postgres -U fitquest_user -d fitquest_test -c "SELECT 1"

# Check Redis connectivity
kubectl exec -n fitquest <pod-name> -- redis-cli -h redis ping

# Check RabbitMQ connectivity
kubectl exec -n fitquest <pod-name> -- curl http://rabbitmq:15672/api/overview
```

### Viewing Logs

```bash
# View workflow logs
gh run view <run-id> --log

# View pod logs
kubectl logs -n fitquest <pod-name>

# View logs from all pods in a deployment
kubectl logs -n fitquest -l app=AuthenticationService --all-containers=true

# Stream logs in real-time
kubectl logs -n fitquest -l app=AuthenticationService -f
```

### Checking Service Health

```bash
# Check service endpoints
kubectl get endpoints -n fitquest

# Check service DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup AuthenticationService.fitquest.svc.cluster.local

# Check service connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://AuthenticationService.fitquest.svc.cluster.local:5000/health
```

## Rollback Procedures

### Automatic Rollback

If deployment fails, the workflow automatically rolls back:

```bash
# Verify rollback
kubectl rollout history deployment/AuthenticationService -n fitquest
kubectl rollout status deployment/AuthenticationService -n fitquest
```

### Manual Rollback

```bash
# Rollback to previous revision
kubectl rollout undo deployment/AuthenticationService -n fitquest

# Rollback to specific revision
kubectl rollout undo deployment/AuthenticationService -n fitquest --to-revision=2

# Verify rollback
kubectl rollout status deployment/AuthenticationService -n fitquest
```

## Performance Optimization

### Caching

The Docker build workflow uses GitHub Actions cache to speed up builds:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

To clear cache:

```bash
# Via GitHub CLI
gh actions-cache delete <cache-key> --confirm

# Or via GitHub Web UI
# Settings → Actions → Caches → Delete cache
```

### Parallel Builds

The workflow uses matrix strategy to build services in parallel:

```yaml
strategy:
  matrix:
    service: [AuthenticationService, UserProfileService, ...]
```

This significantly reduces build time.

## Security Best Practices

1. **Secrets Management**
   - Rotate secrets every 90 days
   - Use separate credentials for staging and production
   - Never commit secrets to repository

2. **Image Scanning**
   - All images are scanned for vulnerabilities
   - High-severity vulnerabilities block deployment
   - Review security reports regularly

3. **Access Control**
   - Use branch protection rules
   - Require code review before merge
   - Require approval for production deployment

4. **Audit Logging**
   - All deployments are logged
   - Workflow runs are auditable
   - Check GitHub audit log regularly

## Maintenance

### Regular Tasks

- **Weekly:** Review workflow runs and logs
- **Monthly:** Rotate secrets and credentials
- **Quarterly:** Update base images and dependencies
- **Annually:** Review and update CI/CD configuration

### Updating Workflows

To update workflow files:

1. Create a new branch
2. Update workflow files
3. Test changes in a feature branch
4. Create pull request
5. Merge after review

Changes take effect immediately after merge.

## Support and Troubleshooting

For issues or questions:

1. Check GitHub Actions documentation: https://docs.github.com/en/actions
2. Review workflow logs for error messages
3. Check Kubernetes cluster status
4. Verify all secrets are configured correctly
5. Contact DevOps team for infrastructure issues

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [.NET Documentation](https://docs.microsoft.com/en-us/dotnet/)
