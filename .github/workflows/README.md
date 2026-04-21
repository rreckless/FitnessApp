# FitQuest CI/CD Pipeline

This directory contains GitHub Actions workflows for the FitQuest microservices CI/CD pipeline.

## Overview

The CI/CD pipeline automates building, testing, and deploying FitQuest microservices to Kubernetes. It consists of four main workflows:

### 1. CI Build and Test (`ci-build-test.yml`)

Automatically builds and tests all microservices on every push and pull request.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**What it does:**
- Builds all 16 microservices
- Runs unit tests
- Performs code analysis
- Publishes test results

**Duration:** ~10-15 minutes

### 2. Docker Build and Push (`docker-build-push.yml`)

Builds Docker images and pushes them to GitHub Container Registry (GHCR).

**Triggers:**
- Push to `main` or `develop` branches (when backend-dotnet files change)
- Pull requests to `main` or `develop` branches (when backend-dotnet files change)

**What it does:**
- Builds Docker images for all microservices
- Pushes images to GHCR with semantic versioning
- Scans images for vulnerabilities using Trivy
- Uploads security reports to GitHub

**Duration:** ~20-30 minutes

### 3. Deploy to Kubernetes (`deploy-kubernetes.yml`)

Deploys microservices to Kubernetes clusters.

**Triggers:**
- Push to `develop` branch (deploys to staging)
- Manual workflow dispatch (deploys to staging or production)
- Push to `main` branch (requires manual approval for production)

**What it does:**
- Deploys to staging automatically on develop branch
- Requires manual approval for production deployment
- Runs smoke tests after deployment
- Automatically rolls back on failure

**Duration:** ~5-10 minutes

### 4. Integration Tests (`integration-tests.yml`)

Runs comprehensive integration and end-to-end tests.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Daily schedule (2 AM UTC)

**What it does:**
- Runs integration tests against real services
- Runs end-to-end tests
- Runs performance tests
- Publishes test results

**Duration:** ~15-20 minutes

## Quick Start

### 1. Prerequisites

- GitHub repository with Actions enabled
- Kubernetes clusters (staging and production)
- Container registry (GHCR or AWS ECR)
- External services (PostgreSQL, Redis, RabbitMQ)

### 2. Configure Secrets

See `secrets-template.md` for required secrets:

```bash
# Add kubeconfig secrets
gh secret set KUBE_CONFIG_STAGING --body "$(base64 -i ~/.kube/config-staging | tr -d '\n')"
gh secret set KUBE_CONFIG_PRODUCTION --body "$(base64 -i ~/.kube/config-prod | tr -d '\n')"
```

### 3. Deploy to Staging

```bash
# Automatic deployment on push to develop
git push origin develop

# Or manual deployment
gh workflow run deploy-kubernetes.yml -f environment=staging
```

### 4. Deploy to Production

```bash
# Trigger workflow
gh workflow run deploy-kubernetes.yml -f environment=production

# Approve deployment via GitHub Web UI
# Actions → Deploy to Kubernetes → Review deployments → Approve
```

## File Structure

```
.github/workflows/
├── README.md                    # This file
├── QUICK-START.md              # 5-minute quick start guide
├── CI-CD-SETUP.md              # Comprehensive setup guide
├── secrets-template.md         # Secrets configuration
├── ci-build-test.yml           # Build and test workflow
├── docker-build-push.yml       # Docker build workflow
├── deploy-kubernetes.yml       # Kubernetes deployment
└── integration-tests.yml       # Integration tests

infrastructure/kubernetes/
├── deployments/
│   ├── namespace.yaml          # Kubernetes namespace
│   ├── configmap-template.yaml # Configuration
│   ├── secret-template.yaml    # Secrets
│   ├── service-template.yaml   # Service definitions
│   ├── deployment-template.yaml # Deployment template
│   ├── rbac.yaml               # RBAC configuration
│   └── ingress.yaml            # Ingress configuration
└── scripts/
    └── setup-cicd.sh           # Setup script
```

## Microservices

The pipeline builds and deploys the following microservices:

1. **AuthenticationService** - User authentication and JWT tokens
2. **UserProfileService** - User profile management
3. **WorkoutService** - Workout logging and tracking
4. **XpProgressionService** - XP calculation and level progression
5. **LeaderboardService** - Leaderboard rankings
6. **SocialService** - Friend management
7. **AchievementService** - Achievement tracking
8. **ActivityFeedService** - Activity feed
9. **ChallengeService** - Challenge management
10. **ProgressTrackingService** - Progress tracking and PRs
11. **BodyTrackingService** - Body weight and measurements
12. **GpsRouteService** - GPS tracking and routes
13. **PremiumSubscriptionService** - Subscription management
14. **StreakTrackingService** - Streak tracking
15. **SyncService** - Data synchronization
16. **ExerciseLibraryService** - Exercise library

## Deployment Environments

### Staging

- **Trigger:** Push to `develop` branch
- **Cluster:** Staging Kubernetes cluster
- **Replicas:** 2 per service
- **Auto-deploy:** Yes
- **Approval:** Not required

### Production

- **Trigger:** Manual workflow dispatch or push to `main` branch
- **Cluster:** Production Kubernetes cluster
- **Replicas:** 3 per service
- **Auto-deploy:** No
- **Approval:** Required

## Monitoring and Troubleshooting

### View Workflow Status

```bash
# List recent runs
gh run list --workflow=ci-build-test.yml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log
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

### Common Issues

**Build Failed:**
```bash
# View logs
gh run view <run-id> --log | grep "error"
```

**Deployment Failed:**
```bash
# Check pod status
kubectl get pods -n fitquest

# View pod logs
kubectl logs -n fitquest <pod-name>
```

**Image Pull Failed:**
```bash
# Verify image exists
gh run view <run-id> --log | grep "image"

# Check registry credentials
kubectl get secrets -n fitquest
```

## Security

- All images are scanned for vulnerabilities
- Secrets are encrypted and never logged
- Production deployments require approval
- All deployments are auditable
- TLS/SSL certificates are automatically managed

## Performance

- Parallel builds for all microservices
- Docker layer caching for faster builds
- Kubernetes rolling updates for zero downtime
- Automatic rollback on deployment failure

## Documentation

- **QUICK-START.md** - 5-minute quick start guide
- **CI-CD-SETUP.md** - Comprehensive setup and troubleshooting guide
- **secrets-template.md** - Secrets configuration guide

## Support

For issues or questions:

1. Check the comprehensive setup guide: `CI-CD-SETUP.md`
2. Review workflow logs for error messages
3. Check Kubernetes cluster status
4. Verify all secrets are configured correctly

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [.NET Documentation](https://docs.microsoft.com/en-us/dotnet/)
