import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import WidgetService, { WidgetData, WidgetError } from '@services/WidgetService';

interface SmallWidgetProps {
  userId: string;
  onTap?: () => void;
}

export const SmallWidget: React.FC<SmallWidgetProps> = ({ userId, onTap }) => {
  const [data, setData] = useState<WidgetData | null>(null);
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
      const widgetData = await WidgetService.getSmallWidgetData(userId);
      WidgetService.validateWidgetData(widgetData);
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
      <View style={styles.streakSection}>
        <Text style={styles.label}>Streak</Text>
        <Text style={styles.streakValue}>{data.currentStreak}</Text>
        <Text style={styles.subtext}>days</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.xpSection}>
        <Text style={styles.label}>Level {data.level}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${data.xpProgress}%` },
            ]}
          />
        </View>
        <Text style={styles.xpText}>{data.xpProgress}%</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    streakSection: {
      alignItems: 'center',
      flex: 1,
    },
    xpSection: {
      alignItems: 'center',
      flex: 1,
    },
    divider: {
      width: 1,
      height: 60,
      backgroundColor: isDark ? '#333333' : '#e0e0e0',
      marginHorizontal: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#999999' : '#666666',
      marginBottom: 4,
    },
    streakValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#ff6b6b' : '#ff5252',
    },
    subtext: {
      fontSize: 11,
      color: isDark ? '#999999' : '#999999',
      marginTop: 2,
    },
    progressBar: {
      width: 80,
      height: 6,
      backgroundColor: isDark ? '#333333' : '#e0e0e0',
      borderRadius: 3,
      marginVertical: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: isDark ? '#4ecdc4' : '#00bcd4',
      borderRadius: 3,
    },
    xpText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#4ecdc4' : '#00bcd4',
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

export default SmallWidget;
