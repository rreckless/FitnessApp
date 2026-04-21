# FitQuest Architecture Refactoring: Monolith to Microservices

## Overview

The FitQuest backend has been refactored from a monolithic Node.js/Express architecture to a distributed microservice architecture using .NET 10. This document summarizes the key changes and rationale.

## Key Changes

### 1. Technology Stack Transformation

**Before (Monolith)**
- Runtime: Node.js 18+
- Framework: Express.js or Fastify
- Database: Single PostgreSQL instance
- Cache: Redis (single instance)
- Message Queue: Bull (Redis-backed)
- Deployment: AWS EC2 or similar

**After (Microservices)**
- Runtime: .NET 10
- Framework: ASP.NET Core Minimal APIs
- Database: PostgreSQL (shared + service-specific)
- Cache: Redis Cluster
- Message Queue: RabbitMQ or Azure Service Bus
- Deployment: Kubernetes (Docker containers)

### 2. Service Decomposition

The monolithic backend has been decomposed into 11 independent microservices:

1. **Authentication Service** - User authentication, JWT tokens, session management
2. **User Profile Service** - Profile management, preferences, settings
3. **Workout Service** - Workout logging, exercise tracking, history
4. **XP & Progression Service** - XP calculation, level progression, muscle group ranks
5. **Leaderboard Service** - Ranking, position calculation, real-time updates
6. **Social Service** - Friend management, friend requests, connections
7. **Achievement Service** - Achievement definitions, unlock conditions, tracking
8. **Sync Service** - Data synchronization, conflict resolution, offline sync
9. **GPS/Route Service** - GPS tracking, route planning, distance calculations
10. **Body Tracking Service** - Weight logging, measurements, progress photos
11. **Premium/Subscription Service** - Subscription management, billing, feature gating

### 3. Communication Patterns

**Synchronous Communication**
- REST APIs for external client communication (mobile app)
- gRPC for internal service-to-service communication
- API Gateway (Kong/Nginx) routes requests to appropriate services

**Asynchronous Communication**
- Message Queue (RabbitMQ/Azure Service Bus) for event-driven architecture
- Event types: WorkoutCompleted, LevelUp, RankUp, AchievementUnlocked, etc.
- Loose coupling between services
- Eventual consistency model

### 4. Database Strategy

**Shared Databases**
- Users database (Auth, User Profile, XP services)
- Exercises database (shared reference data)
- Achievements database (shared definitions)

**Service-Specific Databases**
- Workout Service: workouts, workout_exercises
- Leaderboard Service: leaderboards (cached in Redis)
- Social Service: friendships
- GPS Service: gps_routes, gps_points
- Body Tracking Service: body_weight, body_measurements, progress_photos
- Premium Service: subscriptions

### 5. Deployment Architecture

**Containerization**
- Docker images for each microservice
- Base image: mcr.microsoft.com/dotnet/aspnet:10.0
- Image registry: Docker Hub or AWS ECR

**Orchestration**
- Kubernetes for container orchestration
- Deployments with 3+ replicas for high availability
- ConfigMaps for configuration
- Secrets for sensitive data
- Ingress for external traffic routing

**Monitoring & Observability**
- Prometheus for metrics collection
- Grafana for visualization
- Jaeger/Zipkin for distributed tracing
- ELK Stack or Loki for centralized logging
- PagerDuty for alerting

### 6. API Gateway

All external requests route through API Gateway:
- Single entry point for clients
- Centralized authentication and authorization
- Rate limiting and request throttling
- Request/response transformation
- Service discovery abstraction

### 7. Event-Driven Architecture

Services communicate asynchronously through message queue:

```
Workout Completion Flow:
1. User completes workout
2. Workout Service creates workout, publishes WorkoutCompleted event
3. XP Service receives event, calculates XP, publishes LevelUp event
4. Achievement Service receives events, checks achievements, publishes AchievementUnlocked
5. Leaderboard Service receives LevelUp event, updates rankings
6. Activity Feed Service receives all events, creates feed entries
7. Notification Service receives all events, sends notifications
```

## Benefits of Microservices Architecture

### Scalability
- Each service scales independently based on load
- Workout Service can scale for high workout logging traffic
- Leaderboard Service can scale for high query traffic
- Horizontal scaling with Kubernetes auto-scaling

### Resilience
- Service failures don't cascade to entire system
- Circuit breaker pattern prevents cascading failures
- Automatic failover with Kubernetes
- Dead letter queue for failed messages

### Development Agility
- Teams can develop and deploy services independently
- Different services can use different .NET patterns
- Faster iteration and deployment cycles
- Clear service boundaries and responsibilities

### Technology Flexibility
- Each service can use appropriate .NET 10 patterns
- Minimal APIs for lightweight services
- Entity Framework for data access
- Dependency injection for testability

### Operational Visibility
- Distributed tracing across services
- Centralized logging and monitoring
- Metrics collection from all services
- Better debugging and troubleshooting

## Trade-offs and Challenges

### Increased Complexity
- Distributed system debugging is harder
- Network latency between services
- Data consistency challenges (eventual consistency)
- Operational overhead (Kubernetes, service mesh)

### Data Consistency
- Eventual consistency instead of strong consistency
- Saga pattern for multi-service transactions
- Conflict resolution using last-write-wins
- Requires careful design of event flows

### Network Overhead
- Service-to-service communication adds latency
- gRPC used for internal communication (faster than REST)
- Connection pooling and caching to minimize overhead

### Operational Requirements
- Kubernetes expertise required
- Service mesh (Istio/Linkerd) for advanced features
- Distributed tracing and monitoring setup
- CI/CD pipeline for multiple services

## Migration Path

### Phase 1: Foundation
- Set up Kubernetes cluster
- Deploy API Gateway
- Set up message queue (RabbitMQ)
- Set up monitoring and logging

### Phase 2: Core Services
- Deploy Authentication Service
- Deploy User Profile Service
- Deploy Workout Service
- Migrate existing Node.js logic to .NET 10

### Phase 3: Business Logic Services
- Deploy XP & Progression Service
- Deploy Leaderboard Service
- Deploy Achievement Service
- Implement event-driven architecture

### Phase 4: Supporting Services
- Deploy Social Service
- Deploy GPS/Route Service
- Deploy Body Tracking Service
- Deploy Premium/Subscription Service

### Phase 5: Sync and Integration
- Deploy Sync Service
- Implement offline-first sync
- Integrate with external services (Stripe, Apple Health, Spotify)
- Performance optimization and tuning

## Performance Targets

- App launch: < 1000ms
- Screen navigation: < 500ms
- Exercise search: < 200ms
- List scrolling: 60 FPS
- Workout logging: < 100ms per set entry
- API response time: < 200ms (p95)
- Leaderboard query: < 100ms

## Monitoring and Observability

### Metrics
- Request latency (p50, p95, p99)
- Error rate by service
- Database query time
- Cache hit rate
- Message queue depth

### Alerts
- High error rate (> 1%)
- Slow queries (> 1s)
- Service unavailability
- Sync failures
- Database connection pool exhaustion

### Dashboards
- Service health overview
- Request latency trends
- Error rate trends
- Database performance
- Message queue status

## Conclusion

The refactoring from monolithic Node.js to microservice architecture with .NET 10 provides significant benefits in scalability, resilience, and development agility. While it introduces operational complexity, the benefits outweigh the challenges for a system of FitQuest's scale and requirements.

The event-driven architecture enables loose coupling between services, allowing independent development and deployment. The use of .NET 10 provides modern language features, performance, and ecosystem support. Kubernetes orchestration provides automatic scaling, self-healing, and operational visibility.

This architecture positions FitQuest for growth and enables rapid feature development while maintaining system reliability and performance.
