// Jest setup file for common mocking patterns and test utilities

// Mock AsyncStorage with proper implementation
const mockAsyncStorage: any = {
  storage: {} as Record<string, string>,
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    mockAsyncStorage.storage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return Promise.resolve(mockAsyncStorage.storage[key] || null);
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete mockAsyncStorage.storage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(async (): Promise<void> => {
    mockAsyncStorage.storage = {};
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Promise.resolve(Object.keys(mockAsyncStorage.storage));
  }),
  multiSet: jest.fn(async (items: Array<[string, string]>): Promise<void> => {
    items.forEach(([key, value]) => {
      mockAsyncStorage.storage[key] = value;
    });
    return Promise.resolve();
  }),
  multiGet: jest.fn(async (keys: string[]): Promise<Array<[string, string | null]>> => {
    return Promise.resolve(
      keys.map(key => [key, mockAsyncStorage.storage[key] || null])
    );
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Keychain with proper implementation
const mockKeychain: any = {
  setGenericPassword: jest.fn(async (username: string, password: string): Promise<any> => {
    return Promise.resolve({ username, password, storage: 'keychain' });
  }),
  getGenericPassword: jest.fn(async (): Promise<boolean> => {
    return Promise.resolve(false);
  }),
  resetGenericPassword: jest.fn(async (): Promise<boolean> => {
    return Promise.resolve(true);
  }),
  setInternetCredentials: jest.fn(async (_server: string, username: string, password: string): Promise<any> => {
    return Promise.resolve({ username, password, storage: 'keychain' });
  }),
  getInternetCredentials: jest.fn(async (_server: string): Promise<boolean> => {
    return Promise.resolve(false);
  }),
  resetInternetCredentials: jest.fn(async (_server: string): Promise<boolean> => {
    return Promise.resolve(true);
  }),
};

jest.mock('react-native-keychain', () => mockKeychain);

// Mock axios with proper implementation
const mockAxiosInstance: any = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: {
    create: jest.fn(() => mockAxiosInstance),
  },
}));

// Mock DatabaseManager with proper implementation
const mockDatabaseManager: any = {
  executeSql: jest.fn(async (_sql: string, _params?: any[]): Promise<any> => {
    return Promise.resolve({
      rows: {
        length: 0,
        item: (_index: number) => ({}),
      },
    });
  }),
  transaction: jest.fn(async (_callback: (tx: any) => void): Promise<void> => {
    return Promise.resolve();
  }),
  close: jest.fn(async (): Promise<void> => {
    return Promise.resolve();
  }),
};

jest.mock('@database/DatabaseManager', () => mockDatabaseManager);

// Mock Config
jest.mock('@config/Config', () => ({
  apiBaseURL: 'http://localhost:3000/api',
  environment: 'test',
  logLevel: 'error',
}));

// Mock AuthenticationService
jest.mock('@services/AuthenticationService', () => ({
  getInstance: jest.fn(),
  getCurrentUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  refreshAccessToken: jest.fn(),
  loadStoredUser: jest.fn(),
}));

// Mock UserProfileService
jest.mock('@services/UserProfileService', () => ({
  getInstance: jest.fn(),
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  setFitnessGoals: jest.fn(),
  setExperienceLevel: jest.fn(),
  setWorkoutFrequency: jest.fn(),
  setAvailableEquipment: jest.fn(),
}));

// Mock react-native-uuid with counter for unique IDs
let uuidCounter = 0;
jest.mock('react-native-uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
  parse: jest.fn(),
  unparse: jest.fn(),
  validate: jest.fn(),
  version: jest.fn(),
  v1: jest.fn(),
  v3: jest.fn(),
  v5: jest.fn(),
  NIL: '',
  DNS: '',
  URL: '',
  OID: '',
  X500: '',
}));

// Export mocks for use in tests
export { mockAsyncStorage, mockKeychain, mockAxiosInstance, mockDatabaseManager };

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  level: 1,
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  subscriptionTier: 'FREE',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockWorkout = (overrides = {}) => ({
  id: 'workout-123',
  userId: 'user-123',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T11:00:00Z'),
  exercises: [],
  totalVolume: 0,
  totalXp: 0,
  isOfflineCreated: true,
  syncedAt: null,
  ...overrides,
});

export const createMockExercise = (overrides = {}) => ({
  id: 'ex-1',
  name: 'Bench Press',
  description: 'Upper body compound exercise',
  primaryMuscleGroup: 'CHEST',
  secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'],
  difficulty: 'INTERMEDIATE',
  equipment: ['BARBELL', 'BENCH'],
  formTips: ['Keep chest up', 'Full range of motion'],
  videoUrl: 'https://example.com/bench-press.mp4',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSyncQueueItem = (overrides = {}) => ({
  id: 'sync-1',
  userId: 'user-123',
  operation: 'CREATE',
  entityType: 'WORKOUT',
  entityId: 'workout-1',
  payload: JSON.stringify({ duration: 3600 }),
  status: 'PENDING',
  retryCount: 0,
  lastError: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});
