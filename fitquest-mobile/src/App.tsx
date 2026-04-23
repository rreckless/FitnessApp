/**
 * FitQuest Mobile App
 * Main entry point for the React Native application
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { AppNavigator } from './navigation/AppNavigator';

export const App: React.FC = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AppNavigator />
    </>
  );
};
