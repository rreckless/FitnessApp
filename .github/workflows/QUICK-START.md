# CI/CD Quick Start Guide

## 5-Minute Setup

### 1. Add Secrets to GitHub

```bash
# Generate kubeconfig
kubectl config view --flatten > ~/.kube/config-staging
base64 -i ~/.kube/config-staging | tr -d '\n' > kube-config-staging.b64

# Add to GitHub
gh secret set KUBE_CONFIG_STAGING --body "$(cat kube-config-staging.b64)"
```

### 2. Verify Workflows

```bash
# Check workflows are enabled
gh workflow list

# View workflow status
gh run list
```

### 3. Deploy to Staging

```bash
# Push to develop branch
git push origin develop

# Or manually trigger
gh workflow run deploy-kubernetes.yml -f environment=staging
```

## Common Commands

### View Workflow Status

```bash
# List recent runs
gh run list --workflow=ci-build-test.yml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log
```

### Deploy to Staging

```bash
# Automatic (push to develop)
git push origin develop

# Manual
gh workflow run deploy-kubernetes.yml -f environment=staging
```

### Deploy to Production

```bash
# Trigger workflow
gh workflow run deploy-kubernetes.yml -f environment=production

# Approve deployment (via GitHub Web UI)
# Actions → Deploy to Kubernetes → Review deployments → Approve
```

### Check Kubernetes Status

```bash
# Get pods
kubectl get pods -n fitquest

# Get services
kubectl get services -n fitquest

# Get logs
kubectl logs -n fitquest -l app=AuthenticationService
```

### Rollback Deployment

```bash
# Automatic rollback on failure
# Manual rollback
kubectl rollout undo deployment/AuthenticationService -n fitquest
```

## Workflow Triggers

| Workflow | Trigger | Duration |
|----------|---------|----------|
| CI Build and Test | Push/PR to main/develop | 10-15 min |
| Docker Build and Push | Push to main/develop (backend changes) | 20-30 min |
| Deploy to Kubernetes | Push to develop (staging) / Manual (prod) | 5-10 min |
| Integration Tests | Push/PR to main/develop / Daily | 15-20 min |

## Troubleshooting

### Build Failed

```bash
# View logs
gh run view <run-id> --log

# Check specific service
gh run view <run-id> --log | grep "AuthenticationService"
```

### Deployment Failed

```bash
# Check pod status
kubectl get pods -n fitquest

# View pod logs
kubectl logs -n fitquest <pod-name>

# Describe pod for events
kubectl describe pod -n fitquest <pod-name>
```

### Image Pull Failed

```bash
# Verify image exists
gh run view <run-id> --log | grep "image"

# Check registry credentials
kubectl get secrets -n fitquest
```

## Key Files

- `.github/workflows/ci-build-test.yml` - Build and test workflow
- `.github/workflows/docker-build-push.yml` - Docker build workflow
- `.github/workflows/deploy-kubernetes.yml` - Kubernetes deployment
- `.github/workflows/integration-tests.yml` - Integration tests
- `.github/workflows/secrets-template.md` - Secrets configuration
- `.github/workflows/CI-CD-SETUP.md` - Full setup guide
- `infrastructure/kubernetes/deployments/` - K8s manifests

## Next Steps

1. ✅ Add secrets to GitHub
2. ✅ Verify workflows are enabled
3. ✅ Push to develop branch to test
4. ✅ Monitor workflow run
5. ✅ Check Kubernetes cluster
6. ✅ Verify services are running

## Support

For detailed information, see:
- `CI-CD-SETUP.md` - Complete setup guide
- `secrets-template.md` - Secrets configuration
- GitHub Actions docs: https://docs.github.com/en/actions
