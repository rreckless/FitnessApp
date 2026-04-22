import React from 'react';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutLoggerScreen } from '../screens/WorkoutLoggerScreen';
import { ProgressTrackingScreen } from '../screens/ProgressTrackingScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { GPSTrackingScreen } from '../screens/GPSTrackingScreen';
import { BodyTrackingScreen } from '../screens/BodyTrackingScreen';
import { RestTimerScreen } from '../screens/RestTimerScreen';
import { RoutePlanningScreen } from '../screens/RoutePlanningScreen';
import { HomeWidgetsScreen } from '../screens/HomeWidgetsScreen';
import { SocialFeaturesScreen } from '../screens/SocialFeaturesScreen';
import { ChallengeCenterScreen } from '../screens/ChallengeCenterScreen';

interface AppNavigatorProps {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  onLoginSuccess: (userId: string, token: string) => void;
  onLogout: () => void;
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
  isAuthenticated,
  userId,
  token,
  onLoginSuccess,
  onLogout,
  currentScreen,
  onNavigate,
}) => {
  if (!isAuthenticated) {
    return <AuthScreen onLoginSuccess={onLoginSuccess} />;
  }

  switch (currentScreen) {
    case 'Home':
      return (
        <HomeScreen
          userId={userId!}
          token={token!}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      );
    case 'WorkoutLogger':
      return (
        <WorkoutLoggerScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'ProgressTracking':
      return (
        <ProgressTrackingScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'Leaderboard':
      return (
        <LeaderboardScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'Achievements':
      return (
        <AchievementsScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'GPSTracking':
      return (
        <GPSTrackingScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'BodyTracking':
      return (
        <BodyTrackingScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'RestTimer':
      return (
        <RestTimerScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'RoutePlanning':
      return (
        <RoutePlanningScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'HomeWidgets':
      return (
        <HomeWidgetsScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'SocialFeatures':
      return (
        <SocialFeaturesScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    case 'ChallengeCenter':
      return (
        <ChallengeCenterScreen
          userId={userId!}
          onBack={() => onNavigate('Home')}
        />
      );
    default:
      return (
        <HomeScreen
          userId={userId!}
          token={token!}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      );
  }
};
