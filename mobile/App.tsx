import React, { useState } from 'react';
import { AuthScreen } from './src/screens/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    token: null,
  });

  const [currentScreen, setCurrentScreen] = useState('Home');

  const handleLoginSuccess = (userId: string, token: string) => {
    setAuthState({
      isAuthenticated: true,
      userId,
      token,
    });
    setCurrentScreen('Home');
  };

  const handleLogout = () => {
    setAuthState({
      isAuthenticated: false,
      userId: null,
      token: null,
    });
    setCurrentScreen('Home');
  };

  return (
    <AppNavigator
      isAuthenticated={authState.isAuthenticated}
      userId={authState.userId}
      token={authState.token}
      onLoginSuccess={handleLoginSuccess}
      onLogout={handleLogout}
      currentScreen={currentScreen}
      onNavigate={setCurrentScreen}
    />
  );
}
