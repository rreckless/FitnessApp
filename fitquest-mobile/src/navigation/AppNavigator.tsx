/**
 * App Navigator
 * Main navigation structure for the FitQuest mobile app
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthenticationService } from '../services/AuthenticationService';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ExerciseLibraryScreen } from '../screens/ExerciseLibraryScreen';

type NavigationState =
  | 'loading'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'home'
  | 'workout'
  | 'profile'
  | 'exerciseLibrary';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<NavigationState>('loading');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authService = AuthenticationService.getInstance();
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('login');
      }
    } catch (err) {
      setCurrentScreen('login');
    }
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('onboarding');
  };

  const handleRegisterSuccess = () => {
    setCurrentScreen('login');
  };

  const handleOnboardingComplete = () => {
    setCurrentScreen('home');
  };

  const handleStartWorkout = () => {
    setCurrentScreen('workout');
  };

  const handleWorkoutComplete = () => {
    setCurrentScreen('home');
  };

  const handleViewProfile = () => {
    setCurrentScreen('profile');
  };

  const handleViewProgress = () => {
    setCurrentScreen('exerciseLibrary');
  };

  const handleLogout = () => {
    setCurrentScreen('login');
  };

  const handleNavigateToRegister = () => {
    setCurrentScreen('register');
  };

  const handleNavigateToLogin = () => {
    setCurrentScreen('login');
  };

  const handleCloseModal = () => {
    setCurrentScreen('home');
  };

  if (currentScreen === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  switch (currentScreen) {
    case 'login':
      return (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={handleNavigateToRegister}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateToLogin={handleNavigateToLogin}
        />
      );

    case 'onboarding':
      return <OnboardingScreen onOnboardingComplete={handleOnboardingComplete} />;

    case 'home':
      return (
        <HomeScreen
          onStartWorkout={handleStartWorkout}
          onViewProfile={handleViewProfile}
          onViewProgress={handleViewProgress}
        />
      );

    case 'workout':
      return (
        <WorkoutScreen
          onWorkoutComplete={handleWorkoutComplete}
          onCancel={handleCloseModal}
        />
      );

    case 'profile':
      return (
        <ProfileScreen
          onLogout={handleLogout}
          onClose={handleCloseModal}
        />
      );

    case 'exerciseLibrary':
      return <ExerciseLibraryScreen onClose={handleCloseModal} />;

    default:
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      );
  }
};
