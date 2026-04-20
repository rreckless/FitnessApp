import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, ScrollView } from 'react-native';
import WidgetService, { LeaderboardWidgetData, WidgetError } from '@services/WidgetService';

interface LargeWidgetProps {
  userId: string;
  onTap?: () => void;
}

export const LargeWidget: React.FC<LargeWidgetProps> = ({ userId, onTap }) => {
  const [data, setData] = useState<LeaderboardWidgetData | null>(null);
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
      const widgetData = await WidgetService.getLargeWidgetData(userId);
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
    <ScrollView style={styles.container} onTouchEnd={onTap}>
      {/* User Position Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Position</Text>
        <View style={styles.positionCard}>
          <Text style={styles.positionRank}>#{data.userPosition}</Text>
          <Text style={styles.positionXP}>{data.userXP} XP</Text>
        </View>
      </View>

      {/* Top 3 Leaderboard Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Players</Text>
        {data.topThreeUsers.length > 0 ? (
          data.topThreeUsers.map((user, index) => (
            <View key={index} style={styles.leaderboardRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{user.rank}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userLevel}>Level {user.level}</Text>
              </View>
              <Text style={styles.userXP}>{user.xp} XP</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No leaderboard data</Text>
        )}
      </View>

      {/* Friends Activity Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends Activity</Text>
        {data.friendsActivity.length > 0 ? (
          data.friendsActivity.map((activity, index) => (
            <View key={index} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityName}>{activity.friendName}</Text>
                <Text style={styles.activityText}>{activity.activity}</Text>
              </View>
              <Text style={styles.activityTime}>
                {formatTime(activity.timestamp)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent activity</Text>
        )}
      </View>
    </ScrollView>
  );
};

const formatTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 12,
    },
    positionCard: {
      backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    positionRank: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#4ecdc4' : '#00bcd4',
      marginBottom: 4,
    },
    positionXP: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#999999' : '#666666',
    },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333333' : '#e0e0e0',
    },
    rankBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    rankText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: isDark ? '#4ecdc4' : '#00bcd4',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
    },
    userLevel: {
      fontSize: 12,
      color: isDark ? '#999999' : '#999999',
      marginTop: 2,
    },
    userXP: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#ffd700' : '#ffa500',
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333333' : '#e0e0e0',
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? '#4ecdc4' : '#00bcd4',
      marginRight: 12,
    },
    activityInfo: {
      flex: 1,
    },
    activityName: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
    },
    activityText: {
      fontSize: 12,
      color: isDark ? '#999999' : '#999999',
      marginTop: 2,
    },
    activityTime: {
      fontSize: 11,
      color: isDark ? '#666666' : '#cccccc',
    },
    emptyText: {
      fontSize: 13,
      color: isDark ? '#999999' : '#999999',
      textAlign: 'center',
      paddingVertical: 16,
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

export default LargeWidget;
