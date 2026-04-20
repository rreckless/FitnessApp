import { Platform } from 'react-native';

const Config = {
  // API Configuration
  apiBaseURL: __DEV__
    ? Platform.OS === 'android'
      ? 'http://10.0.2.2:3000/api' // Android emulator
      : 'http://localhost:3000/api' // iOS simulator
    : 'https://api.fitquest.com/api', // Production

  // App Configuration
  appName: 'FitQuest',
  appVersion: '1.0.0',

  // Feature Flags
  enableOfflineMode: true,
  enableSyncQueue: true,
  enableLocalCaching: true,

  // Timeouts (in milliseconds)
  requestTimeout: 30000,
  syncTimeout: 60000,

  // Cache Configuration
  exerciseCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  profileCacheTTL: 1 * 60 * 60 * 1000, // 1 hour
  leaderboardCacheTTL: 5 * 60 * 1000, // 5 minutes

  // Sync Configuration
  syncRetryAttempts: 3,
  syncRetryDelay: 1000, // 1 second
  syncBatchSize: 20,

  // Database Configuration
  databaseName: 'fitquest.db',
  databaseVersion: 1,

  // Logging
  enableLogging: __DEV__,
  logLevel: __DEV__ ? 'debug' : 'error',
};

export default Config;
