import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import WidgetService, { WorkoutStatusData, WidgetError } from '@services/WidgetService';

interface MediumWidgetProps {
  userId: string;
  onTap?: () => void;
}

export const MediumWidget: React.FC<MediumWidgetProps> = ({ userId, onTap }) => {
  const [data, setData] = useState<WorkoutStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    loadWidgetData();
    const interval = setInterval(loadWidgetData, WidgetService.getRefreshInterval());
    return () => clearInterval(interval);
  }, [userId]);

  const loadWidgetData = async () => {
    try {
      setLoading(true);
      const widgetData = await WidgetService.getMediumWidgetData(userId);
      setData(widgetData);
      setError(null);
    } catch (err) {
      if (err instanceof WidgetError) {
        setError(err.message);
      } else {
        setError('Failed to load widget data');
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(isDark);

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'No data'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onTouchEnd={onTap}>
      <View style={styles.topSection}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Today's Workout</Text>
          <Text style={styles.statusValue}>
            {data.hasWorkoutToday ? '✓ Done' : 'Not yet'}
          </Text>
          {data.workoutCount > 0 && (
            <Text style={styles.workoutCount}>{data.workoutCount} workout(s)</Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomSection}>
        <Text style={styles.milestoneLabel}>Next Milestone</Text>
        <Text style={styles.milestoneValue}>{data.nextMilestone}</Text>
        <Text style={styles.daysText}>{data.daysUntilMilestone} days away</Text>
      </View>
    </View>
  );
};

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    topSection: {
      flex: 1,
      justifyContent: 'center',
    },
    bottomSection: {
      flex: 1,
      justifyContent: 'center',
    },
    statusCard: {
      backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    statusLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#999999' : '#666666',
      marginBottom: 4,
    },
    statusValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#4ecdc4' : '#00bcd4',
      marginBottom: 4,
    },
    workoutCount: {
      fontSize: 11,
      color: isDark ? '#999999' : '#999999',
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? '#333333' : '#e0e0e0',
      marginVertical: 12,
    },
    milestoneLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#999999' : '#666666',
      marginBottom: 4,
    },
    milestoneValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#ffd700' : '#ffa500',
      marginBottom: 4,
    },
    daysText: {
      fontSize: 12,
      color: isDark ? '#999999' : '#999999',
    },
    loadingText: {
      fontSize: 14,
      color: isDark ? '#999999' : '#666666',
      textAlign: 'center',
    },
    errorText: {
      fontSize: 12,
      color: isDark ? '#ff6b6b' : '#ff5252',
      textAlign: 'center',
    },
  });

export default MediumWidget;
