output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.fitquest.id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.fitquest.arn
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.fitquest.endpoint
}

output "eks_cluster_version" {
  description = "EKS cluster version"
  value       = aws_eks_cluster.fitquest.version
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.fitquest.repository_url
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.fitquest.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}
