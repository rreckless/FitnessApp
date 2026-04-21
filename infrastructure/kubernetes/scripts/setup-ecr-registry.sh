#!/bin/bash

# FitQuest AWS ECR Registry Setup Script
# This script creates and configures an AWS ECR registry for FitQuest microservices

set -e

# Configuration
REGISTRY_NAME="${REGISTRY_NAME:-fitquest}"
REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG_MUTABILITY="${IMAGE_TAG_MUTABILITY:-MUTABLE}"
SCAN_ON_PUSH="${SCAN_ON_PUSH:-true}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "=========================================="
echo "FitQuest AWS ECR Registry Setup"
echo "=========================================="
echo "Registry Name: $REGISTRY_NAME"
echo "Region: $REGION"
echo "Image Tag Mutability: $IMAGE_TAG_MUTABILITY"
echo "Scan on Push: $SCAN_ON_PUSH"
echo "Retention Days: $RETENTION_DAYS"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }

# Verify AWS credentials
echo "Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "AWS credentials not configured."; exit 1; }

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Create ECR repositories for each microservice
echo ""
echo "Creating ECR repositories..."

SERVICES=(
  "authentication-service"
  "user-profile-service"
  "workout-service"
  "xp-progression-service"
  "leaderboard-service"
  "social-service"
  "achievement-service"
  "activity-feed-service"
  "challenge-service"
  "progress-tracking-service"
  "body-tracking-service"
  "gps-route-service"
  "premium-subscription-service"
  "ai-trainer-service"
  "sync-service"
  "api-gateway"
)

for service in "${SERVICES[@]}"; do
  REPO_NAME="$REGISTRY_NAME/$service"
  
  echo "Creating repository: $REPO_NAME"
  
  # Check if repository already exists
  if aws ecr describe-repositories \
    --repository-names "$REPO_NAME" \
    --region $REGION \
    --query 'repositories[0].repositoryUri' \
    --output text 2>/dev/null; then
    echo "  Repository already exists"
  else
    # Create repository
    aws ecr create-repository \
      --repository-name "$REPO_NAME" \
      --region $REGION \
      --image-tag-mutability $IMAGE_TAG_MUTABILITY \
      --image-scanning-configuration scanOnPush=$SCAN_ON_PUSH \
      --encryption-configuration encryptionType=AES \
      --tags "Environment=production" "ManagedBy=kiro" \
      --query 'repository.repositoryUri' \
      --output text
    
    echo "  Repository created successfully"
  fi
  
  # Set lifecycle policy for image retention
  echo "Setting lifecycle policy for $REPO_NAME..."
  aws ecr put-lifecycle-policy \
    --repository-name "$REPO_NAME" \
    --region $REGION \
    --lifecycle-policy-text '{
      "rules": [
        {
          "rulePriority": 1,
          "description": "Keep last 10 images",
          "selection": {
            "tagStatus": "any",
            "countType": "imageCountMoreThan",
            "countNumber": 10
          },
          "action": {
            "type": "expire"
          }
        },
        {
          "rulePriority": 2,
          "description": "Expire images older than 30 days",
          "selection": {
            "tagStatus": "untagged",
            "countType": "sinceImagePushed",
            "countUnit": "days",
            "countNumber": '$RETENTION_DAYS'
          },
          "action": {
            "type": "expire"
          }
        }
      ]
    }'
done

# Create ECR registry policy
echo ""
echo "Creating ECR registry policy..."
aws ecr put-registry-policy \
  --registry-policy-text '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowPull",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  }' \
  --region $REGION

# Create IAM policy for ECR access
echo ""
echo "Creating IAM policy for ECR access..."
POLICY_NAME="$REGISTRY_NAME-ecr-policy"

aws iam create-policy \
  --policy-name $POLICY_NAME \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage"
        ],
        "Resource": "arn:aws:ecr:'$REGION':'$ACCOUNT_ID':repository/'$REGISTRY_NAME'/*"
      }
    ]
  }' 2>/dev/null || echo "Policy already exists"

# Create IAM user for CI/CD
echo ""
echo "Creating IAM user for CI/CD..."
CI_USER="$REGISTRY_NAME-ci-user"

aws iam create-user \
  --user-name $CI_USER \
  --tags "Environment=production" "ManagedBy=kiro" 2>/dev/null || echo "User already exists"

# Attach policy to user
aws iam attach-user-policy \
  --user-name $CI_USER \
  --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"

# Create access keys
echo ""
echo "Creating access keys for CI/CD user..."
ACCESS_KEY_JSON=$(aws iam create-access-key \
  --user-name $CI_USER \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
  --output json 2>/dev/null || echo "Access keys already exist")

if [ "$ACCESS_KEY_JSON" != "Access keys already exist" ]; then
  echo "Access Key ID: $(echo $ACCESS_KEY_JSON | jq -r '.[0]')"
  echo "Secret Access Key: $(echo $ACCESS_KEY_JSON | jq -r '.[1]')"
  echo ""
  echo "⚠️  Save these credentials securely! They will not be shown again."
fi

# Get ECR login token
echo ""
echo "Getting ECR login token..."
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

echo ""
echo "=========================================="
echo "ECR Registry Setup Complete!"
echo "=========================================="
echo ""
echo "Registry Details:"
echo "  Account ID: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "  Registry URL: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
echo ""
echo "Repositories created:"
for service in "${SERVICES[@]}"; do
  echo "  - $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REGISTRY_NAME/$service"
done
echo ""
echo "Next steps:"
echo "  1. Build Docker images: docker build -t <image-name> ."
echo "  2. Tag images: docker tag <image-name> $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REGISTRY_NAME/<service-name>:latest"
echo "  3. Push images: docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REGISTRY_NAME/<service-name>:latest"
echo ""
