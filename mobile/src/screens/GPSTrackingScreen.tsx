import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface GPSTrackingScreenProps {
  userId: string;
  onBack: () => void;
}

export const GPSTrackingScreen: React.FC<GPSTrackingScreenProps> = ({ userId, onBack }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [metrics, setMetrics] = useState({
    distance: 5.2,
    pace: '9:45',
    elevation: 245,
    time: '50:36',
  });

  const recentWorkouts = [
    { id: 1, name: 'Morning Run', distance: 5.2, pace: '9:45', date: 'Today' },
    { id: 2, name: 'Evening Jog', distance: 3.8, pace: '11:20', date: 'Yesterday' },
    { id: 3, name: 'Park Loop', distance: 7.1, pace: '8:30', date: '2 days ago' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>GPS Tracking</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={styles.mapText}>Map View</Text>
          <Text style={styles.mapSubtext}>Real-time GPS tracking</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{metrics.distance} km</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pace</Text>
            <Text style={styles.metricValue}>{metrics.pace}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Elevation</Text>
            <Text style={styles.metricValue}>{metrics.elevation} m</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Time</Text>
            <Text style={styles.metricValue}>{metrics.time}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.trackingButton, isTracking && styles.trackingButtonActive]}
          onPress={() => setIsTracking(!isTracking)}
        >
          <Text style={styles.trackingButtonText}>
            {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {recentWorkouts.map((workout) => (
            <View key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutDetails}>
                  {workout.distance} km • {workout.pace} min/km
                </Text>
              </View>
              <Text style={styles.workoutDate}>{workout.date}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>GPS Features</Text>
          <Text style={styles.infoText}>
            • Real-time distance tracking{'\n'}
            • Pace calculation{'\n'}
            • Elevation tracking{'\n'}
            • Signal loss handling{'\n'}
            • Offline storage
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mapIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 12,
    color: '#888',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ff00',
  },
  trackingButton: {
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  trackingButtonActive: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  trackingButtonText: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  workoutCard: {
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
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  workoutDetails: {
    fontSize: 12,
    color: '#888',
  },
  workoutDate: {
    fontSize: 12,
    color: '#888',
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
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
