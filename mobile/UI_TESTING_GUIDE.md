# FitQuest UI Testing Guide

## Overview

The FitQuest mobile app now has a fully functional authentication and home screen UI for testing account creation and app features.

## Getting Started

### 1. Start the Metro Bundler

```bash
cd mobile
npm start
```

### 2. Run the App in iOS Simulator

In a new terminal:

```bash
npx react-native run-ios
```

The app will build and launch in the iOS simulator.

## Testing Account Creation

### Option 1: Create a New Account

1. **Launch the app** - You'll see the FitQuest login screen
2. **Click "Don't have an account? Sign Up"** - Switch to sign-up mode
3. **Fill in the form:**
   - Username: `testuser` (or any username)
   - Email: `test@example.com` (or any valid email)
   - Password: `password123` (must be 8+ characters)
   - Confirm Password: `password123` (must match)
4. **Click "Create Account"** - The app will simulate account creation
5. **Success!** - You'll be logged in and see the home screen

### Option 2: Login with Demo Account

1. **Launch the app** - You'll see the FitQuest login screen
2. **Click "Try Demo Account"** - Instantly logs in with demo credentials
3. **Success!** - You'll be logged in and see the home screen

### Option 3: Manual Login

1. **Launch the app** - You'll see the FitQuest login screen
2. **Fill in the form:**
   - Email: `test@example.com`
   - Password: `password123`
3. **Click "Login"** - The app will simulate login
4. **Success!** - You'll be logged in and see the home screen

## Home Screen Features

Once logged in, you'll see:

### Stats Cards
- **Level**: Your current level (starts at 1)
- **XP**: Experience points earned
- **Streak**: Current workout streak
- **Workouts**: Total workouts completed

### Feature Cards
- **Log Workout**: Track exercises and sets
- **Progress Tracking**: View personal records
- **Leaderboard**: Compete with friends
- **Achievements**: Unlock badges and rewards
- **GPS Tracking**: Track outdoor workouts
- **Body Tracking**: Monitor weight and measurements

### App Status
- Phase 4 Complete
- 600+ Tests Passing
- 20+ Services Implemented

## Logout

Click the **"Logout"** button in the top-right corner to return to the login screen.

## Validation Rules

### Sign Up Validation
- **Username**: Required, any non-empty string
- **Email**: Must be valid email format (e.g., user@domain.com)
- **Password**: Must be at least 8 characters
- **Confirm Password**: Must match password field

### Login Validation
- **Email**: Must be valid email format
- **Password**: Required, any non-empty string

## UI Design

The app uses a dark theme with:
- **Background**: Dark gray (#0a0a0a)
- **Accent Color**: Neon green (#00ff00)
- **Cards**: Dark with subtle borders (#1a1a1a)
- **Text**: White for primary, gray for secondary

## Testing Checklist

- [ ] App launches successfully
- [ ] Login screen displays correctly
- [ ] Can switch between login and sign-up modes
- [ ] Email validation works (rejects invalid emails)
- [ ] Password validation works (requires 8+ characters)
- [ ] Password confirmation validation works
- [ ] Can create a new account
- [ ] Can login with demo account
- [ ] Home screen displays after login
- [ ] Stats cards show correct values
- [ ] Feature cards are clickable
- [ ] Logout button works
- [ ] Returns to login screen after logout

## Next Steps

The UI is ready for:
1. Connecting to real authentication service
2. Implementing workout logging
3. Adding navigation between screens
4. Integrating with backend services
5. Adding more detailed user profiles

## Notes

- All authentication is currently mocked (simulated)
- Real API integration will be added in Phase 5
- The app uses React Native for cross-platform compatibility
- All screens are fully typed with TypeScript
- Dark theme optimized for fitness app usage
