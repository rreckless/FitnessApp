# Running the FitQuest Mobile App

## Prerequisites

Before running the app, ensure you have the following installed:

### For iOS Development
- Xcode 14+ (from App Store)
- CocoaPods: `sudo gem install cocoapods`
- Node.js 16+ and npm

### For Android Development
- Android Studio
- Android SDK (API level 31+)
- Java Development Kit (JDK) 11+
- Node.js 16+ and npm

## Setup Instructions

### 1. Install Dependencies

```bash
cd services/fitquest-mobile
npm install
```

### 2. Initialize Native Projects (First Time Only)

If you haven't already created the native iOS/Android projects, run:

```bash
# This will create ios/ and android/ directories
npx react-native init FitQuest --template react-native-template-typescript
```

Or if you prefer to use the existing setup:

```bash
# For iOS
cd ios
pod install
cd ..

# For Android
# No additional setup needed
```

## Running the App

### Option 1: iOS Simulator

```bash
# Start the development server
npm start

# In another terminal, run on iOS simulator
npm run ios

# Or specify a device
npm run ios -- --simulator="iPhone 14"
```

### Option 2: Android Emulator

```bash
# Start the development server
npm start

# In another terminal, run on Android emulator
npm run android
```

### Option 3: Physical Device

#### iOS Device
1. Open `ios/FitQuest.xcworkspace` in Xcode
2. Select your device from the device dropdown
3. Press the Play button to build and run

#### Android Device
1. Connect your Android device via USB
2. Enable USB debugging on your device
3. Run: `npm run android`

## Development Server

The development server runs on `http://localhost:8081` by default.

### Hot Reload
- Press `R` twice to reload the app
- Press `D` to open the developer menu

### Debugging
- Press `D` to open the developer menu
- Select "Debug" to open Chrome DevTools
- Use React DevTools for component inspection

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage
```

## Troubleshooting

### Metro Bundler Issues
If you get "Metro bundler not responding":
```bash
# Clear cache and restart
npm start -- --reset-cache
```

### Pod Installation Issues (iOS)
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Gradle Issues (Android)
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Port Already in Use
If port 8081 is already in use:
```bash
npm start -- --port 8082
```

## App Features to Test

### Authentication Flow
1. **Login Screen**: Test email/password validation
2. **Register Screen**: Test password strength validation (12+ chars, uppercase, lowercase, number, special char)
3. **Onboarding**: Test multi-step flow with goal, experience level, equipment selection

### Home Screen
1. View user profile with level and XP
2. See current and longest streak
3. View XP progress bar
4. Quick action buttons

### Workout Logging
1. Start a new workout
2. Add exercises from the library
3. Enter sets, reps, and weight
4. Calculate total volume
5. Complete workout

### Profile Management
1. Edit profile information
2. Update fitness preferences
3. Select goals and equipment
4. View profile statistics

### Exercise Library
1. Search exercises by name
2. Filter by muscle group
3. View exercise details
4. See form tips

## Performance Tips

- Use a physical device for better performance testing
- Monitor memory usage in the developer menu
- Use React DevTools Profiler to identify slow components
- Enable "Show FPS" in developer menu to monitor frame rate

## Next Steps

After testing the current implementation:

1. **Phase 3 Features**: Implement leaderboards, social features, achievements
2. **Backend Integration**: Connect to actual API endpoints
3. **Apple Health Integration**: Add HealthKit support
4. **Spotify Integration**: Add music playback during workouts
5. **GPS Tracking**: Implement outdoor cardio tracking
6. **Push Notifications**: Add notification support

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review React Native documentation: https://reactnative.dev
3. Check the project README: README.md
4. Review implementation summaries in the project root

## Environment Variables

Create a `.env` file in the project root:

```
API_BASE_URL=http://localhost:3000
API_TIMEOUT=30000
LOG_LEVEL=debug
```

Load environment variables in `src/config/env.ts`:

```typescript
import Config from 'react-native-config';

export const API_BASE_URL = Config.API_BASE_URL || 'http://localhost:3000';
export const API_TIMEOUT = parseInt(Config.API_TIMEOUT || '30000', 10);
export const LOG_LEVEL = Config.LOG_LEVEL || 'info';
```
