import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface HomeWidgetsScreenProps {
  userId: string;
  onBack: () => void;
}

export const HomeWidgetsScreen: React.FC<HomeWidgetsScreenProps> = ({ userId, onBack }) => {
  const [darkMode, setDarkMode] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Home Widgets</Text>
        <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
          <Text style={styles.modeButton}>{darkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.sectionTitle}>Small Widget</Text>
        <View style={styles.widgetPreview}>
          <View style={styles.smallWidget}>
            <View style={styles.widgetRow}>
              <Text style={styles.widgetLabel}>Streak</Text>
              <Text style={styles.widgetValue}>7</Text>
            </View>
            <View style={styles.widgetRow}>
              <Text style={styles.widgetLabel}>XP</Text>
              <Text style={styles.widgetValue}>1,250</Text>
            </View>
          </View>
          <Text style={styles.widgetDesc}>Current streak and XP progress</Text>
        </View>

        <Text style={styles.sectionTitle}>Medium Widget</Text>
        <View style={styles.widgetPreview}>
          <View style={styles.mediumWidget}>
            <Text style={styles.widgetTitle}>Today's Workout</Text>
            <View style={styles.widgetContent}>
              <Text style={styles.widgetStat}>Status: Ready</Text>
              <Text style={styles.widgetStat}>Next: Chest Day</Text>
              <Text style={styles.widgetStat}>Milestone: Level 9</Text>
            </View>
          </View>
          <Text style={styles.widgetDesc}>Today's workout status and next milestone</Text>
        </View>

        <Text style={styles.sectionTitle}>Large Widget</Text>
        <View style={styles.widgetPreview}>
          <View style={styles.largeWidget}>
            <Text style={styles.widgetTitle}>Leaderboard</Text>
            <View style={styles.leaderboardPreview}>
              <Text style={styles.leaderboardItem}>🥇 FitnessPro - 45,230 XP</Text>
              <Text style={styles.leaderboardItem}>🥈 GymRat - 42,100 XP</Text>
              <Text style={styles.leaderboardItem}>🥉 You - 12,500 XP</Text>
            </View>
            <Text style={styles.friendsLabel}>Friends Activity</Text>
            <Text style={styles.friendActivity}>John completed a workout</Text>
          </View>
          <Text style={styles.widgetDesc}>Leaderboard position and friends' activity</Text>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Widget Settings</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-Refresh</Text>
              <Text style={styles.settingDesc}>Every 15 minutes</Text>
            </View>
            <Text style={styles.settingValue}>✓</Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Text style={styles.settingDesc}>Optimized for night viewing</Text>
            </View>
            <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
              <Text style={styles.settingToggle}>{darkMode ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDesc}>Get updates on milestones</Text>
            </View>
            <Text style={styles.settingValue}>✓</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Widget Features</Text>
          <Text style={styles.infoText}>
            • Small: Streak and XP at a glance{'\n'}
            • Medium: Today's workout status{'\n'}
            • Large: Leaderboard and friends{'\n'}
            • Auto-refresh every 15 minutes{'\n'}
            • Dark and light mode support
          </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeButton: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  widgetPreview: {
    marginBottom: 16,
  },
  smallWidget: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  widgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  widgetLabel: {
    fontSize: 12,
    color: '#888',
  },
  widgetValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00ff00',
  },
  mediumWidget: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  largeWidget: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  widgetContent: {
    marginBottom: 8,
  },
  widgetStat: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  leaderboardPreview: {
    marginBottom: 8,
  },
  leaderboardItem: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  friendsLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  friendActivity: {
    fontSize: 11,
    color: '#888',
  },
  widgetDesc: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  settingsSection: {
    marginTop: 24,
  },
  settingCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: '#888',
  },
  settingValue: {
    fontSize: 14,
    color: '#00ff00',
    fontWeight: 'bold',
  },
  settingToggle: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1a3a1a',
    borderRadius: 4,
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
});
