/**
 * Home Screen
 * Main dashboard displaying user profile, current streak, XP progress, and quick workout start
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { UserProfileService } from '../services/UserProfileService';
import { WorkoutLogger } from '../services/WorkoutLogger';
import { UserProfile } from '../models/UserProfileModels';

interface HomeScreenProps {
  onStartWorkout: () => void;
  onViewProfile: () => void;
  onViewProgress: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartWorkout,
  onViewProfile,
  onViewProgress,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const profileService = UserProfileService.getInstance();
      const profile = await profileService.getUserProfile();
      setUserProfile(profile);
      setError(null);
    } catch (err) {
      setError('Failed to load profile');
      Alert.alert('Error', 'Could not load your profile');
    } finally {
      setLoading(false);
    }
  };

  const calculateXPProgress = (): number => {
    if (!userProfile) return 0;
    // Level thresholds: Level 1: 0 XP, Level 2: 500 XP, Level 3: 1500 XP, etc.
    const currentLevelThreshold = (userProfile.level - 1) * 500 + (userProfile.level > 1 ? 500 : 0);
    const nextLevelThreshold = userProfile.level * 500 + (userProfile.level > 1 ? 500 : 0);
    const xpInCurrentLevel = userProfile.totalXP - currentLevelThreshold;
    const xpNeededForLevel = nextLevelThreshold - currentLevelThreshold;
    return Math.min(100, (xpInCurrentLevel / xpNeededForLevel) * 100);
  };

  const getNextMilestone = (): number => {
    if (!userProfile) return 0;
    const currentLevelThreshold = (userProfile.level - 1) * 500 + (userProfile.level > 1 ? 500 : 0);
    const nextLevelThreshold = userProfile.level * 500 + (userProfile.level > 1 ? 500 : 0);
    return nextLevelThreshold - userProfile.totalXP;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || 'Failed to load profile'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const xpProgress = calculateXPProgress();
  const nextMilestone = getNextMilestone();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with User Name */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{userProfile.name}</Text>
        </View>

        {/* Streak Card */}
        <View style={styles.card}>
          <View style={styles.streakContainer}>
            <View style={styles.streakContent}>
              <Text style={styles.streakLabel}>Current Streak</Text>
              <Text style={styles.streakValue}>{userProfile.currentStreak}</Text>
              <Text style={styles.streakDays}>days</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakContent}>
              <Text style={styles.streakLabel}>Longest Streak</Text>
              <Text style={styles.streakValue}>{userProfile.longestStreak}</Text>
              <Text style={styles.streakDays}>days</Text>
            </View>
          </View>
        </View>

        {/* Level and XP Progress Card */}
        <View style={styles.card}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.levelLabel}>Level</Text>
              <Text style={styles.levelValue}>{userProfile.level}</Text>
            </View>
            <View style={styles.xpInfo}>
              <Text style={styles.xpLabel}>Total XP</Text>
              <Text style={styles.xpValue}>{userProfile.totalXP.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${xpProgress}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {nextMilestone} XP to Level {userProfile.level + 1}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={onStartWorkout}
          >
            <Text style={styles.actionButtonText}>Start Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={onViewProgress}
          >
            <Text style={styles.secondaryButtonText}>View Progress</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Summary Card */}
        <View style={styles.card}>
          <View style={styles.profileSummaryHeader}>
            <Text style={styles.cardTitle}>Profile Summary</Text>
            <TouchableOpacity onPress={onViewProfile}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Experience Level</Text>
            <Text style={styles.summaryValue}>
              {userProfile.preferences?.experienceLevel || 'Not set'}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Fitness Goals</Text>
            <Text style={styles.summaryValue}>
              {userProfile.preferences?.fitnessGoals?.join(', ') || 'Not set'}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Workout Frequency</Text>
            <Text style={styles.summaryValue}>
              {userProfile.preferences?.workoutFrequency || 'Not set'} days/week
            </Text>
          </View>
        </View>

        {/* Stats Footer */}
        <View style={styles.statsFooter}>
          <Text style={styles.statsText}>Keep up the great work! 💪</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  streakContent: {
    alignItems: 'center',
    flex: 1,
  },
  streakDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  streakLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  streakDays: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  levelLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  levelValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  xpInfo: {
    alignItems: 'flex-end',
  },
  xpLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  xpValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionsContainer: {
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  profileSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statsFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
