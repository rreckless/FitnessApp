# Implementation Plan: FitQuest Gamified Fitness

## Overview

FitQuest is implemented across two platforms: iOS (Swift) for the mobile app and Node.js for the backend. The implementation follows an offline-first architecture with cloud synchronization, enabling users to log workouts without internet while maintaining data consistency across devices. Tasks are organized into seven phases, each building on previous work to deliver incremental value.

## Phase 1: Foundation (Authentication, Data Models, Core Infrastructure)

- [x] 1.1 Set up project structure and core infrastructure
  - Create iOS project with SwiftUI and backend Node.js/Express project
  - Set up SQLite database schema with GRDB for iOS
  - Set up PostgreSQL database schema for backend
  - Configure environment variables and configuration management
  - Set up logging and error tracking (Sentry)
  - _Requirements: 1.0, 24.0, 25.0_

- [x] 1.2 Implement authentication service (backend)
  - Create user registration endpoint with email validation and bcrypt password hashing
  - Create login endpoint with JWT token generation
  - Create token refresh endpoint with refresh token rotation
  - Create logout endpoint with session invalidation
  - Implement password reset flow with email verification
  - Add rate limiting to prevent brute force attacks
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 1.3 Write property test for authentication round trip
  - **Property 1: Authentication Round Trip**
  - **Validates: Requirements 1.1, 1.3, 1.4**

- [x] 1.4 Implement authentication service (iOS)
  - Create AuthenticationService with login/register/logout methods
  - Implement secure token storage using Keychain
  - Create JWT token refresh logic with automatic refresh before expiration
  - Implement session management and device fingerprinting
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 1.5 Write unit tests for authentication (iOS)
  - Test valid registration and login flows
  - Test invalid credentials rejection
  - Test password reset flow
  - Test token refresh and expiration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 1.6 Implement user profile service (backend)
  - Create user profile CRUD endpoints
  - Create user preferences endpoints (goals, equipment, experience level)
  - Implement profile picture upload to S3
  - Add profile validation and sanitization
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 1.7 Implement user profile service (iOS)
  - Create UserProfileService with profile CRUD operations
  - Implement profile picture upload and caching
  - Create preference management UI and storage
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 1.8 Implement onboarding flow (iOS)
  - Create onboarding screens for goal selection, experience level, workout frequency, equipment
  - Implement preference persistence to local database
  - Create onboarding completion logic that initializes user at Level 1 with 0 XP
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 1.9 Write unit tests for user profile and onboarding
  - Test profile CRUD operations
  - Test preference persistence
  - Test onboarding flow completion
  - _Requirements: 2.0, 3.0_

- [x] 1.10 Create exercise library (backend)
  - Create exercise database with 200+ exercises
  - Implement exercise search and filtering by muscle group
  - Create exercise library API endpoints
  - Add exercise caching strategy (weekly updates)
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 1.11 Implement exercise library (iOS)
  - Create ExerciseLibraryService with local caching
  - Implement fuzzy search with offline support
  - Create exercise selection UI for workout logging
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 1.12 Write unit tests for exercise library
  - Test exercise search and filtering
  - Test offline availability
  - Test caching and updates
  - _Requirements: 4.0_

- [x] 1.13 Implement sync engine (iOS)
  - Create SyncEngine with offline-first architecture
  - Implement sync queue management with SQLite
  - Create conflict detection using timestamps
  - Implement last-write-wins conflict resolution
  - Add exponential backoff retry logic (1s, 2s, 4s, 8s)
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [x] 1.14 Write property test for sync conflict resolution
  - **Property 19: Sync Conflict Resolution**
  - **Validates: Requirements 24.4**

- [x] 1.15 Implement sync API endpoints (backend)
  - Create `/sync/pull` endpoint for pulling changes from cloud
  - Create `/sync/push` endpoint for pushing local changes to cloud
  - Create `/sync/status` endpoint for sync status
  - Implement server-side conflict resolution with timestamp validation
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [x] 1.16 Write unit tests for sync engine
  - Test sync queue operations
  - Test conflict detection and resolution
  - Test retry logic with exponential backoff
  - Test offline data persistence
  - _Requirements: 24.0_

- [x] 1.17 Checkpoint - Ensure all foundation tests pass
  - Ensure all unit tests pass for authentication, profiles, exercise library, and sync
  - Verify offline functionality works correctly
  - Ask the user if questions arise.


## Phase 2: Core Features (Workout Logging, XP System, Streaks, Achievements)

- [x] 2.1 Implement workout logger (iOS)
  - Create WorkoutLogger service with start/end time tracking
  - Implement exercise selection and set/rep/weight entry
  - Create volume calculation (weight × reps × sets)
  - Implement workout completion with XP calculation
  - Add offline storage to sync queue
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 2.2 Write property test for workout creation and storage
  - **Property 4: Workout Creation and Storage**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**

- [x] 2.3 Implement workout API endpoints (backend)
  - Create POST `/workouts` endpoint for workout creation
  - Create GET `/workouts` endpoint with pagination
  - Create GET `/workouts/:id` endpoint
  - Create PUT `/workouts/:id` endpoint for updates
  - Create DELETE `/workouts/:id` endpoint with soft delete
  - Create POST `/workouts/:id/complete` endpoint
  - Add XP calculation on workout completion
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 2.4 Write unit tests for workout logging
  - Test workout creation with various exercise combinations
  - Test volume calculation accuracy
  - Test offline storage and sync
  - Test edit and delete operations
  - _Requirements: 5.0_

- [x] 2.5 Implement XP calculation engine (backend)
  - Create XP calculation function: max(volume / 100, 10) × difficulty multiplier
  - Implement difficulty multiplier logic (compound: 1.2x, isolation: 1.0x, cardio: 0.8x)
  - Implement streak bonus calculation (5% per day, max 50%)
  - Add anti-cheat validation (max 50 reps/set, max 100 reps/exercise, weight 1-1000 lbs)
  - _Requirements: 6.1, 5.5_

- [x] 2.6 Write property test for XP calculation correctness
  - **Property 5: XP Calculation Correctness**
  - **Validates: Requirements 5.5, 6.1**

- [x] 2.7 Implement level progression system (backend)
  - Create level threshold calculation (exponential progression)
  - Implement level-up logic with cumulative XP thresholds
  - Create milestone reward distribution
  - Implement level-up notifications
  - _Requirements: 6.2, 6.3_

- [x] 2.8 Write property test for level progression
  - **Property 6: Level Progression**
  - **Validates: Requirements 6.2**

- [x] 2.9 Implement muscle group rank system (backend)
  - Create muscle group rank tracking by volume
  - Implement percentile-based rank thresholds (Rank 1-5 based on top 20%, 40%, 60%, 80%, 100%)
  - Create weekly batch job to recalculate percentiles
  - Implement rank-up notifications
  - _Requirements: 6.4, 6.5_

- [x] 2.10 Write property test for muscle group rank tracking
  - **Property 7: Muscle Group Rank Tracking**
  - **Validates: Requirements 6.4, 6.5**

- [x] 2.11 Implement muscle group rank service (iOS)
  - Create MuscleGroupRankService with local caching
  - Implement rank display on profile
  - Create rank-up notifications
  - _Requirements: 6.4, 6.5, 6.6_

- [x] 2.12 Implement streak tracking system (backend)
  - Create streak increment logic (24-hour UTC window)
  - Implement streak reset logic
  - Create longest streak preservation
  - Implement milestone detection (7, 14, 30, 60, 100 days)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2.13 Write property test for streak increment and reset
  - **Property 8: Streak Increment and Reset**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

- [x] 2.14 Write property test for streak milestone rewards
  - **Property 9: Streak Milestone Rewards**
  - **Validates: Requirements 7.4**

- [x] 2.15 Implement streak service (iOS)
  - Create StreakService with local tracking
  - Implement streak display on home screen
  - Create streak reset notifications
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2.16 Write unit tests for streak system
  - Test streak increment on consecutive days
  - Test streak reset after 24 hours
  - Test milestone reward distribution
  - Test longest streak preservation
  - _Requirements: 7.0_

- [x] 2.17 Implement achievement system (backend)
  - Create achievement definitions with rarity tiers (Common, Rare, Epic, Legendary)
  - Implement achievement categories (Strength, Consistency, Social, Exploration)
  - Create achievement unlock condition evaluation
  - Implement XP bonus distribution (Common: 25, Rare: 50, Epic: 100, Legendary: 250)
  - Create at least 50 achievements
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

- [x] 2.18 Write property test for achievement unlock correctness
  - **Property 10: Achievement Unlock Correctness**
  - **Validates: Requirements 8.3, 8.4**

- [x] 2.19 Write property test for achievement metadata
  - **Property 11: Achievement Metadata**
  - **Validates: Requirements 8.1, 8.2, 8.5**

- [x] 2.20 Implement achievement service (iOS)
  - Create AchievementService with local caching
  - Implement achievement unlock detection
  - Create achievement notification system
  - Implement achievement gallery display
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 2.21 Write unit tests for achievement system
  - Test achievement unlock conditions
  - Test XP bonus distribution
  - Test achievement notifications
  - Test achievement display and filtering
  - _Requirements: 8.0_

- [x] 2.22 Checkpoint - Ensure all core feature tests pass
  - Ensure all unit and property tests pass for workouts, XP, streaks, and achievements
  - Verify XP calculations are accurate
  - Verify streak logic handles edge cases
  - Ask the user if questions arise.


## Phase 3: Social & Progression (Leaderboards, Friends, Activity Feed, Challenges)

- [x] 3.1 Implement leaderboard system (backend)
  - Create global leaderboard ranking by total XP
  - Create friends leaderboard ranking by total XP
  - Create weekly leaderboard ranking by weekly XP with Monday reset
  - Implement Redis sorted set caching for O(log n) lookups
  - Create batch job to recalculate rankings every 5 minutes
  - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7_

- [x] 3.2 Write property test for leaderboard ranking correctness
  - **Property 12: Leaderboard Ranking Correctness**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 3.3 Implement leaderboard API endpoints (backend)
  - Create GET `/leaderboards/global` endpoint with pagination
  - Create GET `/leaderboards/friends` endpoint with pagination
  - Create GET `/leaderboards/weekly` endpoint with pagination
  - Create GET `/leaderboards/:type/position/:userId` endpoint for user position
  - Add nearby competitors display (±5 positions)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3.4 Write property test for leaderboard user position
  - **Property 13: Leaderboard User Position**
  - **Validates: Requirements 9.5**

- [ ] 3.5 Implement leaderboard service (iOS)
  - Create LeaderboardService with local caching
  - Implement leaderboard display with pagination
  - Create user position highlighting
  - Implement nearby competitors display
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 3.6 Write unit tests for leaderboard system
  - Test ranking calculation accuracy
  - Test pagination and position queries
  - Test weekly reset logic
  - Test caching and refresh
  - _Requirements: 9.0_

- [ ] 3.7 Implement friend system (backend)
  - Create POST `/friends/request` endpoint for sending friend requests
  - Create POST `/friends/request/:id/accept` endpoint
  - Create POST `/friends/request/:id/decline` endpoint
  - Create DELETE `/friends/:id` endpoint
  - Create GET `/friends` endpoint with list of friends
  - Implement friend request notifications
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 3.8 Write property test for friend request round trip
  - **Property 26: Friend Request Round Trip**
  - **Validates: Requirements 10.2, 10.3, 10.5**

- [ ] 3.9 Implement friend service (iOS)
  - Create FriendService with friend request management
  - Implement friend search by username/email
  - Create friend list display
  - Implement friend request notifications
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 3.10 Write unit tests for friend system
  - Test friend request send/accept/decline
  - Test friend list retrieval
  - Test friend removal
  - Test friend search
  - _Requirements: 10.0_

- [ ] 3.11 Implement activity feed (backend)
  - Create activity feed entry types (workout completed, level up, achievement unlocked, streak milestone, friend added)
  - Implement fan-out-on-write strategy with Redis
  - Create GET `/activity-feed` endpoint with pagination
  - Implement 5-second activity propagation to friends
  - Enforce 1,000 friend limit per user
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 3.12 Write property test for activity feed consistency
  - **Property 27: Activity Feed Consistency**
  - **Validates: Requirements 11.1, 11.2, 11.4**

- [ ] 3.13 Implement activity feed service (iOS)
  - Create ActivityFeedService with local caching
  - Implement activity feed display with pagination
  - Create activity notifications
  - Implement offline activity caching
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 3.14 Write unit tests for activity feed
  - Test activity entry creation
  - Test fan-out propagation
  - Test pagination and caching
  - Test offline availability
  - _Requirements: 11.0_

- [ ] 3.15 Implement challenge system (backend)
  - Create challenge types (Friend, Community)
  - Create challenge goal types (XP, Volume, Streak)
  - Create POST `/challenges` endpoint for challenge creation
  - Create GET `/challenges` endpoint with filtering
  - Create POST `/challenges/:id/join` endpoint
  - Create GET `/challenges/:id/progress` endpoint
  - Implement challenge ranking and result calculation
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 3.16 Write property test for challenge progress tracking
  - **Property 28: Challenge Progress Tracking**
  - **Validates: Requirements 12.4, 12.5**

- [ ] 3.17 Implement challenge service (iOS)
  - Create ChallengeService with challenge management
  - Implement challenge creation and joining
  - Create challenge progress display
  - Implement challenge notifications
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 3.18 Write unit tests for challenge system
  - Test challenge creation and joining
  - Test progress tracking and ranking
  - Test challenge completion and results
  - Test notifications
  - _Requirements: 12.0_

- [ ] 3.19 Checkpoint - Ensure all social feature tests pass
  - Ensure all unit and property tests pass for leaderboards, friends, activity feed, and challenges
  - Verify leaderboard rankings are accurate
  - Verify activity feed propagation works correctly
  - Ask the user if questions arise.


## Phase 4: Advanced Features (GPS Tracking, Body Tracking, Rest Timer, Widgets)

- [ ] 4.1 Implement progress tracking - PRs and volume (backend)
  - Create personal record tracking with date, weight, and reps
  - Implement PR detection on workout completion
  - Create volume calculation per workout, week, and month
  - Implement volume trending calculations
  - Create GET `/progress/prs` endpoint
  - Create GET `/progress/volume` endpoint
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [ ] 4.2 Write property test for personal record tracking
  - **Property 14: Personal Record Tracking**
  - **Validates: Requirements 13.1, 13.2, 13.3**

- [ ] 4.3 Write property test for volume calculation and trending
  - **Property 15: Volume Calculation and Trending**
  - **Validates: Requirements 13.4, 13.5, 13.6**

- [ ] 4.4 Implement progress tracking - Charts (backend)
  - Create chart generation endpoints for line, bar, and pie charts
  - Implement date range filtering
  - Create chart export functionality
  - Create GET `/progress/charts/:type` endpoint
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 4.5 Implement progress tracking service (iOS)
  - Create ProgressTrackerService with PR and volume tracking
  - Implement PR detection and notifications
  - Create chart display and export
  - Implement filtering by muscle group and exercise
  - _Requirements: 13.0, 14.0_

- [ ] 4.6 Write unit tests for progress tracking
  - Test PR detection and update
  - Test volume calculations
  - Test chart generation
  - Test filtering and export
  - _Requirements: 13.0, 14.0_

- [ ] 4.7 Implement body tracking - Weight and measurements (backend)
  - Create POST `/body/weight` endpoint for weight logging
  - Create GET `/body/weight` endpoint with history
  - Create POST `/body/measurements` endpoint
  - Create GET `/body/measurements` endpoint with history
  - Implement trend line calculation
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 4.8 Write property test for body weight tracking
  - **Property 29: Body Weight Tracking**
  - **Validates: Requirements 15.1, 15.2**

- [ ] 4.9 Write property test for body measurement tracking
  - **Property 30: Body Measurement Tracking**
  - **Validates: Requirements 15.3, 15.4**

- [ ] 4.10 Implement body tracking - Weight and measurements (iOS)
  - Create BodyTrackerService with weight and measurement logging
  - Implement weight history display with trend line
  - Create measurement history with change calculations
  - Implement edit and delete within 7 days
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 4.11 Implement body tracking - Progress photos (backend)
  - Create POST `/body/photos` endpoint for photo upload
  - Create GET `/body/photos` endpoint with gallery
  - Implement image compression (max 5MB)
  - Create photo comparison functionality
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [ ] 4.12 Write property test for progress photo storage
  - **Property 31: Progress Photo Storage**
  - **Validates: Requirements 16.1, 16.2**

- [ ] 4.13 Implement body tracking - Progress photos (iOS)
  - Create photo upload and gallery display
  - Implement side-by-side photo comparison
  - Create photo deletion with sync
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [ ] 4.14 Write unit tests for body tracking
  - Test weight and measurement logging
  - Test trend calculations
  - Test photo upload and gallery
  - Test comparison functionality
  - _Requirements: 15.0, 16.0_

- [ ] 4.15 Implement rest timer (iOS)
  - Create RestTimerService with countdown timer
  - Implement smart rest duration suggestions based on exercise type
  - Create manual duration adjustment (30-300 seconds)
  - Implement average rest duration calculation
  - Add notification sound on timer completion
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ] 4.16 Write property test for rest timer suggestions
  - **Property 32: Rest Timer Suggestions**
  - **Validates: Requirements 17.4**

- [ ] 4.17 Write unit tests for rest timer
  - Test timer countdown
  - Test smart suggestions
  - Test manual adjustment
  - Test average calculation
  - _Requirements: 17.0_

- [ ] 4.18 Implement GPS tracking (iOS)
  - Create GPSTrackerService with location permission handling
  - Implement GPS coordinate recording (every 10 seconds or 10m distance change)
  - Create distance, pace, and elevation calculation
  - Implement real-time display during workout
  - Add signal loss handling and recovery
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ] 4.19 Write property test for GPS recording accuracy
  - **Property 16: GPS Recording Accuracy**
  - **Validates: Requirements 20.1, 20.2, 20.3, 20.4**

- [ ] 4.20 Write property test for GPS signal loss handling
  - **Property 17: GPS Signal Loss Handling**
  - **Validates: Requirements 20.5**

- [ ] 4.21 Implement GPS API endpoints (backend)
  - Create endpoints for GPS data storage and retrieval
  - Implement tiered retention (raw 30 days, downsampled 1 year, archived after 1 year)
  - Create batch job for downsampling (1 point per minute after 30 days)
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ] 4.22 Implement route planning (iOS)
  - Create RouteService with route creation and navigation
  - Implement start/end point selection on map
  - Create distance and time estimation
  - Implement turn-by-turn navigation display
  - Add route saving and sharing
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

- [ ] 4.23 Write property test for route navigation
  - **Property 37: Route Navigation**
  - **Validates: Requirements 21.3, 21.4**

- [ ] 4.24 Implement route API endpoints (backend)
  - Create route CRUD endpoints
  - Implement route rating and review system
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

- [ ] 4.25 Write unit tests for GPS and route features
  - Test GPS recording and calculations
  - Test signal loss handling
  - Test route creation and navigation
  - Test offline GPS storage and sync
  - _Requirements: 20.0, 21.0_

- [ ] 4.26 Implement home screen widgets (iOS)
  - Create small widget displaying current streak and XP progress
  - Create medium widget displaying today's workout status and next milestone
  - Create large widget displaying leaderboard position and friends' activity
  - Implement widget data refresh every 15 minutes
  - Add dark mode and light mode support
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 4.27 Write unit tests for widgets
  - Test widget data updates
  - Test widget tap navigation
  - Test dark/light mode rendering
  - _Requirements: 18.0_

- [ ] 4.28 Checkpoint - Ensure all advanced feature tests pass
  - Ensure all unit and property tests pass for progress tracking, body tracking, GPS, and widgets
  - Verify GPS calculations are accurate
  - Verify rest timer suggestions are appropriate
  - Ask the user if questions arise.


## Phase 5: Integrations (Apple Health, Spotify, Stripe)

- [ ] 5.1 Implement Apple Health integration (iOS)
  - Create HealthKitService with read/write permissions
  - Implement workout data write (duration, calories, distance)
  - Implement weight data bidirectional sync
  - Implement measurement data write
  - Create step count read from Apple Health
  - Implement conflict resolution (most recent timestamp wins)
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

- [ ] 5.2 Write property test for Apple Health sync
  - **Property 35: Apple Health Sync**
  - **Validates: Requirements 22.2, 22.3, 22.5**

- [ ] 5.3 Implement Spotify integration (iOS)
  - Create SpotifyService with OAuth 2.0 authentication
  - Implement currently playing track display
  - Create playback controls (play, pause, next, previous)
  - Implement playlist selection and creation
  - Add fallback to system music player
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [ ] 5.4 Write property test for Spotify integration
  - **Property 36: Spotify Integration**
  - **Validates: Requirements 19.2, 19.4**

- [ ] 5.5 Implement Stripe payment integration (backend)
  - Create subscription management endpoints
  - Implement POST `/subscription/upgrade` endpoint
  - Create POST `/subscription/cancel` endpoint
  - Create GET `/subscription/status` endpoint
  - Implement webhook handling for payment events
  - Add subscription status validation on all premium endpoints
  - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

- [ ] 5.6 Implement Stripe payment integration (iOS)
  - Create SubscriptionService with Stripe SDK
  - Implement subscription upgrade flow
  - Create subscription cancellation
  - Implement subscription status display
  - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

- [ ] 5.7 Write unit tests for integrations
  - Test Apple Health read/write operations
  - Test Spotify authentication and playback
  - Test Stripe subscription management
  - Test conflict resolution for synced data
  - _Requirements: 19.0, 22.0, 29.0_

- [ ] 5.8 Checkpoint - Ensure all integration tests pass
  - Ensure all unit and property tests pass for Apple Health, Spotify, and Stripe
  - Verify bidirectional sync works correctly
  - Verify subscription gating works correctly
  - Ask the user if questions arise.


## Phase 6: AI & Premium Features (AI Personal Trainer, Premium Gating)

- [ ] 6.1 Implement AI Personal Trainer (backend)
  - Create workout plan generation based on user goals, experience level, and equipment
  - Implement exercise recommendation and adaptation based on performance
  - Create form tip generation for exercises
  - Implement exercise variation suggestions
  - Create performance analysis and improvement recommendations
  - Implement nutrition and recovery recommendations
  - Add server-side subscription validation (403 Forbidden for non-premium)
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6_

- [ ] 6.2 Implement AI Personal Trainer (iOS)
  - Create AITrainerService with workout plan display
  - Implement personalized workout recommendations
  - Create form tip display during workouts
  - Implement exercise variation suggestions
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6_

- [ ] 6.3 Implement premium feature gating (backend)
  - Create subscription status check middleware
  - Implement 403 Forbidden response for non-premium users
  - Add rate limiting per user
  - Implement fraud detection for repeated 403s
  - Create admin dashboard for monitoring suspicious access
  - _Requirements: 27.0, 28.0, 29.0_

- [ ] 6.4 Implement premium feature gating (iOS)
  - Create FeatureGatingService with subscription status checking
  - Implement premium feature UI hiding for free tier
  - Create upgrade prompts for premium features
  - _Requirements: 27.0, 28.0, 29.0_

- [ ] 6.5 Write property test for premium feature access
  - **Property 33: Premium Feature Access**
  - **Validates: Requirements 27.1-27.6, 29.2**

- [ ] 6.6 Write property test for free tier limitations
  - **Property 34: Free Tier Limitations**
  - **Validates: Requirements 28.2, 28.3, 28.4**

- [ ] 6.7 Implement free tier features (backend)
  - Create ad serving endpoints for free tier users
  - Implement basic Apple Health integration (read-only)
  - Limit AI Personal Trainer access
  - Limit widget access to small widget only
  - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

- [ ] 6.8 Implement free tier features (iOS)
  - Create ad display for free tier users
  - Implement feature limitation UI
  - Create upgrade prompts
  - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

- [ ] 6.9 Write unit tests for premium and free tier features
  - Test subscription status checking
  - Test feature access control
  - Test upgrade prompts
  - Test ad display
  - _Requirements: 27.0, 28.0, 29.0_

- [ ] 6.10 Checkpoint - Ensure all premium feature tests pass
  - Ensure all unit and property tests pass for AI trainer and premium gating
  - Verify subscription validation works correctly
  - Verify free tier limitations are enforced
  - Ask the user if questions arise.


## Phase 7: Testing & Optimization (Property-Based Tests, Performance Optimization)

- [ ] 7.1 Implement property-based test infrastructure
  - Set up SwiftCheck for iOS property-based testing
  - Set up fast-check for backend property-based testing
  - Create generator strategies for all data types (users, workouts, GPS, timestamps)
  - Implement seed-based reproducibility for failed tests
  - Configure minimum 100 iterations per property test
  - _Requirements: 25.0_

- [ ] 7.2 Write property test for offline workout logging
  - **Property 18: Offline Workout Logging**
  - **Validates: Requirements 5.6, 20.6, 24.1, 24.2, 24.3**

- [ ] 7.3 Write property test for offline data availability
  - **Property 20: Offline Data Availability**
  - **Validates: Requirements 24.6**

- [ ] 7.4 Implement performance optimization - Caching
  - Implement Redis caching for exercise library (weekly TTL)
  - Implement user profile caching (1-hour TTL)
  - Implement leaderboard caching (5-minute TTL)
  - Implement achievement definition caching (static)
  - Create cache invalidation on data updates
  - _Requirements: 25.5, 25.6_

- [ ] 7.5 Write property test for data caching
  - **Property 25: Data Caching**
  - **Validates: Requirements 25.5, 25.6**

- [ ] 7.6 Implement performance optimization - Lazy Loading
  - Implement image lazy loading with thumbnail preview
  - Implement activity feed pagination (50 items per page)
  - Implement leaderboard pagination (100 items per page)
  - Implement chart rendering incrementally
  - _Requirements: 25.5_

- [ ] 7.7 Implement performance optimization - Database
  - Create indexes on frequently queried columns (userId, createdAt, muscleGroup)
  - Implement workout partitioning by date
  - Implement user level/XP denormalization for quick access
  - Create archive tables for data > 2 years old
  - _Requirements: 25.0_

- [ ] 7.8 Implement performance optimization - API
  - Implement GraphQL for flexible queries (reduce over-fetching)
  - Implement response compression (gzip)
  - Set up CDN for static assets
  - Implement rate limiting (100 requests/minute per user)
  - _Requirements: 25.0_

- [ ] 7.9 Write property test for app launch performance
  - **Property 21: App Launch Performance**
  - **Validates: Requirements 25.1**

- [ ] 7.10 Write property test for screen navigation performance
  - **Property 22: Screen Navigation Performance**
  - **Validates: Requirements 25.2**

- [ ] 7.11 Write property test for exercise search performance
  - **Property 23: Exercise Search Performance**
  - **Validates: Requirements 25.3**

- [ ] 7.12 Write property test for scroll performance
  - **Property 24: Scroll Performance**
  - **Validates: Requirements 25.4**

- [ ] 7.13 Implement privacy and data protection
  - Implement AES-256 encryption for data at rest
  - Implement TLS 1.2+ for data in transit
  - Create data export functionality (JSON, CSV)
  - Implement account deletion with 30-day retention
  - Create GDPR/CCPA compliance features
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7_

- [ ] 7.14 Write property test for data export
  - **Property 38: Data Export**
  - **Validates: Requirements 26.6**

- [ ] 7.15 Write property test for account deletion
  - **Property 39: Account Deletion**
  - **Validates: Requirements 26.4**

- [ ] 7.16 Write property test for data encryption
  - **Property 40: Data Encryption**
  - **Validates: Requirements 26.1, 26.2**

- [ ] 7.17 Implement device sync (iOS)
  - Create multi-device sync with cloud as source of truth
  - Implement 30-second sync window for workout completion
  - Create conflict resolution using most recent timestamp
  - Support at least 5 concurrent devices per user
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

- [ ] 7.18 Implement cloud sync and data persistence (backend)
  - Create data backup with 30-day retention
  - Implement data recovery options
  - Create last sync timestamp tracking
  - Implement automatic retry on network interruptions
  - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6_

- [ ] 7.19 Implement error handling and recovery
  - Implement network error handling with graceful degradation
  - Create corrupted database detection and repair
  - Implement failed sync operation recovery
  - Create authentication failure handling
  - _Requirements: 24.0, 26.0_

- [ ] 7.20 Write unit tests for error handling
  - Test network error recovery
  - Test database corruption recovery
  - Test sync failure recovery
  - Test authentication failure handling
  - _Requirements: 24.0, 26.0_

- [ ] 7.21 Implement monitoring and observability
  - Set up Application Performance Monitoring (DataDog/New Relic)
  - Implement error tracking (Sentry)
  - Set up log aggregation (ELK Stack)
  - Create metrics dashboards (response time, error rate, query time)
  - Implement alerts for high error rate, slow queries, sync failures
  - _Requirements: 25.0_

- [ ] 7.22 Run full test suite and performance benchmarks
  - Run all unit tests (target 80% code coverage)
  - Run all property-based tests (40 properties)
  - Run all integration tests
  - Run performance benchmarks against targets
  - Verify all performance targets are met
  - _Requirements: 25.0_

- [ ] 7.23 Final checkpoint - Ensure all tests pass and performance targets met
  - Ensure all unit, property, and integration tests pass
  - Verify code coverage is at least 80%
  - Verify all performance targets are met (app launch < 1000ms, navigation < 500ms, search < 200ms, scroll 60 FPS)
  - Verify all 40 correctness properties are implemented and passing
  - Ask the user if questions arise.

- [ ] 7.24 Prepare for release
  - Create release notes documenting all features
  - Prepare app store submission materials
  - Create user documentation and help guides
  - Set up customer support channels
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP, but are recommended for comprehensive correctness verification
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for course correction
- Property-based tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- All tasks assume context documents (requirements.md, design.md) are available during implementation
- Design decisions from the design document should be referenced during implementation (e.g., Decision 1: Offline-First Sync Communication, Decision 5: XP Calculation - Anti-Cheat, etc.)
- The implementation should follow the offline-first architecture with cloud synchronization as described in the design
- All XP calculations should include anti-cheat validation as specified in Decision 5
- Sync conflict resolution should use server-assigned timestamps as specified in Decision 4
- Leaderboard rankings should use Redis sorted sets for performance as specified in Decision 8
- Activity feed should use fan-out-on-write strategy as specified in Decision 9
- GPS data should use tiered retention as specified in Decision 10
- Sync operations should be batched as specified in Decision 11
- Premium features should use server-side validation as specified in Decision 12
