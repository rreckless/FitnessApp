# FitQuest Technical Design Document

## Overview

FitQuest is a gamified fitness application that combines workout logging, progression tracking, social competition, and AI-powered coaching. The system is built on an offline-first architecture with cloud synchronization, enabling users to log workouts without internet connectivity while maintaining data consistency across multiple devices.

### Key Design Principles

1. **Offline-First**: All critical functionality works without internet; sync happens automatically when connection is available
2. **Real-Time Progression**: XP, streaks, and achievements update immediately upon workout completion
3. **Data Consistency**: Conflict resolution uses last-write-wins with timestamp-based ordering
4. **Performance**: Sub-second load times through aggressive caching and lazy loading
5. **Privacy**: End-to-end encryption for sensitive data, GDPR/CCPA compliant
6. **Extensibility**: Modular architecture supports future integrations (Apple Health, Spotify, GPS)

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FitQuest Mobile App                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Presentation Layer (React Native)            │   │
│  │  Home | Workouts | Progress | Social | Profile       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Business Logic Layer (TypeScript)             │   │
│  │  XP Engine | Streak Manager | Achievement Tracker    │   │
│  │  Workout Logger | Progress Calculator | AI Trainer   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    Local Storage Layer (SQLite + FileSystem)         │   │
│  │  Workouts | Users | Exercises | Sync Queue          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ (Sync)
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Backend (.NET 10 Microservices)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Gateway (Kong/Nginx)                │   │
│  │  Request Routing | Rate Limiting | Auth Validation   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Microservices (.NET 10 Minimal APIs)         │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ Auth Service | User Profile | Workout Service  │ │   │
│  │  │ XP & Progression | Leaderboard | Social        │ │   │
│  │  │ Achievement | Sync | GPS/Route | Body Tracking │ │   │
│  │  │ Premium/Subscription                           │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Message Queue (RabbitMQ/Azure Service Bus)          │   │
│  │  Async Events: WorkoutCompleted, LevelUp, etc.       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Service Discovery & Orchestration (Kubernetes)      │   │
│  │  Service Registration | Load Balancing | Health      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Data Layer (PostgreSQL + Redis Cache)               │   │
│  │  Shared: Users, Exercises, Achievements              │   │
│  │  Service-Specific: Workouts, Leaderboards, etc.      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              External Integrations                           │
│  Apple Health | Spotify API | Google Maps | Stripe          │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Mobile (iOS & Android)**
- Language: TypeScript
- UI Framework: React Native
- Local Database: SQLite (via react-native-sqlite-storage)
- Networking: Axios with custom retry logic
- Location: react-native-geolocation-service
- Health: react-native-health (Apple Health), react-native-google-fit (Google Fit)
- Music: react-native-track-player (Spotify integration)
- Storage: AsyncStorage (key-value), react-native-keychain (secure storage)
- Testing: Jest with comprehensive mocking

**Backend - Microservices**
- Runtime: .NET 10
- Framework: ASP.NET Core Minimal APIs
- Language: C#
- Database: PostgreSQL 14+ (shared and service-specific databases)
- Cache: Redis 7+
- Authentication: JWT with refresh tokens
- File Storage: AWS S3 or similar
- Message Queue: RabbitMQ or Azure Service Bus for async communication
- Service Discovery: Kubernetes or Consul
- API Gateway: Kong or Nginx
- Inter-Service Communication: gRPC (internal), REST APIs (external)

**Infrastructure**
- Containerization: Docker
- Orchestration: Kubernetes (K8s)
- Hosting: AWS EKS, Azure AKS, or on-premises K8s cluster
- CDN: CloudFront for static assets
- Monitoring: Prometheus + Grafana, DataDog, or New Relic
- Logging: ELK Stack, Loki, or CloudWatch
- Distributed Tracing: Jaeger or Zipkin
- CI/CD: GitHub Actions with Docker image builds

## Microservices Architecture

### Service Decomposition

The monolithic backend has been decomposed into 11 independent microservices, each with a specific responsibility and its own database where appropriate:

#### 1. Authentication Service (.NET 10)
**Responsibility**: User authentication, JWT token management, session handling
**Database**: PostgreSQL (shared users table)
**API Endpoints**:
- `POST /auth/register` - Create new account
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Invalidate session
- `POST /auth/password-reset` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm reset with token

**Key Features**:
- JWT token generation and validation
- Password hashing with bcrypt
- Device fingerprinting for security
- Token blacklist management via Redis
- MFA support (TOTP)

#### 2. User Profile Service (.NET 10)
**Responsibility**: User profile management, preferences, settings
**Database**: PostgreSQL (users, user_preferences tables)
**API Endpoints**:
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update profile
- `GET /users/:id/preferences` - Get user preferences
- `PUT /users/:id/preferences` - Update preferences
- `POST /users/:id/avatar` - Upload profile picture

**Key Features**:
- Profile CRUD operations
- Preference management (goals, equipment, experience level)
- Avatar upload and storage (S3)
- Profile visibility controls

#### 3. Workout Service (.NET 10)
**Responsibility**: Workout logging, exercise tracking, workout history
**Database**: PostgreSQL (workouts, workout_exercises tables)
**API Endpoints**:
- `POST /workouts` - Create workout
- `GET /workouts` - List user workouts (paginated)
- `GET /workouts/:id` - Get workout details
- `PUT /workouts/:id` - Update workout
- `DELETE /workouts/:id` - Delete workout
- `POST /workouts/:id/complete` - Mark workout complete

**Key Features**:
- Workout CRUD operations
- Exercise selection and set/rep/weight entry
- Volume calculation
- Offline sync support
- Publishes `WorkoutCompleted` event to message queue

#### 4. XP & Progression Service (.NET 10)
**Responsibility**: XP calculation, level progression, muscle group ranks
**Database**: PostgreSQL (user_xp, muscle_group_ranks tables)
**API Endpoints**:
- `GET /users/:id/xp` - Get XP and level info
- `GET /users/:id/muscle-groups` - Get muscle group ranks
- `GET /users/:id/progression` - Get progression history
- `POST /xp/calculate` - Calculate XP for workout (internal)

**Key Features**:
- XP calculation based on volume and difficulty
- Level progression with cumulative thresholds
- Muscle group rank tracking
- Listens to `WorkoutCompleted` events
- Publishes `LevelUp`, `RankUp` events

#### 5. Leaderboard Service (.NET 10)
**Responsibility**: Leaderboard ranking, position calculation, real-time updates
**Database**: PostgreSQL (leaderboards table), Redis (cached rankings)
**API Endpoints**:
- `GET /leaderboards/global` - Global leaderboard
- `GET /leaderboards/friends` - Friends leaderboard
- `GET /leaderboards/weekly` - Weekly leaderboard
- `GET /leaderboards/:type/position/:userId` - Get user's position

**Key Features**:
- Three leaderboard types (Global, Friends, Weekly)
- Real-time ranking updates via Redis sorted sets
- Weekly reset logic (Monday 00:00 UTC)
- User position and nearby competitors display
- Listens to `LevelUp` events for real-time updates

#### 6. Social Service (.NET 10)
**Responsibility**: Friend management, friend requests, social connections
**Database**: PostgreSQL (friendships table)
**API Endpoints**:
- `POST /friends/request` - Send friend request
- `POST /friends/request/:id/accept` - Accept friend request
- `POST /friends/request/:id/decline` - Decline friend request
- `DELETE /friends/:id` - Remove friend
- `GET /friends` - List friends
- `GET /users/search` - Search for users

**Key Features**:
- Friend request management
- Friendship CRUD operations
- User search functionality
- Friend list retrieval with status
- Publishes `FriendshipCreated` events

#### 7. Achievement Service (.NET 10)
**Responsibility**: Achievement definitions, unlock conditions, achievement tracking
**Database**: PostgreSQL (achievements, user_achievements tables)
**API Endpoints**:
- `GET /achievements` - List all achievements
- `GET /users/:id/achievements` - Get user's achievements
- `GET /users/:id/achievements/unlocked` - Get unlocked achievements
- `POST /achievements/:id/check` - Check unlock condition (internal)

**Key Features**:
- Achievement definition and metadata
- Rarity tier management (Common, Rare, Epic, Legendary)
- Unlock condition evaluation
- XP bonus distribution
- Listens to `WorkoutCompleted`, `LevelUp`, `StreakMilestone` events
- Publishes `AchievementUnlocked` events

#### 8. Sync Service (.NET 10)
**Responsibility**: Data synchronization, conflict resolution, offline sync queue
**Database**: PostgreSQL (sync_queue table)
**API Endpoints**:
- `POST /sync/pull` - Pull changes from cloud
- `POST /sync/push` - Push local changes to cloud
- `GET /sync/status` - Get sync status

**Key Features**:
- Bidirectional sync with conflict detection
- Last-write-wins conflict resolution
- Sync queue management with retry logic
- Exponential backoff for failed syncs
- Coordinates with other services for data consistency

#### 9. GPS/Route Service (.NET 10)
**Responsibility**: GPS tracking, route planning, distance/pace calculations
**Database**: PostgreSQL (gps_routes, gps_points tables)
**API Endpoints**:
- `POST /routes` - Create route
- `GET /routes` - List routes
- `GET /routes/:id` - Get route details
- `POST /routes/:id/rate` - Rate route
- `POST /gps/track` - Record GPS point (internal)
- `GET /gps/workout/:id` - Get GPS data for workout

**Key Features**:
- GPS coordinate recording and storage
- Distance and pace calculation
- Elevation change computation
- Route creation and navigation
- Signal loss handling
- Tiered data retention (raw 30 days, downsampled 1 year)

#### 10. Body Tracking Service (.NET 10)
**Responsibility**: Weight logging, measurements, progress photos
**Database**: PostgreSQL (body_weight, body_measurements, progress_photos tables)
**API Endpoints**:
- `POST /body/weight` - Log weight
- `GET /body/weight` - Get weight history
- `POST /body/measurements` - Log measurements
- `GET /body/measurements` - Get measurement history
- `POST /body/photos` - Upload progress photo
- `GET /body/photos` - Get photo gallery

**Key Features**:
- Weight and measurement logging
- Progress photo storage and gallery
- Photo comparison functionality
- Trend line calculation
- Image compression and storage (S3)

#### 11. Premium/Subscription Service (.NET 10)
**Responsibility**: Subscription management, premium feature gating, billing
**Database**: PostgreSQL (subscriptions table)
**API Endpoints**:
- `POST /subscription/upgrade` - Upgrade to premium
- `POST /subscription/cancel` - Cancel premium subscription
- `GET /subscription/status` - Get subscription status
- `POST /subscription/webhook` - Stripe webhook handler

**Key Features**:
- Subscription CRUD operations
- Premium feature gating
- Stripe integration for payments
- Subscription status validation
- Webhook handling for payment events

### Service Communication Patterns

#### Synchronous Communication (REST/gRPC)
- **REST APIs**: External client communication (mobile app)
- **gRPC**: Internal service-to-service communication for performance
- **API Gateway**: Kong or Nginx routes requests to appropriate services
- **Service Discovery**: Kubernetes DNS or Consul for service location

#### Asynchronous Communication (Message Queue)
- **Message Broker**: RabbitMQ or Azure Service Bus
- **Event Types**:
  - `WorkoutCompleted` - Published by Workout Service
  - `LevelUp` - Published by XP Service
  - `RankUp` - Published by XP Service
  - `StreakMilestone` - Published by Streak Service (future)
  - `AchievementUnlocked` - Published by Achievement Service
  - `FriendshipCreated` - Published by Social Service
  - `SubscriptionUpgraded` - Published by Premium Service

- **Event Subscribers**:
  - XP Service listens to `WorkoutCompleted`
  - Leaderboard Service listens to `LevelUp`
  - Achievement Service listens to `WorkoutCompleted`, `LevelUp`, `StreakMilestone`
  - Activity Feed Service listens to all events
  - Notification Service listens to all events

#### Data Consistency Strategy
- **Eventual Consistency**: Services eventually converge to consistent state
- **Saga Pattern**: Multi-service transactions use choreography (event-driven)
- **Event Sourcing**: Critical events logged for audit trail
- **CQRS**: Read models (leaderboards) separate from write models

### Database Strategy

#### Shared Databases
- **Users Database**: Shared by Auth, User Profile, and other services
  - Tables: users, user_preferences, user_xp, muscle_group_ranks
  - Replicated for read-heavy queries

#### Service-Specific Databases
- **Workout Service**: workouts, workout_exercises
- **Leaderboard Service**: leaderboards (cached in Redis)
- **Social Service**: friendships
- **Achievement Service**: achievements, user_achievements
- **Sync Service**: sync_queue
- **GPS Service**: gps_routes, gps_points
- **Body Tracking Service**: body_weight, body_measurements, progress_photos
- **Premium Service**: subscriptions

#### Caching Strategy
- **Redis Cluster**: Distributed caching for:
  - Leaderboard rankings (sorted sets)
  - User profile cache (1-hour TTL)
  - Exercise library cache (weekly update)
  - Session tokens (blacklist)
  - Rate limiting counters

### Deployment Architecture

#### Containerization
- **Docker Images**: Each microservice has its own Dockerfile
- **Image Registry**: Docker Hub or AWS ECR
- **Base Image**: mcr.microsoft.com/dotnet/aspnet:10.0

#### Kubernetes Orchestration
- **Namespace**: fitquest (all services in same namespace)
- **Deployments**: One per microservice with replicas (3+ for HA)
- **Services**: ClusterIP for internal communication, LoadBalancer for API Gateway
- **ConfigMaps**: Environment-specific configuration
- **Secrets**: API keys, database credentials, JWT secrets
- **StatefulSets**: For stateful services (if needed)
- **Ingress**: Route external traffic to API Gateway

#### Service Mesh (Optional)
- **Istio or Linkerd**: For advanced traffic management
- **Features**: Circuit breaking, retry logic, distributed tracing
- **Observability**: Metrics, logs, traces across services

#### Monitoring and Observability
- **Prometheus**: Metrics collection from all services
- **Grafana**: Visualization and dashboards
- **Jaeger/Zipkin**: Distributed tracing
- **ELK Stack or Loki**: Centralized logging
- **Alerts**: PagerDuty or similar for critical issues

## Components and Interfaces

### Core Components

#### 1. Authentication Service
- Email/password registration and login
- JWT token generation and refresh
- Password reset via email
- Session management
- Device fingerprinting for security

#### 2. User Profile Service
- Profile CRUD operations
- Preference management (goals, equipment, experience level)
- Profile picture upload and storage
- Bio and social information

#### 3. Workout Logger
- Workout creation and editing
- Exercise selection and set/rep/weight entry
- Real-time volume calculation
- Workout completion and XP calculation
- Offline storage and sync queue

#### 4. XP and Progression Engine
- XP calculation based on volume (volume / 100, minimum 10 XP)
- Level progression with cumulative thresholds
- Muscle group rank tracking and updates
- Level-up notifications and milestone rewards
- Rank progression thresholds

#### 5. Streak Manager
- Daily streak tracking
- Streak reset logic (24-hour window)
- Milestone reward distribution (7, 14, 30, 60, 100 days)
- Longest streak preservation

#### 6. Achievement System
- Achievement definition and metadata
- Unlock condition evaluation
- Rarity tier management (Common, Rare, Epic, Legendary)
- XP bonus distribution
- Achievement notification system

#### 7. Leaderboard Engine
- Global leaderboard ranking by total XP
- Friends leaderboard ranking
- Weekly leaderboard with reset logic
- Real-time ranking updates
- User position and nearby competitor display

#### 8. Social Network Service
- Friend request management
- Friendship CRUD operations
- Friends list retrieval
- Activity feed generation
- Challenge management

#### 9. Progress Tracker
- PR detection and update
- Volume calculation and trending
- Chart generation (line, bar, pie)
- Date range filtering
- Export functionality

#### 10. Body Tracker
- Weight logging and history
- Measurement logging (chest, waist, hips, arms, thighs)
- Progress photo storage and gallery
- Photo comparison functionality
- Trend line calculation

#### 11. Rest Timer
- Countdown timer with notifications
- Smart rest duration suggestions based on exercise type
- Manual duration adjustment
- Average rest duration calculation

#### 12. GPS Tracker
- Location permission handling
- GPS coordinate recording (every 10 seconds or 10m distance change)
- Distance, pace, and elevation calculation
- Real-time display during workout
- Signal loss handling and recovery

#### 13. Route Planner
- Route creation with start/end points
- Distance and time estimation
- Turn-by-turn navigation
- Route saving and sharing
- Rating and review system

#### 14. Sync Engine
- Conflict detection and resolution
- Bidirectional sync with cloud
- Sync queue management
- Retry logic with exponential backoff
- Last-write-wins conflict resolution

#### 15. AI Personal Trainer (Premium)
- Workout plan generation
- Exercise recommendation and adaptation
- Form tip generation
- Exercise variation suggestions
- Performance analysis and improvement recommendations

### API Endpoints (via API Gateway)

The API Gateway routes requests to appropriate microservices. All endpoints are accessed through the gateway at `https://api.fitquest.com`.

**Authentication Service**
- `POST /auth/register` - Create new account
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Invalidate session
- `POST /auth/password-reset` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm reset with token

**User Profile Service**
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update profile
- `GET /users/:id/preferences` - Get user preferences
- `PUT /users/:id/preferences` - Update preferences
- `POST /users/:id/avatar` - Upload profile picture
- `GET /users/search` - Search for users

**Workout Service**
- `POST /workouts` - Create workout
- `GET /workouts` - List user workouts (paginated)
- `GET /workouts/:id` - Get workout details
- `PUT /workouts/:id` - Update workout
- `DELETE /workouts/:id` - Delete workout
- `POST /workouts/:id/complete` - Mark workout complete

**Exercise Service**
- `GET /exercises` - List exercises (with search/filter)
- `GET /exercises/:id` - Get exercise details
- `GET /exercises/muscle-groups/:group` - Get exercises by muscle group

**XP and Progression Service**
- `GET /users/:id/xp` - Get XP and level info
- `GET /users/:id/muscle-groups` - Get muscle group ranks
- `GET /users/:id/progression` - Get progression history

**Achievement Service**
- `GET /achievements` - List all achievements
- `GET /users/:id/achievements` - Get user's achievements
- `GET /users/:id/achievements/unlocked` - Get unlocked achievements

**Leaderboard Service**
- `GET /leaderboards/global` - Global leaderboard
- `GET /leaderboards/friends` - Friends leaderboard
- `GET /leaderboards/weekly` - Weekly leaderboard
- `GET /leaderboards/:type/position/:userId` - Get user's position

**Social Service**
- `POST /friends/request` - Send friend request
- `POST /friends/request/:id/accept` - Accept friend request
- `POST /friends/request/:id/decline` - Decline friend request
- `DELETE /friends/:id` - Remove friend
- `GET /friends` - List friends
- `GET /activity-feed` - Get activity feed (paginated)

**Challenge Service**
- `POST /challenges` - Create challenge
- `GET /challenges` - List challenges
- `POST /challenges/:id/join` - Join challenge
- `GET /challenges/:id/progress` - Get challenge progress

**Progress Tracking Service**
- `GET /progress/prs` - Get personal records
- `GET /progress/volume` - Get volume data
- `GET /progress/charts/:type` - Get chart data

**Body Tracking Service**
- `POST /body/weight` - Log weight
- `GET /body/weight` - Get weight history
- `POST /body/measurements` - Log measurements
- `GET /body/measurements` - Get measurement history
- `POST /body/photos` - Upload progress photo
- `GET /body/photos` - Get photo gallery

**GPS/Route Service**
- `POST /routes` - Create route
- `GET /routes` - List routes
- `GET /routes/:id` - Get route details
- `POST /routes/:id/rate` - Rate route
- `GET /gps/workout/:id` - Get GPS data for workout

**Sync Service**
- `POST /sync/pull` - Pull changes from cloud
- `POST /sync/push` - Push local changes to cloud
- `GET /sync/status` - Get sync status

**Premium/Subscription Service**
- `POST /subscription/upgrade` - Upgrade to premium
- `POST /subscription/cancel` - Cancel premium subscription
- `GET /subscription/status` - Get subscription status

## Data Models

### Shared Data Models (Across Services)

#### User
```
{
  id: UUID (primary key)
  email: String (unique)
  passwordHash: String (bcrypt)
  name: String
  bio: String (optional)
  profilePictureUrl: String (optional)
  level: Integer (default: 1)
  totalXP: Integer (default: 0)
  currentStreak: Integer (default: 0)
  longestStreak: Integer (default: 0)
  createdAt: DateTime
  updatedAt: DateTime
  lastSyncAt: DateTime
  subscriptionTier: Enum (FREE, PREMIUM)
  subscriptionExpiresAt: DateTime (optional)
}
```

#### UserPreferences
```
{
  userId: UUID (foreign key)
  fitnessGoals: Array<Enum> (STRENGTH, ENDURANCE, WEIGHT_LOSS, MUSCLE_GAIN)
  experienceLevel: Enum (BEGINNER, INTERMEDIATE, ADVANCED)
  workoutFrequency: Integer (days per week)
  availableEquipment: Array<Enum> (DUMBBELLS, BARBELL, MACHINES, BODYWEIGHT, CABLES, KETTLEBELLS)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Exercise
```
{
  id: UUID (primary key)
  name: String (unique)
  description: String
  primaryMuscleGroup: Enum (CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE, CARDIO)
  secondaryMuscleGroups: Array<Enum>
  difficulty: Enum (BEGINNER, INTERMEDIATE, ADVANCED)
  equipment: Array<Enum>
  formTips: Array<String>
  videoUrl: String (optional)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Achievement
```
{
  id: UUID (primary key)
  name: String
  description: String
  rarity: Enum (COMMON, RARE, EPIC, LEGENDARY)
  category: Enum (STRENGTH, CONSISTENCY, SOCIAL, EXPLORATION)
  xpReward: Integer
  unlockedCondition: String (JSON formula)
  icon: String (URL)
  createdAt: DateTime
}
```

### Workout Service Data Models

#### Workout
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  startTime: DateTime
  endTime: DateTime (optional)
  duration: Integer (seconds)
  totalVolume: Integer (lbs)
  totalXP: Integer
  notes: String (optional)
  isOfflineCreated: Boolean (default: false)
  syncedAt: DateTime (optional)
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime (soft delete)
}
```

#### WorkoutExercise
```
{
  id: UUID (primary key)
  workoutId: UUID (foreign key)
  exerciseId: UUID (foreign key)
  order: Integer
  sets: Array<{
    reps: Integer
    weight: Integer (lbs)
    rpe: Integer (1-10, optional)
    notes: String (optional)
  }>
  totalVolume: Integer (calculated)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### XP & Progression Service Data Models

#### MuscleGroupRank
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  muscleGroup: Enum (CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE)
  rank: Integer (1-10)
  totalVolume: Integer (lbs)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### UserXP
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  totalXP: Integer
  currentLevel: Integer
  xpToNextLevel: Integer
  lastXPUpdate: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Achievement Service Data Models

#### UserAchievement
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  achievementId: UUID (foreign key)
  unlockedAt: DateTime
  createdAt: DateTime
}
```

### Leaderboard Service Data Models

#### Leaderboard (Cached in Redis)
```
{
  type: Enum (GLOBAL, FRIENDS, WEEKLY)
  userId: UUID
  rank: Integer
  xp: Integer
  level: Integer
  name: String
  timestamp: DateTime
}
```

### Social Service Data Models

#### Friendship
```
{
  id: UUID (primary key)
  userId1: UUID (foreign key)
  userId2: UUID (foreign key)
  status: Enum (PENDING, ACCEPTED, BLOCKED)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### ActivityFeedEntry
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  activityType: Enum (WORKOUT_COMPLETED, LEVEL_UP, ACHIEVEMENT_UNLOCKED, STREAK_MILESTONE, FRIEND_ADDED)
  relatedEntityId: UUID (workout/achievement/etc)
  metadata: JSON
  createdAt: DateTime
}
```

### Challenge Service Data Models

#### Challenge
```
{
  id: UUID (primary key)
  creatorId: UUID (foreign key)
  name: String
  description: String
  type: Enum (FRIEND, COMMUNITY)
  goalType: Enum (XP, VOLUME, STREAK)
  targetValue: Integer
  duration: Integer (days)
  startDate: DateTime
  endDate: DateTime
  participants: Array<UUID>
  createdAt: DateTime
}
```

#### ChallengeProgress
```
{
  id: UUID (primary key)
  challengeId: UUID (foreign key)
  userId: UUID (foreign key)
  currentValue: Integer
  rank: Integer
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Progress Tracking Service Data Models

#### PersonalRecord
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  exerciseId: UUID (foreign key)
  weight: Integer (lbs)
  reps: Integer
  recordedAt: DateTime
  createdAt: DateTime
}
```

### Body Tracking Service Data Models

#### BodyWeight
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  weight: Float (lbs)
  notes: String (optional)
  recordedAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### BodyMeasurement
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  chest: Float (inches, optional)
  waist: Float (inches, optional)
  hips: Float (inches, optional)
  arms: Float (inches, optional)
  thighs: Float (inches, optional)
  notes: String (optional)
  recordedAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### ProgressPhoto
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  imageUrl: String (S3 URL)
  thumbnailUrl: String (S3 URL)
  notes: String (optional)
  recordedAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

### GPS/Route Service Data Models

#### GPSRoute
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  name: String
  description: String
  coordinates: Array<{lat: Float, lng: Float, elevation: Float}>
  distance: Float (miles)
  estimatedTime: Integer (seconds)
  difficulty: Enum (EASY, MODERATE, HARD)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### GPSPoint
```
{
  id: UUID (primary key)
  workoutId: UUID (foreign key)
  latitude: Float
  longitude: Float
  elevation: Float (optional)
  accuracy: Float (meters)
  timestamp: DateTime
  createdAt: DateTime
}
```

### Sync Service Data Models

#### SyncQueue
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  operation: Enum (CREATE, UPDATE, DELETE)
  entityType: Enum (WORKOUT, WEIGHT, MEASUREMENT, PHOTO)
  entityId: UUID
  payload: JSON
  status: Enum (PENDING, SYNCING, SYNCED, FAILED)
  retryCount: Integer (default: 0)
  lastError: String (optional)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Premium/Subscription Service Data Models

#### Subscription
```
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  tier: Enum (FREE, PREMIUM)
  stripeSubscriptionId: String (optional)
  stripeCustomerId: String (optional)
  startDate: DateTime
  endDate: DateTime (optional)
  autoRenew: Boolean (default: true)
  createdAt: DateTime
  updatedAt: DateTime
}
```


## Key Algorithms

### XP Calculation Algorithm

```
function calculateWorkoutXP(workout: Workout): Integer {
  baseXP = workout.totalVolume / 100
  minimumXP = 10
  
  // Apply difficulty multiplier based on exercise types
  difficultyMultiplier = calculateDifficultyMultiplier(workout.exercises)
  
  // Apply streak bonus (5% per day, max 50%)
  streakBonus = min(user.currentStreak * 0.05, 0.50)
  
  finalXP = max(baseXP * difficultyMultiplier * (1 + streakBonus), minimumXP)
  
  return round(finalXP)
}

function calculateDifficultyMultiplier(exercises: Array<Exercise>): Float {
  // Compound exercises (squat, deadlift, bench) = 1.2x
  // Isolation exercises = 1.0x
  // Cardio = 0.8x
  
  totalMultiplier = 0
  for each exercise in exercises {
    if exercise.type == COMPOUND: totalMultiplier += 1.2
    else if exercise.type == ISOLATION: totalMultiplier += 1.0
    else if exercise.type == CARDIO: totalMultiplier += 0.8
  }
  
  return totalMultiplier / exercises.length
}
```

### Level Progression Algorithm

```
function getLevelThreshold(level: Integer): Integer {
  // Exponential progression: each level requires more XP
  // Level 1: 0 XP
  // Level 2: 500 XP
  // Level 3: 1500 XP
  // Level 4: 3000 XP (cumulative)
  
  if level == 1: return 0
  
  baseXP = 500
  previousThreshold = getLevelThreshold(level - 1)
  incrementPerLevel = 500 + (level - 2) * 250
  
  return previousThreshold + incrementPerLevel
}

function updateUserLevel(user: User, newXP: Integer): {levelUp: Boolean, newLevel: Integer} {
  currentLevel = user.level
  
  while newXP >= getLevelThreshold(currentLevel + 1) {
    currentLevel += 1
    awardMilestoneReward(user, currentLevel)
    notifyLevelUp(user, currentLevel)
  }
  
  return {
    levelUp: currentLevel > user.level,
    newLevel: currentLevel
  }
}
```

### Streak Logic Algorithm

```
function updateStreak(user: User, workoutDate: DateTime): {streakIncremented: Boolean, milestone: Integer?} {
  lastWorkoutDate = getLastWorkoutDate(user)
  today = getCurrentDate()
  
  // Check if workout is from today
  if workoutDate.date != today:
    return {streakIncremented: false}
  
  // Check if streak should continue
  daysSinceLastWorkout = today - lastWorkoutDate.date
  
  if daysSinceLastWorkout == 1:
    // Consecutive day - increment streak
    user.currentStreak += 1
    milestone = checkStreakMilestone(user.currentStreak)
    if milestone:
      awardStreakMilestoneReward(user, milestone)
    return {streakIncremented: true, milestone: milestone}
  
  else if daysSinceLastWorkout > 1:
    // Streak broken - reset
    user.longestStreak = max(user.longestStreak, user.currentStreak)
    user.currentStreak = 1
    return {streakIncremented: false}
  
  else:
    // Already worked out today
    return {streakIncremented: false}
}

function checkStreakMilestone(streak: Integer): Integer? {
  milestones = [7, 14, 30, 60, 100]
  for each milestone in milestones:
    if streak == milestone:
      return milestone
  return null
}
```

### Muscle Group Rank Algorithm

```
function updateMuscleGroupRank(user: User, workout: Workout): void {
  for each exercise in workout.exercises {
    muscleGroup = exercise.primaryMuscleGroup
    volumeAdded = exercise.totalVolume
    
    rank = getUserMuscleGroupRank(user, muscleGroup)
    rank.totalVolume += volumeAdded
    
    newRank = calculateRankFromVolume(rank.totalVolume)
    
    if newRank > rank.rank:
      rank.rank = newRank
      notifyRankUp(user, muscleGroup, newRank)
  }
}

function calculateRankFromVolume(totalVolume: Integer): Integer {
  // Rank 1: 0 lbs
  // Rank 2: 5,000 lbs
  // Rank 3: 15,000 lbs
  // Rank 4: 30,000 lbs
  // Rank 5: 50,000 lbs
  // ... exponential growth
  
  thresholds = [0, 5000, 15000, 30000, 50000, 75000, 105000, 140000, 180000, 225000]
  
  for i = 0 to thresholds.length - 1:
    if totalVolume < thresholds[i]:
      return i
  
  return 10
}
```

### Sync Conflict Resolution Algorithm

```
function resolveSyncConflict(localData: Entity, cloudData: Entity): Entity {
  // Last-write-wins strategy using timestamps
  
  if localData.updatedAt > cloudData.updatedAt:
    return localData
  else if cloudData.updatedAt > localData.updatedAt:
    return cloudData
  else:
    // Same timestamp - use deterministic tiebreaker (e.g., local ID)
    if localData.id < cloudData.id:
      return localData
    else:
      return cloudData
}

function syncWorkout(localWorkout: Workout, cloudWorkout: Workout?): void {
  if cloudWorkout == null:
    // New workout - push to cloud
    pushToCloud(localWorkout)
  else:
    // Existing workout - check for conflicts
    resolved = resolveSyncConflict(localWorkout, cloudWorkout)
    
    if resolved == localWorkout:
      pushToCloud(localWorkout)
    else:
      updateLocal(cloudWorkout)
}
```

### Rest Timer Smart Suggestion Algorithm

```
function suggestRestDuration(exercise: Exercise, previousSets: Array<Set>): Integer {
  // Seconds
  
  exerciseType = exercise.type
  
  if exerciseType == STRENGTH:
    // Heavy compound lifts: 2-3 minutes
    baseDuration = 150 // seconds
    variance = 30
  
  else if exerciseType == HYPERTROPHY:
    // Moderate weight: 60-90 seconds
    baseDuration = 75
    variance = 15
  
  else if exerciseType == ENDURANCE:
    // Light weight/high reps: 30-45 seconds
    baseDuration = 37
    variance = 8
  
  else:
    baseDuration = 60
    variance = 10
  
  // Adjust based on user's average rest duration
  userAverage = calculateUserAverageRest(exercise)
  adjustment = (userAverage - baseDuration) * 0.3 // 30% weight to user preference
  
  suggested = baseDuration + adjustment
  
  return clamp(suggested, baseDuration - variance, baseDuration + variance)
}
```

### AI Workout Generation Algorithm (Premium)

```
function generatePersonalizedWorkout(user: User, preferences: WorkoutPreferences): Workout {
  // 1. Determine focus based on user goals and recent history
  focusMuscleGroups = determineFocusAreas(user)
  
  // 2. Select exercises based on:
  //    - Available equipment
  //    - Experience level
  //    - Recent exercise history (avoid repetition)
  //    - Muscle group balance
  exercises = selectExercises(
    focusMuscleGroups,
    user.preferences.availableEquipment,
    user.preferences.experienceLevel,
    user.recentExercises
  )
  
  // 3. Determine sets/reps based on goal
  if user.goals.includes(STRENGTH):
    setsReps = {sets: 4-5, reps: 3-6}
  else if user.goals.includes(HYPERTROPHY):
    setsReps = {sets: 3-4, reps: 8-12}
  else if user.goals.includes(ENDURANCE):
    setsReps = {sets: 2-3, reps: 15-20}
  
  // 4. Estimate weights based on user's PRs
  for each exercise in exercises:
    estimatedWeight = estimateWorkingWeight(user, exercise)
    exercise.suggestedWeight = estimatedWeight
  
  // 5. Adapt based on recent performance
  if user.recentWorkouts show declining performance:
    setsReps.sets -= 1 // Reduce volume
  else if user.recentWorkouts show strong performance:
    setsReps.sets += 1 // Increase volume
  
  return createWorkout(exercises, setsReps)
}
```

## Integration Points

### Apple Health Integration

**Read Operations**
- Step count (daily)
- Heart rate (during cardio)
- Calories burned (estimated)

**Write Operations**
- Workout data (duration, calories, distance)
- Weight entries
- Measurement data

**Sync Strategy**
- Bidirectional sync on app launch
- Conflict resolution: most recent timestamp wins
- Background sync every 6 hours

### Spotify Integration

**Authentication**
- OAuth 2.0 flow with Spotify
- Token refresh handling
- Scope: `streaming`, `user-read-playback-state`, `user-modify-playback-state`

**Features**
- Display currently playing track
- Play/pause/next/previous controls
- Playlist selection
- Workout playlist creation

**Implementation**
- Use Spotify SDK for iOS
- Fallback to system music player if Spotify not installed
- Cache playlist data locally

### GPS and Maps Integration

**Location Services**
- Request location permission on workout start
- Record GPS coordinates every 10 seconds or 10m distance change
- Calculate distance using Haversine formula
- Calculate elevation change from GPS altitude data

**Route Navigation**
- Use Apple Maps or Google Maps API
- Display turn-by-turn directions
- Calculate estimated time based on user's average pace
- Handle GPS signal loss gracefully

### Stripe Payment Integration

**Subscription Management**
- Create subscription on premium upgrade
- Handle subscription renewal
- Cancel subscription on user request
- Webhook handling for payment events

**Implementation**
- Use Stripe SDK for iOS
- Store subscription ID in user profile
- Validate subscription status on app launch

## Inter-Service Communication and Event Flow

### Event-Driven Architecture

The microservices communicate asynchronously through a message broker (RabbitMQ or Azure Service Bus) using an event-driven architecture. This enables loose coupling and scalability.

#### Key Events and Subscribers

**WorkoutCompleted Event**
- Published by: Workout Service
- Subscribers: XP Service, Achievement Service, Activity Feed Service, Notification Service
- Payload: `{ workoutId, userId, totalVolume, exercises[], timestamp }`
- Purpose: Trigger XP calculation, achievement checks, activity feed updates

**LevelUp Event**
- Published by: XP Service
- Subscribers: Leaderboard Service, Achievement Service, Activity Feed Service, Notification Service
- Payload: `{ userId, newLevel, totalXP, timestamp }`
- Purpose: Update leaderboards, check level-based achievements, notify user

**RankUp Event**
- Published by: XP Service
- Subscribers: Achievement Service, Activity Feed Service, Notification Service
- Payload: `{ userId, muscleGroup, newRank, totalVolume, timestamp }`
- Purpose: Check rank-based achievements, notify user

**AchievementUnlocked Event**
- Published by: Achievement Service
- Subscribers: Activity Feed Service, Notification Service, XP Service (for XP bonus)
- Payload: `{ userId, achievementId, rarity, xpReward, timestamp }`
- Purpose: Update activity feed, notify user, award XP bonus

**FriendshipCreated Event**
- Published by: Social Service
- Subscribers: Activity Feed Service, Notification Service
- Payload: `{ userId1, userId2, timestamp }`
- Purpose: Update activity feed, notify users

**SubscriptionUpgraded Event**
- Published by: Premium Service
- Subscribers: User Profile Service, Notification Service
- Payload: `{ userId, tier, expiresAt, timestamp }`
- Purpose: Update user profile, enable premium features

### Service-to-Service Communication

#### Synchronous (REST/gRPC)
- **Authentication**: Auth Service validates JWT tokens for all requests
- **User Lookup**: Services call User Profile Service to get user details
- **Exercise Lookup**: Services call Exercise Service for exercise metadata
- **Subscription Check**: Premium Service checks subscription status for feature gating

#### Asynchronous (Message Queue)
- **Event Publishing**: Services publish events to message broker
- **Event Subscription**: Services subscribe to relevant events
- **Dead Letter Queue**: Failed messages sent to DLQ for manual review
- **Retry Policy**: Exponential backoff (1s, 2s, 4s, 8s) for failed messages

### Data Consistency Patterns

#### Saga Pattern (Choreography)
Used for multi-service transactions like workout completion:

1. User completes workout
2. Workout Service creates workout, publishes `WorkoutCompleted` event
3. XP Service receives event, calculates XP, publishes `LevelUp` event (if applicable)
4. Achievement Service receives events, checks achievements, publishes `AchievementUnlocked` event (if applicable)
5. Leaderboard Service receives `LevelUp` event, updates rankings
6. Activity Feed Service receives all events, creates feed entries
7. Notification Service receives all events, sends notifications

#### Eventual Consistency
- Services eventually converge to consistent state
- Leaderboard rankings updated within 5 minutes
- Activity feed updated within 30 seconds
- User profile cache invalidated after 1 hour

#### Conflict Resolution
- Last-write-wins for concurrent updates
- Timestamps used as tiebreaker
- Idempotent operations prevent duplicate processing

## Design Decisions from Critical Review

This section documents key architectural decisions made during design review, including rationale and trade-offs.

### Decision 1: Microservices vs Monolith
**Decision**: Decompose monolithic Node.js backend into 11 independent .NET 10 microservices.

**Rationale**: 
- Independent scalability: Each service scales based on its own load
- Technology flexibility: Each service can use appropriate .NET patterns
- Team autonomy: Teams can develop and deploy services independently
- Fault isolation: Service failures don't cascade to entire system

**Trade-offs**:
- Increased operational complexity (Kubernetes, service mesh)
- Network latency between services
- Distributed tracing and debugging more complex
- Data consistency challenges (eventual consistency)

**Implementation**:
- Each service has its own Docker image and Kubernetes deployment
- Services communicate via REST APIs (external) and gRPC (internal)
- Asynchronous communication via message queue for events
- API Gateway routes all external requests

### Decision 2: API Gateway Pattern
**Decision**: Use API Gateway (Kong or Nginx) to route requests to microservices.

**Rationale**:
- Single entry point for clients
- Centralized authentication and authorization
- Rate limiting and request throttling
- Request/response transformation
- Service discovery abstraction

**Implementation**:
- Kong or Nginx deployed in front of services
- Routes configured for each service endpoint
- JWT validation at gateway level
- Rate limiting: 100 requests/minute per user
- Request logging and monitoring

### Decision 3: Event-Driven Architecture
**Decision**: Use message queue (RabbitMQ/Azure Service Bus) for asynchronous communication.

**Rationale**:
- Loose coupling between services
- Scalability: Services can process events at their own pace
- Resilience: Failed messages can be retried
- Audit trail: All events logged for debugging

**Trade-offs**:
- Eventual consistency instead of strong consistency
- Increased complexity in debugging
- Message ordering challenges

**Implementation**:
- RabbitMQ or Azure Service Bus as message broker
- Dead letter queue for failed messages
- Exponential backoff retry policy
- Event schema versioning for backward compatibility

### Decision 4: Database Strategy
**Decision**: Shared database for users/exercises, service-specific databases for other entities.

**Rationale**:
- Shared data (users, exercises) accessed by multiple services
- Service-specific data (workouts, achievements) isolated for scalability
- Reduces data duplication and consistency issues

**Trade-offs**:
- Shared database becomes bottleneck
- Cross-service queries require API calls
- Data ownership boundaries less clear

**Implementation**:
- PostgreSQL cluster with read replicas
- Connection pooling (PgBouncer) for shared database
- Service-specific schemas for isolation
- Redis for caching frequently accessed data

### Decision 5: Caching Strategy
**Decision**: Use Redis for caching leaderboards, user profiles, and exercise library.

**Rationale**:
- Reduces database load
- Improves response times
- Enables real-time leaderboard updates

**Implementation**:
- Redis sorted sets for leaderboard rankings
- User profile cache with 1-hour TTL
- Exercise library cache with weekly update
- Cache invalidation on data changes

### Decision 6: Service Discovery
**Decision**: Use Kubernetes DNS for service discovery.

**Rationale**:
- Built-in service discovery in Kubernetes
- Automatic load balancing
- Health checks and automatic failover

**Implementation**:
- Services registered as Kubernetes Services
- DNS names: `{service-name}.{namespace}.svc.cluster.local`
- ClusterIP services for internal communication
- LoadBalancer service for API Gateway

### Decision 7: Monitoring and Observability
**Decision**: Implement comprehensive monitoring with Prometheus, Grafana, and distributed tracing.

**Rationale**:
- Visibility into system behavior
- Early detection of issues
- Performance optimization insights

**Implementation**:
- Prometheus scrapes metrics from all services
- Grafana dashboards for visualization
- Jaeger/Zipkin for distributed tracing
- ELK Stack or Loki for centralized logging
- PagerDuty for alerting

### Decision 8: Deployment Strategy
**Decision**: Use Kubernetes for container orchestration and deployment.

**Rationale**:
- Industry standard for microservices
- Automatic scaling and self-healing
- Rolling updates with zero downtime
- Resource management and optimization

**Implementation**:
- Docker images for each service
- Kubernetes Deployments with 3+ replicas
- ConfigMaps for configuration
- Secrets for sensitive data
- Ingress for external traffic routing

### Decision 9: Authentication and Authorization
**Decision**: JWT tokens validated at API Gateway, service-to-service authentication via mTLS.

**Rationale**:
- Stateless authentication
- Scalable across services
- Secure service-to-service communication

**Implementation**:
- JWT tokens issued by Auth Service
- Token validation at API Gateway
- mTLS certificates for service-to-service communication
- Token refresh mechanism for long-lived sessions

### Decision 10: Premium Feature Gating
**Decision**: Server-side validation of subscription status for premium features.

**Rationale**:
- Secure: Cannot be bypassed by client
- Consistent: All services enforce same rules
- Auditable: All access attempts logged

**Implementation**:
- Premium Service provides subscription status API
- Services check subscription before allowing premium features
- Return 403 Forbidden for non-premium users
- Log all access attempts for fraud detectionling: keep 1 point per minute (60x reduction)

### Decision 11: Offline Sync Queue - Batching
**Decision**: Batch sync operations in groups of 10-20. If batch fails, retry entire batch. If single operation fails 3 times, mark as failed and notify user.

**Rationale**: Balances speed (batching) with reliability (retry logic).

**Implementation**:
- Sync queue processes in batches of 15
- If batch fails, retry entire batch with exponential backoff
- If single operation fails 3 times, mark as failed
- Notify user of failed operations
- Implement manual retry mechanism in settings

### Decision 12: Premium Feature Gating - Server-Side Validation
**Decision**: AI Trainer logic lives on server. Every request to `/ai/generate-workout` checks subscription status. Return 403 Forbidden if not premium. Log suspicious access attempts.

**Rationale**: Server-side validation is secure. Client-side logic can be reverse-engineered.

**Implementation**:
- All AI endpoints require subscription check
- Return 403 Forbidden for non-premium users
- Log all access attempts (including failed)
- Implement rate limiting per user
- Monitor for fraud patterns (e.g., repeated 403s from same user)

## Offline-First Sync Strategy

### Local Storage Architecture

```
SQLite Database Structure:
├── users (cached user data)
├── workouts (local + synced)
├── workout_exercises (local + synced)
├── exercises (cached exercise library)
├── muscle_group_ranks (local + synced)
├── achievements (cached achievement definitions)
├── user_achievements (local + synced)
├── personal_records (local + synced)
├── friendships (local + synced)
├── activity_feed (cached)
├── body_weight (local + synced)
├── body_measurements (local + synced)
├── progress_photos (local + synced)
└── sync_queue (pending operations)

React Native Storage Structure:
├── AsyncStorage (key-value pairs)
│   ├── user_token (JWT token)
│   ├── user_id (current user ID)
│   ├── last_sync_time (timestamp)
│   └── app_preferences (user settings)
├── react-native-keychain (secure storage)
│   ├── refresh_token (secure JWT refresh token)
│   └── device_fingerprint (device identifier)
└── FileSystem (media files)
    ├── /photos/ (progress photos)
    ├── /cache/ (exercise library, images)
    └── /temp/ (temporary files)
```

### Sync Queue Management

```
Sync Queue Entry:
{
  id: UUID
  operation: CREATE | UPDATE | DELETE
  entityType: WORKOUT | WEIGHT | MEASUREMENT | PHOTO
  entityId: UUID
  payload: JSON (full entity data)
  status: PENDING | SYNCING | SYNCED | FAILED
  retryCount: 0-3
  lastError: String?
  createdAt: DateTime
  updatedAt: DateTime
}

Sync Process:
1. User completes action (e.g., logs workout)
2. Data saved to local SQLite
3. Entry added to sync_queue with status PENDING
4. When connection available:
   a. Fetch all PENDING entries
   b. For each entry:
      - Set status to SYNCING
      - Send to appropriate microservice via API Gateway
      - If success: set status to SYNCED, delete from queue
      - If failure: increment retryCount, set status to FAILED
   c. Retry failed entries up to 3 times with exponential backoff
5. Display sync status indicator to user
```

### Sync Service Coordination

The Sync Service coordinates with other microservices to ensure data consistency:

1. **Pull Phase**: Fetch latest data from cloud services
   - User Profile Service: Get updated user data
   - Workout Service: Get updated workouts
   - Achievement Service: Get unlocked achievements
   - Leaderboard Service: Get current rankings
   - Body Tracking Service: Get weight/measurements

2. **Push Phase**: Send local changes to cloud services
   - Workout Service: Create/update/delete workouts
   - Body Tracking Service: Create/update weight/measurements
   - GPS Service: Upload GPS data
   - Sync Service: Manage sync queue

3. **Conflict Resolution**: Resolve conflicts using last-write-wins
   - Compare local and cloud timestamps
   - Use most recent version
   - Log conflicts for debugging

### Conflict Resolution Strategy

```
Scenario 1: Local-only changes
- User logs workout offline
- Sync queue entry created
- On connection: push to Workout Service
- Result: workout synced successfully

Scenario 2: Cloud-only changes
- User logs in on new device
- Cloud has newer data
- On app launch: pull from cloud services
- Result: local database updated

Scenario 3: Conflicting changes
- User edits workout on Device A (offline)
- User edits same workout on Device B (online)
- Device A comes online
- Conflict detected: Device A.updatedAt vs Device B.updatedAt
- Resolution: Use most recent timestamp
- Result: Winning version synced, losing version discarded

Scenario 4: Deletion conflicts
- User deletes workout on Device A (offline)
- User edits same workout on Device B (online)
- Device A comes online
- Conflict detected: DELETE vs UPDATE
- Resolution: Use most recent timestamp
- Result: If DELETE is more recent, deletion wins; otherwise update wins
```

### Data Consistency Guarantees

- **Eventual Consistency**: All devices converge to same state within 30 seconds
- **Last-Write-Wins**: Most recent timestamp determines final state
- **No Data Loss**: All operations logged in sync queue before deletion
- **Offline Capability**: 30 days of workout history available offline
- **Automatic Retry**: Failed syncs retry up to 3 times with exponential backoff

## Performance and Scalability

### Performance Targets

- App launch: < 1000ms
- Screen navigation: < 500ms
- Exercise search: < 200ms
- List scrolling: 60 FPS
- Workout logging: < 100ms per set entry
- API response time: < 200ms (p95)
- Leaderboard query: < 100ms

### Optimization Strategies

**Caching**
- Exercise library cached locally (updated weekly)
- User profile cached with 1-hour TTL
- Leaderboard cached in Redis with 5-minute TTL
- Achievement definitions cached (static)
- Redis cluster for distributed caching

**Lazy Loading**
- Images loaded on-demand with thumbnail preview
- Activity feed paginated (50 items per page)
- Leaderboards paginated (100 items per page)
- Charts rendered incrementally

**Database Optimization**
- Indexes on frequently queried columns (userId, createdAt, muscleGroup)
- Partitioning workouts by date for faster queries
- Denormalization of user level/XP for quick access
- Archive old data (> 2 years) to separate table
- Read replicas for read-heavy queries

**API Optimization**
- Response compression (gzip)
- CDN for static assets
- Rate limiting: 100 requests/minute per user
- Request batching for multiple queries
- GraphQL for flexible queries (reduce over-fetching)

**Microservice Optimization**
- gRPC for internal service-to-service communication (faster than REST)
- Connection pooling for database connections
- Circuit breaker pattern for resilience
- Caching at service level (Redis)

### Scalability Architecture

**Horizontal Scaling**
- Stateless microservices (can add/remove instances)
- Kubernetes auto-scaling based on CPU/memory
- Load balancer (Kubernetes Service) distributes traffic
- Database read replicas for read-heavy queries
- Redis cluster for distributed caching

**Database Scaling**
- PostgreSQL with connection pooling (PgBouncer)
- Read replicas for leaderboard queries
- Sharding by userId for workout data (future)
- Archive tables for historical data
- Partitioning by date for time-series data

**Message Queue Scaling**
- RabbitMQ cluster for high availability
- Multiple consumer instances for parallel processing
- Dead letter queue for failed messages
- Message persistence for durability

**Real-Time Features**
- WebSocket connections for live leaderboard updates
- Redis Pub/Sub for activity feed notifications
- Server-sent events (SSE) as fallback
- Horizontal scaling of WebSocket servers

### Monitoring and Observability

**Metrics Collection**
- Prometheus scrapes metrics from all services
- Custom metrics: request latency, error rate, business metrics
- Infrastructure metrics: CPU, memory, disk, network
- Application metrics: database query time, cache hit rate

**Visualization and Alerting**
- Grafana dashboards for visualization
- PagerDuty for alerting on critical issues
- Custom alerts for: high error rate, slow queries, sync failures
- SLA monitoring: 99.9% uptime target

**Distributed Tracing**
- Jaeger or Zipkin for request tracing
- Trace all requests across services
- Identify bottlenecks and latency issues
- Debug complex multi-service flows

**Centralized Logging**
- ELK Stack or Loki for log aggregation
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARN, ERROR
- Log retention: 30 days hot, 1 year cold storage

**Health Checks**
- Kubernetes liveness probes (restart if unhealthy)
- Kubernetes readiness probes (remove from load balancer if not ready)
- Service health endpoints for monitoring
- Database connection health checks


## Error Handling

### Network Error Handling

**Connection Loss**
- Graceful degradation: app continues functioning with cached data
- Sync queue stores pending operations
- Automatic retry with exponential backoff (1s, 2s, 4s, 8s)
- User notification: "Syncing..." indicator, then "Sync failed - will retry"

**API Errors**
- 4xx errors: Display user-friendly error message, don't retry
- 5xx errors: Retry with exponential backoff
- Timeout (> 30s): Treat as network error, queue for retry
- Rate limiting (429): Backoff for specified duration
- Circuit breaker: Stop sending requests if service is down

**Service-to-Service Errors**
- Retry with exponential backoff
- Circuit breaker pattern to prevent cascading failures
- Fallback to cached data if available
- Log all errors for debugging

**Sync Conflicts**
- Detect via timestamp comparison
- Resolve using last-write-wins
- Log conflict for debugging
- Notify user if data loss occurs

### Data Validation

**Workout Logging**
- Validate exercise exists in library
- Validate sets/reps/weight are positive integers
- Validate weight is reasonable (1-1000 lbs)
- Validate reps are reasonable (1-100)
- Validate duration is positive
- Flag suspicious patterns (anti-cheat)

**User Input**
- Email validation (RFC 5322 format)
- Password validation (min 8 chars, complexity requirements)
- Name validation (non-empty, max 100 chars)
- Bio validation (max 500 chars)

**GPS Data**
- Validate coordinates are within valid ranges (lat: -90 to 90, lng: -180 to 180)
- Validate altitude is reasonable (-500 to 30000 feet)
- Discard outliers (e.g., sudden 1000m jump)
- Validate distance calculation (max 50 miles per workout)

### Error Recovery

**Corrupted Local Database**
- Detect via integrity checks on app launch
- Attempt repair using SQLite PRAGMA integrity_check
- If repair fails: backup corrupted database, reinitialize
- Sync from cloud to restore data

**Failed Sync Operations**
- Retry up to 3 times with exponential backoff
- If all retries fail: mark as failed, notify user
- User can manually retry from settings
- Failed operations preserved in sync queue for later retry

**Authentication Failures**
- Invalid credentials: clear session, prompt re-login
- Expired token: refresh token automatically
- Refresh token expired: force re-login
- Account deleted: clear all local data, prompt re-registration

**Service Failures**
- API Gateway returns 503 Service Unavailable
- Client retries with exponential backoff
- Fallback to cached data if available
- Notify user of service degradation
- Automatic recovery when service comes back online

### Microservice-Specific Error Handling

**Authentication Service**
- Invalid credentials: return 401 Unauthorized
- Account locked (too many failed attempts): return 429 Too Many Requests
- Token expired: return 401 Unauthorized
- MFA required: return 403 Forbidden with MFA challenge

**Workout Service**
- Invalid exercise: return 400 Bad Request
- Workout not found: return 404 Not Found
- Unauthorized access: return 403 Forbidden
- Validation error: return 400 Bad Request with details

**XP Service**
- Invalid workout data: return 400 Bad Request
- Calculation error: return 500 Internal Server Error
- Database error: return 500 Internal Server Error

**Leaderboard Service**
- Leaderboard not found: return 404 Not Found
- User not on leaderboard: return 404 Not Found
- Cache miss: recalculate and return

**Sync Service**
- Conflict detected: resolve and return resolved data
- Sync queue full: return 429 Too Many Requests
- Database error: return 500 Internal Server Error

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

**Requirement 1: Authentication**
1.1 WHEN a user provides email and password, THE Authentication_System SHALL validate credentials and create an account
  Thoughts: This is testing account creation with valid credentials. We can generate random email/password pairs and verify account creation succeeds.
  Testable: yes - property

1.2 WHEN a user provides invalid credentials, THE Authentication_System SHALL return a descriptive error message
  Thoughts: This is testing error handling for invalid inputs. We can test various invalid credential formats and verify error messages are returned.
  Testable: yes - property

1.3 WHEN a user logs in with valid credentials, THE Authentication_System SHALL grant access to their account
  Thoughts: This is testing login with valid credentials. We can create an account, then verify login succeeds and returns a valid token.
  Testable: yes - property

1.4 WHEN a user logs out, THE Authentication_System SHALL clear session data and require re-authentication
  Thoughts: This is testing session cleanup. We can log in, then log out, then verify that accessing protected resources fails.
  Testable: yes - property

1.5 THE Authentication_System SHALL store passwords using industry-standard hashing (bcrypt or equivalent)
  Thoughts: This is testing password storage. We can verify that stored passwords are hashed and not plaintext.
  Testable: yes - property

1.6 WHEN a user requests password reset, THE Authentication_System SHALL send a secure reset link via email
  Thoughts: This is testing password reset flow. We can request a reset and verify a reset token is generated and email is sent.
  Testable: yes - example

**Requirement 5: Workout Logging**
5.1 WHEN a user starts a workout, THE Workout_Logger SHALL record start time and allow exercise selection
  Thoughts: This is testing workout creation. We can start a workout and verify start time is recorded.
  Testable: yes - property

5.2 WHEN a user adds an exercise, THE Workout_Logger SHALL allow entry of sets, reps, weight, and notes
  Thoughts: This is testing exercise entry. We can add an exercise with various set/rep/weight combinations and verify they're stored.
  Testable: yes - property

5.3 WHEN a user completes a set, THE Workout_Logger SHALL record the data and calculate volume (weight × reps × sets)
  Thoughts: This is testing volume calculation. We can enter sets and verify volume is calculated correctly.
  Testable: yes - property

5.4 WHEN a user completes a workout, THE Workout_Logger SHALL record end time, total duration, and total volume
  Thoughts: This is testing workout completion. We can complete a workout and verify all fields are recorded.
  Testable: yes - property

5.5 WHEN a user logs a workout, THE Workout_Logger SHALL calculate XP earned based on volume and exercise difficulty
  Thoughts: This is testing XP calculation. We can log workouts and verify XP is calculated correctly.
  Testable: yes - property

5.6 WHEN a user is offline, THE Workout_Logger SHALL store workout data locally and sync when connection is restored
  Thoughts: This is testing offline functionality. We can log a workout offline, then verify it syncs when online.
  Testable: yes - property

5.7 THE Workout_Logger SHALL support editing and deleting logged workouts within 24 hours of completion
  Thoughts: This is testing edit/delete functionality. We can edit/delete workouts and verify changes are applied.
  Testable: yes - property

**Requirement 6: XP and Progression**
6.1 WHEN a user completes a workout, THE XP_System SHALL award XP based on total volume (formula: volume / 100 = XP, minimum 10 XP)
  Thoughts: This is testing XP calculation formula. We can log workouts with various volumes and verify XP is calculated correctly.
  Testable: yes - property

6.2 WHEN a user accumulates XP, THE XP_System SHALL update their level based on cumulative XP thresholds
  Thoughts: This is testing level progression. We can accumulate XP and verify level updates at correct thresholds.
  Testable: yes - property

6.3 WHEN a user reaches a new level, THE XP_System SHALL display a level-up notification and award a milestone reward
  Thoughts: This is testing level-up notifications. We can reach a new level and verify notification is displayed.
  Testable: yes - example

6.4 THE XP_System SHALL track muscle group-specific XP and assign Muscle_Group_Ranks (Rank 1-10) based on volume trained per muscle group
  Thoughts: This is testing muscle group rank tracking. We can train specific muscle groups and verify ranks are updated.
  Testable: yes - property

6.5 WHEN a user trains a muscle group, THE XP_System SHALL update that muscle group's rank when volume thresholds are met
  Thoughts: This is testing rank threshold logic. We can train muscle groups and verify ranks update at correct thresholds.
  Testable: yes - property

6.6 THE XP_System SHALL display current level, XP progress to next level, and all muscle group ranks on the user's profile
  Thoughts: This is testing profile display. We can verify all progression data is displayed correctly.
  Testable: yes - property

**Requirement 7: Streak Tracking**
7.1 WHEN a user completes a workout in a day, THE Streak_System SHALL increment their current streak by 1
  Thoughts: This is testing streak increment. We can complete a workout and verify streak increases.
  Testable: yes - property

7.2 WHEN a user does not complete a workout for 24 hours, THE Streak_System SHALL reset their current streak to 0
  Thoughts: This is testing streak reset. We can skip a day and verify streak resets.
  Testable: yes - property

7.3 THE Streak_System SHALL track longest streak and display it on the user's profile
  Thoughts: This is testing longest streak tracking. We can build a streak and verify longest streak is recorded.
  Testable: yes - property

7.4 WHEN a user reaches streak milestones (7, 14, 30, 60, 100 days), THE Streak_System SHALL award milestone rewards
  Thoughts: This is testing milestone rewards. We can reach milestones and verify rewards are awarded.
  Testable: yes - property

7.5 WHEN a user's streak resets, THE Streak_System SHALL preserve the longest streak record
  Thoughts: This is testing that longest streak is preserved after reset. We can reset streak and verify longest streak is unchanged.
  Testable: yes - property

7.6 THE Streak_System SHALL display current streak, longest streak, and next milestone on the home screen
  Thoughts: This is testing display of streak data. We can verify all streak info is displayed.
  Testable: yes - property

**Requirement 8: Achievements**
8.1 THE Achievement_System SHALL define achievements with four rarity tiers: Common, Rare, Epic, Legendary
  Thoughts: This is testing achievement definition. We can verify achievements have correct rarity tiers.
  Testable: yes - property

8.2 THE Achievement_System SHALL include achievement categories: Strength, Consistency, Social, Exploration
  Thoughts: This is testing achievement categories. We can verify achievements are categorized correctly.
  Testable: yes - property

8.3 WHEN a user meets achievement criteria, THE Achievement_System SHALL unlock the achievement and display a notification
  Thoughts: This is testing achievement unlock. We can meet criteria and verify achievement unlocks.
  Testable: yes - property

8.4 WHEN a user unlocks an achievement, THE Achievement_System SHALL award XP bonus
  Thoughts: This is testing XP bonus for achievements. We can unlock achievements and verify XP is awarded.
  Testable: yes - property

8.5 THE Achievement_System SHALL display all achievements with locked/unlocked status, rarity tier, and unlock date
  Thoughts: This is testing achievement display. We can verify all achievement info is displayed.
  Testable: yes - property

8.6 THE Achievement_System SHALL include at least 50 achievements across all categories
  Thoughts: This is testing achievement count. We can verify at least 50 achievements exist.
  Testable: yes - example

**Requirement 9: Leaderboards**
9.1 THE Leaderboard_System SHALL provide three leaderboard types: Global, Friends, Weekly
  Thoughts: This is testing leaderboard types. We can verify all three types exist.
  Testable: yes - property

9.2 THE Leaderboard_System SHALL rank users by XP for Global and Friends leaderboards
  Thoughts: This is testing ranking logic. We can create users with different XP and verify ranking is correct.
  Testable: yes - property

9.3 THE Leaderboard_System SHALL rank users by XP earned in the current week for Weekly leaderboard
  Thoughts: This is testing weekly ranking. We can create users with different weekly XP and verify ranking is correct.
  Testable: yes - property

9.4 WHEN a user views a leaderboard, THE Leaderboard_System SHALL display top 100 users with rank, name, XP, and current level
  Thoughts: This is testing leaderboard display. We can verify top 100 users are displayed with correct info.
  Testable: yes - property

9.5 WHEN a user views a leaderboard, THE Leaderboard_System SHALL highlight the user's position and nearby competitors
  Thoughts: This is testing user position highlighting. We can verify user's position is highlighted.
  Testable: yes - property

9.6 THE Leaderboard_System SHALL update rankings in real-time as users complete workouts
  Thoughts: This is testing real-time updates. We can complete a workout and verify leaderboard updates immediately.
  Testable: yes - property

9.7 THE Leaderboard_System SHALL reset Weekly leaderboard every Monday at 00:00 UTC
  Thoughts: This is testing weekly reset. We can verify leaderboard resets at correct time.
  Testable: yes - example

**Requirement 13: Progress Tracking - PRs**
13.1 WHEN a user logs a workout with an exercise, THE Progress_Tracker SHALL compare the weight to the previous PR
  Thoughts: This is testing PR comparison. We can log workouts and verify PR comparison works.
  Testable: yes - property

13.2 IF the logged weight exceeds the previous PR, THE Progress_Tracker SHALL update the PR and display a notification
  Thoughts: This is testing PR update. We can log a heavier weight and verify PR updates.
  Testable: yes - property

13.3 THE Progress_Tracker SHALL track PR history with date, weight, and reps for each exercise
  Thoughts: This is testing PR history. We can verify PR history is tracked correctly.
  Testable: yes - property

13.4 THE Progress_Tracker SHALL calculate total volume per workout, per week, and per month
  Thoughts: This is testing volume calculation. We can verify volume is calculated correctly for different time periods.
  Testable: yes - property

13.5 THE Progress_Tracker SHALL display volume trends over time (weekly, monthly, yearly)
  Thoughts: This is testing trend display. We can verify trends are calculated and displayed.
  Testable: yes - property

13.6 THE Progress_Tracker SHALL allow filtering by muscle group or exercise
  Thoughts: This is testing filtering. We can verify filtering works correctly.
  Testable: yes - property

**Requirement 20: GPS Tracking**
20.1 WHEN a user starts an outdoor cardio workout, THE GPS_Tracker SHALL request location permission and begin recording GPS coordinates
  Thoughts: This is testing GPS start. We can start a cardio workout and verify GPS recording begins.
  Testable: yes - property

20.2 THE GPS_Tracker SHALL record location every 10 seconds (or when distance changes by 10 meters)
  Thoughts: This is testing GPS recording frequency. We can verify GPS points are recorded at correct intervals.
  Testable: yes - property

20.3 WHEN a user completes a cardio workout, THE GPS_Tracker SHALL calculate total distance, average pace, and elevation change
  Thoughts: This is testing GPS calculations. We can complete a cardio workout and verify calculations are correct.
  Testable: yes - property

20.4 THE GPS_Tracker SHALL display real-time distance, pace, and elapsed time during the workout
  Thoughts: This is testing real-time display. We can verify GPS data is displayed during workout.
  Testable: yes - property

20.5 WHEN GPS signal is lost, THE GPS_Tracker SHALL pause tracking and resume when signal is restored
  Thoughts: This is testing signal loss handling. We can simulate signal loss and verify tracking pauses/resumes.
  Testable: yes - property

20.6 WHEN offline, THE GPS_Tracker SHALL store GPS data locally and sync when connection is restored
  Thoughts: This is testing offline GPS storage. We can record GPS offline and verify it syncs.
  Testable: yes - property

**Requirement 24: Offline-First Architecture**
24.1 WHEN the app is offline, THE Offline_System SHALL allow users to log workouts, view history, and access exercise library
  Thoughts: This is testing offline functionality. We can go offline and verify core features work.
  Testable: yes - property

24.2 WHEN the app is offline, THE Offline_System SHALL store all changes in local database
  Thoughts: This is testing local storage. We can make changes offline and verify they're stored locally.
  Testable: yes - property

24.3 WHEN internet connection is restored, THE Offline_System SHALL automatically sync local changes to cloud
  Thoughts: This is testing auto-sync. We can make changes offline, go online, and verify sync happens.
  Testable: yes - property

24.4 IF a sync conflict occurs, THE Offline_System SHALL resolve by using the most recent timestamp
  Thoughts: This is testing conflict resolution. We can create conflicts and verify resolution uses timestamps.
  Testable: yes - property

24.5 THE Offline_System SHALL display sync status indicator (synced, syncing, pending)
  Thoughts: This is testing status display. We can verify sync status is displayed correctly.
  Testable: yes - property

24.6 THE Offline_System SHALL maintain at least 30 days of workout history locally
  Thoughts: This is testing local storage capacity. We can verify 30 days of history is available offline.
  Testable: yes - property

**Requirement 25: Performance**
25.1 WHEN a user opens the app, THE Performance_System SHALL display the home screen within 1000ms
  Thoughts: This is testing app launch time. We can measure launch time and verify it's under 1000ms.
  Testable: yes - property

25.2 WHEN a user navigates between screens, THE Performance_System SHALL load content within 500ms
  Thoughts: This is testing screen navigation time. We can measure navigation time and verify it's under 500ms.
  Testable: yes - property

25.3 WHEN a user searches the exercise library, THE Performance_System SHALL return results within 200ms
  Thoughts: This is testing search performance. We can measure search time and verify it's under 200ms.
  Testable: yes - property

25.4 WHEN a user scrolls through lists, THE Performance_System SHALL maintain 60 FPS
  Thoughts: This is testing scroll performance. We can measure FPS during scrolling and verify it's 60 FPS.
  Testable: yes - property

25.5 THE Performance_System SHALL lazy-load images and defer non-critical content
  Thoughts: This is testing lazy loading. We can verify images are loaded on-demand.
  Testable: yes - property

25.6 THE Performance_System SHALL cache frequently accessed data
  Thoughts: This is testing caching. We can verify frequently accessed data is cached.
  Testable: yes - property

### Property Reflection

After analyzing all acceptance criteria, I've identified the following testable properties. Now I'll consolidate redundant properties:

**Consolidation Analysis:**
- Properties 5.1-5.7 (Workout logging) can be consolidated into one comprehensive property about workout creation and storage
- Properties 6.1-6.6 (XP system) can be consolidated into one property about XP calculation and level progression
- Properties 7.1-7.6 (Streak system) can be consolidated into one property about streak tracking and reset logic
- Properties 9.2-9.3 (Leaderboard ranking) can be consolidated into one property about ranking correctness
- Properties 13.1-13.6 (Progress tracking) can be consolidated into one property about PR and volume tracking
- Properties 20.1-20.6 (GPS tracking) can be consolidated into one property about GPS recording and calculation
- Properties 24.1-24.6 (Offline-first) can be consolidated into one property about offline functionality and sync

This consolidation reduces redundancy while maintaining comprehensive coverage.


## Correctness Properties

### Property 1: Authentication Round Trip

*For any* valid email and password combination, registering an account, logging out, and then logging back in with the same credentials should result in successful authentication and access to the same user account.

**Validates: Requirements 1.1, 1.3, 1.4**

### Property 2: Invalid Credentials Rejection

*For any* invalid email format or password that doesn't meet requirements, attempting to register or login should fail with a descriptive error message and not create/access an account.

**Validates: Requirements 1.2**

### Property 3: Password Hashing

*For any* user account, the stored password hash should not be equal to the plaintext password, and the same plaintext password should consistently hash to the same value.

**Validates: Requirements 1.5**

### Property 4: Workout Creation and Storage

*For any* workout with exercises, sets, reps, and weights, completing the workout should result in the workout being stored locally with correct start time, end time, duration, and total volume (sum of weight × reps × sets for all exercises).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**

### Property 5: XP Calculation Correctness

*For any* completed workout, the XP awarded should equal max(volume / 100, 10) multiplied by the exercise difficulty multiplier, and the user's total XP should increase by exactly that amount.

**Validates: Requirements 5.5, 6.1**

### Property 6: Level Progression

*For any* user, when total XP reaches or exceeds the threshold for a new level, the user's level should increase by 1, and the user should not skip levels.

**Validates: Requirements 6.2**

### Property 7: Muscle Group Rank Tracking

*For any* muscle group, the total volume trained in that group should equal the sum of all volumes from exercises targeting that muscle group, and the rank should correspond to the correct volume threshold.

**Validates: Requirements 6.4, 6.5**

### Property 8: Streak Increment and Reset

*For any* user, completing a workout on consecutive days should increment the current streak by 1 each day, and not completing a workout for 24 hours should reset the current streak to 0 while preserving the longest streak.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 9: Streak Milestone Rewards

*For any* user reaching a streak milestone (7, 14, 30, 60, or 100 days), the system should award the corresponding milestone reward exactly once.

**Validates: Requirements 7.4**

### Property 10: Achievement Unlock Correctness

*For any* achievement with defined unlock criteria, when a user meets those criteria, the achievement should be unlocked exactly once, and the user should receive the correct XP bonus based on rarity tier (Common: 25, Rare: 50, Epic: 100, Legendary: 250).

**Validates: Requirements 8.3, 8.4**

### Property 11: Achievement Metadata

*For any* achievement, the system should store and display the achievement's name, description, rarity tier, category, and unlock date (if unlocked).

**Validates: Requirements 8.1, 8.2, 8.5**

### Property 12: Leaderboard Ranking Correctness

*For any* leaderboard (Global, Friends, or Weekly), users should be ranked in descending order by their XP (total XP for Global/Friends, weekly XP for Weekly), and the ranking should be consistent across multiple queries.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 13: Leaderboard User Position

*For any* user viewing a leaderboard, the user's position should be correctly calculated and highlighted, and nearby competitors (±5 positions) should be visible.

**Validates: Requirements 9.5**

### Property 14: Personal Record Tracking

*For any* exercise, when a user logs a weight that exceeds their previous PR for that exercise, the PR should be updated to the new weight, and the PR history should include the date, weight, and reps.

**Validates: Requirements 13.1, 13.2, 13.3**

### Property 15: Volume Calculation and Trending

*For any* time period (workout, week, month), the total volume should equal the sum of (weight × reps × sets) for all exercises in that period, and volume trends should show the correct progression over time.

**Validates: Requirements 13.4, 13.5, 13.6**

### Property 16: GPS Recording Accuracy

*For any* outdoor cardio workout, GPS coordinates should be recorded at intervals of 10 seconds or when distance changes by 10 meters, and the calculated distance should be within 5% of the actual distance traveled.

**Validates: Requirements 20.1, 20.2, 20.3, 20.4**

### Property 17: GPS Signal Loss Handling

*For any* GPS tracking session, if GPS signal is lost and then restored, tracking should pause during signal loss and resume when signal is restored, with no data loss.

**Validates: Requirements 20.5**

### Property 18: Offline Workout Logging

*For any* workout logged while offline, the workout should be stored in the local database, and when internet connection is restored, the workout should be synced to the cloud without data loss.

**Validates: Requirements 5.6, 20.6, 24.1, 24.2, 24.3**

### Property 19: Sync Conflict Resolution

*For any* sync conflict where the same entity is modified on multiple devices, the conflict should be resolved using the most recent timestamp, and the final state should be consistent across all devices.

**Validates: Requirements 24.4**

### Property 20: Offline Data Availability

*For any* user with at least 30 days of workout history, the app should be able to display all workouts, exercises, and progress data from the past 30 days while offline.

**Validates: Requirements 24.6**

### Property 21: App Launch Performance

*For any* app launch, the home screen should be displayed within 1000 milliseconds, and all critical UI elements should be interactive within that time.

**Validates: Requirements 25.1**

### Property 22: Screen Navigation Performance

*For any* navigation between screens, the destination screen should load and display content within 500 milliseconds.

**Validates: Requirements 25.2**

### Property 23: Exercise Search Performance

*For any* search query in the exercise library, results should be returned within 200 milliseconds, and results should include all exercises matching the query.

**Validates: Requirements 25.3**

### Property 24: Scroll Performance

*For any* scrolling through lists (workouts, leaderboards, activity feed), the frame rate should remain at or above 60 FPS, and scrolling should be smooth without stuttering.

**Validates: Requirements 25.4**

### Property 25: Data Caching

*For any* frequently accessed data (exercise library, user profile, leaderboard), the data should be cached locally, and subsequent accesses should return cached data within 50 milliseconds.

**Validates: Requirements 25.5, 25.6**

### Property 26: Friend Request Round Trip

*For any* friend request, sending a request, accepting it, and then querying the friends list should result in the two users appearing in each other's friends list.

**Validates: Requirements 10.2, 10.3, 10.5**

### Property 27: Activity Feed Consistency

*For any* friend's activity (workout completed, level reached, achievement unlocked), the activity should appear in the user's activity feed within 5 seconds (or immediately if online), and activities should be displayed in reverse chronological order.

**Validates: Requirements 11.1, 11.2, 11.4**

### Property 28: Challenge Progress Tracking

*For any* active challenge, participant progress should be tracked correctly, and rankings should be updated in real-time as participants complete workouts.

**Validates: Requirements 12.4, 12.5**

### Property 29: Body Weight Tracking

*For any* weight entry, the weight should be stored with the date and optional notes, and weight history should display a trend line showing weight changes over time.

**Validates: Requirements 15.1, 15.2**

### Property 30: Body Measurement Tracking

*For any* measurement entry, all measurements (chest, waist, hips, arms, thighs) should be stored with the date, and change calculations should show the difference between current and previous measurements.

**Validates: Requirements 15.3, 15.4**

### Property 31: Progress Photo Storage

*For any* progress photo uploaded, the photo should be stored with the date and optional notes, and the photo should be retrievable from the gallery with correct date labels.

**Validates: Requirements 16.1, 16.2**

### Property 32: Rest Timer Suggestions

*For any* exercise type, the suggested rest duration should fall within the appropriate range (Strength: 120-180 seconds, Hypertrophy: 60-90 seconds, Endurance: 30-45 seconds), and suggestions should adapt based on user's average rest duration.

**Validates: Requirements 17.4**

### Property 33: Premium Feature Access

*For any* user with an active premium subscription, all premium features (AI Personal Trainer, all widgets, ad-free experience) should be accessible, and features should be revoked when subscription expires.

**Validates: Requirements 27.1-27.6, 29.2**

### Property 34: Free Tier Limitations

*For any* user on the free tier, premium features should not be accessible, and the user should see ads on designated screens.

**Validates: Requirements 28.2, 28.3, 28.4**

### Property 35: Apple Health Sync

*For any* workout completed in FitQuest, the workout data should be written to Apple Health (duration, calories, distance), and weight entries should be synced bidirectionally with Apple Health.

**Validates: Requirements 22.2, 22.3, 22.5**

### Property 36: Spotify Integration

*For any* user with Spotify authorization, the app should display currently playing track and artist, and playback controls should work correctly during workouts.

**Validates: Requirements 19.2, 19.4**

### Property 37: Route Navigation

*For any* saved route, the app should display turn-by-turn navigation, calculate estimated time based on user's average pace, and allow the user to complete the route with GPS tracking.

**Validates: Requirements 21.3, 21.4**

### Property 38: Data Export

*For any* user requesting a data export, the system should provide all personal data in standard formats (JSON, CSV) within 24 hours.

**Validates: Requirements 26.6**

### Property 39: Account Deletion

*For any* user deleting their account, all personal data should be permanently deleted from the system within 30 days, and the account should not be recoverable.

**Validates: Requirements 26.4**

### Property 40: Data Encryption

*For any* user data at rest, the data should be encrypted using AES-256 encryption, and data in transit should be encrypted using TLS 1.2 or higher.

**Validates: Requirements 26.1, 26.2**


## Testing Strategy

### Dual Testing Approach

FitQuest employs both unit testing and property-based testing to ensure comprehensive correctness:

**Unit Testing**
- Specific examples and edge cases
- Integration points between components
- Error conditions and recovery scenarios
- UI interactions and state management
- External API integrations (Apple Health, Spotify, Stripe)

**Property-Based Testing**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Correctness of core algorithms (XP calculation, streak logic, sync)
- Data consistency across operations
- Performance characteristics

### Unit Testing Strategy

**Test Framework**
- Mobile: Jest with TypeScript support
- Backend: Jest with TypeScript support
- Mocking: jest.mock() for dependencies (axios, AsyncStorage, Keychain, DatabaseManager)
- Coverage: Aim for 80%+ code coverage

**Test Categories**

1. **Authentication Tests**
   - Valid registration with various email formats
   - Invalid credentials (wrong password, non-existent user)
   - Password reset flow
   - Token refresh and expiration
   - Session cleanup on logout

2. **Workout Logging Tests**
   - Create workout with various exercise combinations
   - Edit and delete workouts
   - Offline workout creation and sync
   - Volume calculation for different set/rep/weight combinations
   - XP calculation with difficulty multipliers

3. **Progression Tests**
   - Level-up notifications at correct thresholds
   - Muscle group rank updates
   - Streak increment and reset
   - Milestone reward distribution
   - Achievement unlock notifications

4. **Social Features Tests**
   - Friend request send/accept/decline
   - Activity feed generation and pagination
   - Challenge creation and participation
   - Leaderboard ranking and position calculation

5. **Progress Tracking Tests**
   - PR detection and update
   - Volume trending calculations
   - Chart generation and export
   - Body weight and measurement tracking
   - Progress photo upload and gallery display

6. **GPS and Location Tests**
   - GPS coordinate recording at correct intervals
   - Distance and pace calculation
   - Signal loss and recovery
   - Offline GPS data storage and sync

7. **Offline and Sync Tests**
   - Local database operations
   - Sync queue management
   - Conflict detection and resolution
   - Retry logic with exponential backoff
   - Data consistency after sync

8. **Performance Tests**
   - App launch time (< 1000ms)
   - Screen navigation time (< 500ms)
   - Search performance (< 200ms)
   - Scroll frame rate (60 FPS)
   - Cache hit rates

9. **Integration Tests**
   - Apple Health read/write operations
   - Spotify authentication and playback
   - Stripe subscription management
   - Google Maps route navigation
   - Email delivery for password reset

10. **Error Handling Tests**
    - Network error recovery
    - Corrupted database recovery
    - Invalid user input handling
    - API error responses
    - Timeout handling

### Property-Based Testing Strategy

**Testing Framework**
- Mobile: fast-check (JavaScript property-based testing)
- Backend: fast-check (JavaScript property-based testing)
- Minimum 100 iterations per property test
- Seed-based reproducibility for failed tests

**Property Test Implementation**

Each correctness property will be implemented as a single property-based test with the following structure:

```typescript
// Example: Property 1 - Authentication Round Trip
describe('Property 1: Authentication Round Trip', () => {
  it('should authenticate user round trip', () => {
    fc.assert(
      fc.property(validEmailGenerator, validPasswordGenerator, (email, password) => {
        // 1. Register with credentials
        const registerResult = authService.register(email, password);
        if (!registerResult.success) return false;
        const user = registerResult.user;
        
        // 2. Logout
        authService.logout();
        
        // 3. Login with same credentials
        const loginResult = authService.login(email, password);
        if (!loginResult.success) return false;
        const loggedInUser = loginResult.user;
        
        // 4. Verify same user account
        return user.id === loggedInUser.id && user.email === loggedInUser.email;
      }),
      { numRuns: 100 }
    );
  });
});
```

**Property Test Configuration**

- Minimum iterations: 100
- Timeout per iteration: 5 seconds
- Seed: deterministic for reproducibility
- Shrinking: enabled to find minimal failing examples
- Tag format: `Feature: fitquest-gamified-fitness, Property {number}: {property_text}`

**Generator Strategies**

1. **User Data Generators**
   - Valid emails: RFC 5322 compliant
   - Valid passwords: 8+ chars, mixed case, numbers, symbols
   - User IDs: UUIDs
   - Timestamps: realistic date ranges

2. **Workout Data Generators**
   - Exercise IDs: from exercise library
   - Sets/reps: 1-10 sets, 1-100 reps
   - Weights: 1-1000 lbs
   - Durations: 1-300 minutes

3. **GPS Data Generators**
   - Coordinates: valid lat/lng ranges
   - Elevation: -500 to 30000 feet
   - Timestamps: sequential with 10-second intervals
   - Distance changes: 0-50 meters per point

4. **Time Data Generators**
   - Dates: past 2 years
   - Times: 00:00-23:59
   - Durations: 1 second to 24 hours
   - Intervals: realistic workout spacing

5. **Edge Case Generators**
   - Empty strings and whitespace
   - Boundary values (0, max int, min int)
   - Null/undefined values
   - Duplicate data
   - Out-of-order data

### Test Coverage Goals

- **Unit Tests**: 80% code coverage
- **Property Tests**: All 40 correctness properties implemented
- **Integration Tests**: All external APIs tested
- **Performance Tests**: All performance targets verified
- **Error Handling**: All error paths tested

### Continuous Integration

**Test Execution**
- Unit tests: Run on every commit
- Property tests: Run on every commit (100 iterations)
- Integration tests: Run on PR creation
- Performance tests: Run nightly
- Full test suite: Run before release

**Test Reporting**
- Coverage reports: Codecov integration
- Performance metrics: DataDog dashboard
- Failed test analysis: Sentry integration
- Property test shrinking: Detailed failure reports

### Test Data Management

**Fixtures**
- Pre-built user accounts for testing
- Sample workouts with various exercise combinations
- Leaderboard data with multiple users
- Achievement definitions and unlock conditions

**Database Seeding**
- Test database initialized with fixtures
- Rollback after each test
- Parallel test execution with isolated databases

### Regression Testing

**Automated Regression Suite**
- All previously fixed bugs included as test cases
- Property tests prevent regression of fixed issues
- Performance benchmarks prevent performance regressions

**Manual Testing**
- User acceptance testing before release
- Cross-device testing (multiple iOS/Android versions)
- Network condition testing (WiFi, 4G, 3G, offline)
- Battery and memory profiling

### Test Maintenance

**Test Review Process**
- Code review for all new tests
- Property test shrinking analysis for failures
- Regular test refactoring to reduce duplication
- Deprecation of obsolete tests

**Test Documentation**
- Each test includes clear description of what it validates
- Property tests include generator documentation
- Edge cases documented with rationale
- Known limitations and workarounds documented

