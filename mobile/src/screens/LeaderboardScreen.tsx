import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface LeaderboardScreenProps {
  userId: string;
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ userId, onBack }) => {
  const [selectedTab, setSelectedTab] = useState<'global' | 'friends' | 'weekly'>('global');

  const globalLeaderboard = [
    { rank: 1, name: 'FitnessPro', xp: 45230, level: 28 },
    { rank: 2, name: 'GymRat', xp: 42100, level: 27 },
    { rank: 3, name: 'StrengthKing', xp: 39850, level: 26 },
    { rank: 4, name: 'You', xp: 12500, level: 8, isUser: true },
    { rank: 5, name: 'Cardio Queen', xp: 11200, level: 7 },
  ];

  const friendsLeaderboard = [
    { rank: 1, name: 'John', xp: 28500, level: 18 },
    { rank: 2, name: 'Sarah', xp: 24300, level: 16 },
    { rank: 3, name: 'You', xp: 12500, level: 8, isUser: true },
    { rank: 4, name: 'Mike', xp: 9800, level: 6 },
  ];

  const weeklyLeaderboard = [
    { rank: 1, name: 'GymRat', xp: 2450, level: 27 },
    { rank: 2, name: 'You', xp: 1850, level: 8, isUser: true },
    { rank: 3, name: 'John', xp: 1620, level: 18 },
    { rank: 4, name: 'Sarah', xp: 1200, level: 16 },
  ];

  const getLeaderboard = () => {
    switch (selectedTab) {
      case 'friends':
        return friendsLeaderboard;
      case 'weekly':
        return weeklyLeaderboard;
      default:
        return globalLeaderboard;
    }
  };

  const leaderboard = getLeaderboard();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'global' && styles.activeTab]}
          onPress={() => setSelectedTab('global')}
        >
          <Text style={[styles.tabText, selectedTab === 'global' && styles.activeTabText]}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'friends' && styles.activeTab]}
          onPress={() => setSelectedTab('friends')}
        >
          <Text style={[styles.tabText, selectedTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'weekly' && styles.activeTab]}
          onPress={() => setSelectedTab('weekly')}
        >
          <Text style={[styles.tabText, selectedTab === 'weekly' && styles.activeTabText]}>
            Weekly
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {leaderboard.map((entry) => (
          <View
            key={entry.rank}
            style={[styles.leaderboardEntry, entry.isUser && styles.userEntry]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{entry.rank}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{entry.name}</Text>
              <Text style={styles.userLevel}>Level {entry.level}</Text>
            </View>
            <View style={styles.xpInfo}>
              <Text style={styles.xpValue}>{entry.xp.toLocaleString()}</Text>
              <Text style={styles.xpLabel}>XP</Text>
            </View>
          </View>
        ))}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How Rankings Work</Text>
          <Text style={styles.infoText}>
            • Global: Ranked by total XP across all time
            {'\n'}• Friends: Ranked by total XP among your friends
            {'\n'}• Weekly: Ranked by XP earned this week (resets Monday)
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#00ff00',
  },
  tabText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#00ff00',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  userEntry: {
    borderColor: '#00ff00',
    backgroundColor: '#1a3a1a',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userLevel: {
    fontSize: 12,
    color: '#888',
  },
  xpInfo: {
    alignItems: 'flex-end',
  },
  xpValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ff00',
  },
  xpLabel: {
    fontSize: 10,
    color: '#888',
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginTop: 24,
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
