# FitQuest Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Install Dependencies (if not already done)
```bash
cd services/fitquest-mobile
npm install
```

### Step 2: Start the Development Server
```bash
npm start
```

You should see:
```
Welcome to Metro!
Fast - Scalable - Integrated

To reload the app press "r"
To open developer menu press "d"
```

### Step 3: Run on iOS Simulator (in another terminal)
```bash
npm run ios
```

Or run on Android Emulator:
```bash
npm run android
```

## 📱 What You Can Test

### Login & Registration
- **Email**: test@example.com
- **Password**: TestPassword123!
- Test password validation (must have 12+ chars, uppercase, lowercase, number, special char)

### Onboarding
- Select fitness goals (Strength, Endurance, Weight Loss, Muscle Gain)
- Choose experience level (Beginner, Intermediate, Advanced)
- Select available equipment
- View progress through steps

### Home Screen
- See your profile with level and XP
- View current and longest streak
- See XP progress to next level
- Quick action buttons to start workout or view progress

### Workout Logging
1. Tap "Start Workout"
2. Tap "+ Add Exercise"
3. Search for an exercise (e.g., "Bench Press")
4. Enter sets, reps, and weight
5. Tap "+ Add Set" to add more sets
6. Tap "Complete Workout" to finish

### Profile Management
1. Tap "Edit" on profile screen
2. Update your name and bio
3. Change experience level
4. Select fitness goals
5. Choose available equipment
6. Tap "Save Changes"

### Exercise Library
1. Tap "View Progress" from home
2. Search for exercises
3. Filter by muscle group (Chest, Back, Shoulders, etc.)
4. Tap an exercise to see details

## 🔧 Developer Menu

While the app is running, press `D` to open the developer menu:

- **Reload**: Reload the app (or press `R` twice)
- **Debug**: Open Chrome DevTools for debugging
- **Show Inspector**: Inspect UI elements
- **Show Perf Monitor**: Monitor performance
- **Toggle Element Inspector**: Inspect component hierarchy

## 📊 Test Data

The app uses local SQLite database with mock data:

### Pre-loaded Exercises
- 200+ exercises across all muscle groups
- Each exercise has difficulty level and form tips
- Exercises are categorized by primary and secondary muscle groups

### User Profile
- Starts at Level 1 with 0 XP
- Current streak: 0 days
- Longest streak: 0 days
- Preferences: Empty (set during onboarding)

## 🐛 Common Issues

### "Metro bundler not responding"
```bash
npm start -- --reset-cache
```

### "Port 8081 already in use"
```bash
npm start -- --port 8082
```

### iOS build fails
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm run ios
```

### Android build fails
```bash
cd android
./gradlew clean
cd ..
npm run android
```

## 📝 Test Scenarios

### Scenario 1: Complete Onboarding
1. Register with email and password
2. Complete all onboarding steps
3. Verify you're taken to home screen

### Scenario 2: Log a Workout
1. From home screen, tap "Start Workout"
2. Add 3 different exercises
3. Add 3 sets for each exercise
4. Enter realistic weights and reps
5. Complete the workout
6. Verify XP is calculated

### Scenario 3: Update Profile
1. From home screen, tap "Edit" on profile
2. Change your name
3. Select different fitness goals
4. Save changes
5. Verify changes are persisted

### Scenario 4: Search Exercises
1. Tap "View Progress"
2. Search for "squat"
3. Filter by "Legs" muscle group
4. View exercise details

## 🎯 Performance Targets

The app should meet these performance targets:

- **App Launch**: < 1000ms
- **Screen Navigation**: < 500ms
- **Exercise Search**: < 200ms
- **List Scrolling**: 60 FPS
- **Workout Logging**: < 100ms per set entry

Monitor these in the developer menu under "Show Perf Monitor"

## 📚 Documentation

For more detailed information, see:
- `RUNNING_THE_APP.md` - Comprehensive setup guide
- `PHASE_2_UI_COMPLETION.md` - UI implementation details
- `.kiro/specs/fitquest-gamified-fitness/requirements.md` - Feature requirements
- `.kiro/specs/fitquest-gamified-fitness/design.md` - Technical design

## 🎉 Next Steps

After testing the current features:

1. **Phase 3**: Leaderboards, social features, achievements
2. **Backend Integration**: Connect to real API endpoints
3. **Apple Health**: Sync with Apple Health
4. **Spotify**: Music integration during workouts
5. **GPS**: Outdoor cardio tracking

## 💡 Tips

- Use the React DevTools browser extension for better debugging
- Check the console for any warnings or errors
- Test on both iOS simulator and Android emulator
- Test on physical devices for real-world performance
- Use the developer menu to inspect UI elements

## 🆘 Need Help?

1. Check the troubleshooting section in `RUNNING_THE_APP.md`
2. Review React Native docs: https://reactnative.dev
3. Check the implementation summaries in the project root
4. Review the spec documents in `.kiro/specs/fitquest-gamified-fitness/`

---

**Happy Testing! 🏋️‍♂️**
