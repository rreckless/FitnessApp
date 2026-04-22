import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface HomeScreenProps {
  userId: string;
  token: string;
  onLogout: () => void;
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ userId, token, onLogout, onNavigate }) => {
  const [userStats, setUserStats] = useState({
    level: 1,
    xp: 0,
    streak: 0,
    workouts: 0,
  });

  useEffect(() => {
    // Simulate loading user stats
    setUserStats({
      level: 1,
      xp: 0,
      streak: 0,
      workouts: 0,
    });
  }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back!</Text>
            <Text style={styles.userId}>{userId}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.xp}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.workouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Features</Text>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('WorkoutLogger')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>💪</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Log Workout</Text>
              <Text style={styles.featureDescription}>Track your exercises and sets</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('ProgressTracking')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>📊</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Progress Tracking</Text>
              <Text style={styles.featureDescription}>View your personal records</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('Leaderboard')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🏆</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Leaderboard</Text>
              <Text style={styles.featureDescription}>Compete with friends</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('Achievements')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🎯</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Achievements</Text>
              <Text style={styles.featureDescription}>Unlock badges and rewards</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Supporting Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supporting Features</Text>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('GPSTracking')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>📍</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>GPS Tracking</Text>
              <Text style={styles.featureDescription}>Track outdoor workouts</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('BodyTracking')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>⚖️</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Body Tracking</Text>
              <Text style={styles.featureDescription}>Monitor weight and measurements</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('RestTimer')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>⏱️</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Rest Timer</Text>
              <Text style={styles.featureDescription}>Smart rest duration suggestions</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('RoutePlanning')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🗺️</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Route Planning</Text>
              <Text style={styles.featureDescription}>Create and navigate routes</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('HomeWidgets')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>📱</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Home Widgets</Text>
              <Text style={styles.featureDescription}>Quick access to your stats</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Social Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social & Challenges</Text>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('SocialFeatures')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>👥</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Social Features</Text>
              <Text style={styles.featureDescription}>Friends, activity feed, and more</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureCard}
            onPress={() => onNavigate('ChallengeCenter')}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🎪</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Challenge Center</Text>
              <Text style={styles.featureDescription}>Create and join challenges</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <Text style={styles.statusTitle}>App Status</Text>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Phase</Text>
            <Text style={styles.statusValue}>4 Complete</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Tests</Text>
            <Text style={styles.statusValue}>600+ Passing</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Services</Text>
            <Text style={styles.statusValue}>20+ Implemented</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: '#888',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#888',
  },
  arrow: {
    fontSize: 24,
    color: '#00ff00',
    marginLeft: 8,
  },
  statusSection: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  statusLabel: {
    fontSize: 14,
    color: '#888',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff00',
  },
});
