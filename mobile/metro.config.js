const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
  },
  project: {
    ios: {},
    android: {},
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
