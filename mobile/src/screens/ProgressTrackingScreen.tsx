import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface ProgressTrackingScreenProps {
  userId: string;
  onBack: () => void;
}

export const ProgressTrackingScreen: React.FC<ProgressTrackingScreenProps> = ({ userId, onBack }) => {
  const [selectedTab, setSelectedTab] = useState<'prs' | 'volume'>('prs');

  const personalRecords = [
    { exercise: 'Bench Press', weight: 225, date: '2024-04-20', reps: 5 },
    { exercise: 'Squat', weight: 315, date: '2024-04-18', reps: 3 },
    { exercise: 'Deadlift', weight: 405, date: '2024-04-15', reps: 1 },
    { exercise: 'Overhead Press', weight: 155, date: '2024-04-10', reps: 5 },
  ];

  const volumeData = [
    { period: 'This Week', volume: 12500, trend: '↑ +15%' },
    { period: 'Last Week', volume: 10870, trend: '↑ +8%' },
    { period: 'This Month', volume: 48200, trend: '↑ +22%' },
    { period: 'Last Month', volume: 39500, trend: '↑ +5%' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Progress Tracking</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'prs' && styles.activeTab]}
          onPress={() => setSelectedTab('prs')}
        >
          <Text style={[styles.tabText, selectedTab === 'prs' && styles.activeTabText]}>
            Personal Records
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'volume' && styles.activeTab]}
          onPress={() => setSelectedTab('volume')}
        >
          <Text style={[styles.tabText, selectedTab === 'volume' && styles.activeTabText]}>
            Volume Tracking
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'prs' ? (
          <View>
            <Text style={styles.sectionTitle}>Your Personal Records</Text>
            {personalRecords.map((pr, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.exerciseName}>{pr.exercise}</Text>
                  <Text style={styles.prBadge}>{pr.weight} lbs</Text>
                </View>
                <Text style={styles.cardDetail}>{pr.reps} rep max • {pr.date}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Volume Tracking</Text>
            {volumeData.map((data, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.periodName}>{data.period}</Text>
                  <Text style={styles.trendText}>{data.trend}</Text>
                </View>
                <View style={styles.volumeBar}>
                  <View
                    style={[
                      styles.volumeFill,
                      { width: `${Math.min((data.volume / 50000) * 100, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.volumeValue}>{data.volume.toLocaleString()} lbs</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Chart Types Available</Text>
          <View style={styles.chartGrid}>
            <View style={styles.chartCard}>
              <Text style={styles.chartIcon}>📈</Text>
              <Text style={styles.chartName}>Line Chart</Text>
              <Text style={styles.chartDesc}>Trend over time</Text>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartIcon}>📊</Text>
              <Text style={styles.chartName}>Bar Chart</Text>
              <Text style={styles.chartDesc}>Period comparison</Text>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartIcon}>🥧</Text>
              <Text style={styles.chartName}>Pie Chart</Text>
              <Text style={styles.chartDesc}>Muscle group split</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.exportButton}>
          <Text style={styles.exportButtonText}>📥 Export Data</Text>
        </TouchableOpacity>
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  prBadge: {
    backgroundColor: '#00ff00',
    color: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardDetail: {
    fontSize: 12,
    color: '#888',
  },
  periodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  trendText: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '600',
  },
  volumeBar: {
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: '#00ff00',
  },
  volumeValue: {
    fontSize: 12,
    color: '#888',
  },
  chartSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  chartGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  chartIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  chartName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chartDesc: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  exportButton: {
    backgroundColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
