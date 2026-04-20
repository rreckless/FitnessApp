module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: false,
      },
      isolatedModules: false,
      babelConfig: false,
      diagnostics: {
        warnOnly: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-sqlite-storage|react-native-keychain|react-native-uuid|@react-native-async-storage|@react-native-community)/)',
  ],
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
