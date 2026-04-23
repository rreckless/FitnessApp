// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '14.0',
  },
}));

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(),
  DEBUG: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => {
  const mockAxios = jest.fn();
  mockAxios.create = jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }));
  mockAxios.isAxiosError = jest.fn((error) => error && error.response);
  mockAxios.post = jest.fn();
  return mockAxios;
});
