# Expo Go Setup Guide

Due to Xcode 26.4 compatibility issues with React Native native builds, we recommend using **Expo Go** for iOS development and testing. Expo Go handles all native compilation and provides a faster development experience.

## Prerequisites

- Expo CLI installed: `npm install -g expo-cli`
- Expo Go app installed on your iOS device or simulator
- Same network connection for device and development machine

## Quick Start

### Option 1: Run on iOS Simulator (Easiest)

```bash
cd mobile
npx expo start --ios
```

This will:
1. Start the Metro bundler
2. Automatically open Expo Go on the iOS simulator
3. Load your app

### Option 2: Run on Physical Device

1. Install Expo Go from the App Store on your iPhone
2. Run the development server:
   ```bash
   cd mobile
   npx expo start
   ```
3. Scan the QR code with your iPhone camera
4. Tap the notification to open in Expo Go

## Testing Authentication

Once the app loads in Expo Go:

1. Make sure the backend is running:
   ```bash
   cd backend-dotnet
   docker-compose up
   ```

2. The app will connect to `http://localhost:5001` for authentication

3. Create a test account or use demo credentials:
   - Email: `demo@fitquest.com`
   - Password: `password123`

## Advantages of Expo Go

- ✅ No native compilation needed
- ✅ Instant reload on code changes
- ✅ Works with Xcode 26.4
- ✅ Faster development cycle
- ✅ Easy testing on physical devices
- ✅ No CocoaPods or native build issues

## Limitations

- Some native modules may not work in Expo Go
- For production, you'll need to use EAS Build or native builds

## Troubleshooting

### "Cannot connect to server"
- Ensure backend is running: `docker-compose up` in `backend-dotnet/`
- Check that your device is on the same network as your development machine
- Verify port 5001 is accessible

### "Module not found"
- Clear Metro cache: `npx expo start --clear`
- Reinstall dependencies: `npm install`

### App crashes on startup
- Check the Metro bundler output for errors
- Verify all imports are correct
- Check that `AuthenticationService.ts` is properly configured

## Next Steps

Once you have the app running in Expo Go:
1. Test authentication flow
2. Test workout logging
3. Test other features
4. When ready for production, use EAS Build or native builds

