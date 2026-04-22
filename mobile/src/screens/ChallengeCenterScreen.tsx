import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface ChallengeCenterScreenProps {
  userId: string;
  onBack: () => void;
}

export const ChallengeCenterScreen: React.FC<ChallengeCenterScreenProps> = ({ userId, onBack }) => {
  const [selectedTab, setSelectedTab] = useState<'active' | 'available' | 'completed'>('active');

  const activeChallenges = [
    { id: 1, name: 'Week Warrior', type: 'XP', goal: 5000, progress: 3200, participants: 4 },
    { id: 2, name: 'Volume Master', type: 'Volume', goal: 50000, progress: 35000, participants: 3 },
  ];

  const availableChallenges = [
    { id: 3, name: 'Strength Sprint', type: 'XP', goal: 10000, participants: 12 },
    { id: 4, name: 'Consistency King', type: 'Streak', goal: 30, participants: 8 },
    { id: 5, name: 'Community Challenge', type: 'Volume', goal: 100000, participants: 45 },
  ];

  const completedChallenges = [
    { id: 6, name: 'First Challenge', placement: '2nd', reward: 100 },
    { id: 7, name: 'Beginner Streak', placement: '1st', reward: 250 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Challenge Center</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
          onPress={() => setSelectedTab('active')}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'available' && styles.activeTab]}
          onPress={() => setSelectedTab('available')}
        >
          <Text style={[styles.tabText, selectedTab === 'available' && styles.activeTabText]}>
            Available
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'completed' && styles.activeTab]}
          onPress={() => setSelectedTab('completed')}
        >
          <Text style={[styles.tabText, selectedTab === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'active' && (
          <View>
            <Text style={styles.sectionTitle}>Your Active Challenges</Text>
            {activeChallenges.map((challenge) => (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeName}>{challenge.name}</Text>
                  <Text style={styles.challengeType}>{challenge.type}</Text>
                </View>
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(challenge.progress / challenge.goal) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {challenge.progress} / {challenge.goal}
                  </Text>
                </View>
                <Text style={styles.participantsText}>👥 {challenge.participants} participants</Text>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'available' && (
          <View>
            <Text style={styles.sectionTitle}>Available Challenges</Text>
            {availableChallenges.map((challenge) => (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeName}>{challenge.name}</Text>
                  <Text style={styles.challengeType}>{challenge.type}</Text>
                </View>
                <Text style={styles.goalText}>Goal: {challenge.goal}</Text>
                <Text style={styles.participantsText}>👥 {challenge.participants} participants</Text>
                <TouchableOpacity style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>+ Join Challenge</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'completed' && (
          <View>
            <Text style={styles.sectionTitle}>Completed Challenges</Text>
            {completedChallenges.map((challenge) => (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeName}>{challenge.name}</Text>
                  <Text style={styles.placementBadge}>{challenge.placement}</Text>
                </View>
                <Text style={styles.rewardText}>🏆 +{challenge.reward} XP</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.createSection}>
          <TouchableOpacity style={styles.createButton}>
            <Text style={styles.createButtonText}>+ Create Challenge</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Challenge Types</Text>
          <Text style={styles.infoText}>
            • XP: Earn the most XP{'\n'}
            • Volume: Lift the most weight{'\n'}
            • Streak: Maintain the longest streak{'\n'}
            • Friend: Challenge specific friends{'\n'}
            • Community: Compete with everyone
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  challengeCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  challengeType: {
    fontSize: 11,
    backgroundColor: '#2a2a2a',
    color: '#888',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff00',
  },
  progressText: {
    fontSize: 11,
    color: '#888',
  },
  goalText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  participantsText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  placementBadge: {
    fontSize: 12,
    backgroundColor: '#00ff00',
    color: '#000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  rewardText: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
  createSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
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
