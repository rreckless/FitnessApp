import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LeaderboardService, LeaderboardEntry, LeaderboardType } from '../services/LeaderboardService';

interface LeaderboardScreenProps {
  leaderboardService: LeaderboardService;
  userId: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  leaderboardService,
  userId,
}) => {
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [nearbyCompetitors, setNearbyCompetitors] = useState<LeaderboardEntry[]>([]);

  const loadLeaderboard = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      const result = await leaderboardService.getLeaderboardWithUserHighlight(
        leaderboardType,
        page
      );

      setEntries(result.entries);
      setCurrentPage(result.currentPage);
      setTotalPages(result.totalPages);

      if (result.userPosition) {
        setUserRank(result.userPosition.rank);
        setNearbyCompetitors(result.userPosition.nearbyCompetitors);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [leaderboardType, leaderboardService]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await leaderboardService.clearCache();
      await loadLeaderboard(1);
    } finally {
      setRefreshing(false);
    }
  }, [leaderboardService, loadLeaderboard]);

  useEffect(() => {
    loadLeaderboard(1);
  }, [leaderboardType, loadLeaderboard]);

  const handleTypeChange = (type: LeaderboardType) => {
    setLeaderboardType(type);
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      loadLeaderboard(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      loadLeaderboard(currentPage - 1);
    }
  };

  const renderLeaderboardEntry = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.userId === userId;
    const isNearby = nearbyCompetitors.some((c) => c.userId === item.userId);

    return (
      <View
        style={[
          styles.entryContainer,
          isCurrentUser && styles.currentUserEntry,
          isNearby && !isCurrentUser && styles.nearbyEntry,
        ]}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{item.rank}</Text>
        </View>

        <View style={styles.userInfoContainer}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userLevel}>Level {item.level}</Text>
        </View>

        <View style={styles.xpContainer}>
          <Text style={styles.xpText}>{item.xp.toLocaleString()} XP</Text>
        </View>

        {isCurrentUser && <Text style={styles.youBadge}>YOU</Text>}
      </View>
    );
  };

  const renderNearbyCompetitors = () => {
    if (nearbyCompetitors.length === 0) return null;

    return (
      <View style={styles.nearbySection}>
        <Text style={styles.sectionTitle}>Nearby Competitors</Text>
        <FlatList
          data={nearbyCompetitors}
          renderItem={renderLeaderboardEntry}
          keyExtractor={(item) => `${item.userId}-nearby`}
          scrollEnabled={false}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Leaderboard Type Selector */}
      <View style={styles.typeSelector}>
        {(['global', 'friends', 'weekly'] as LeaderboardType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              leaderboardType === type && styles.typeButtonActive,
            ]}
            onPress={() => handleTypeChange(type)}
          >
            <Text
              style={[
                styles.typeButtonText,
                leaderboardType === type && styles.typeButtonTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* User Position Summary */}
      {userRank !== null && (
        <View style={styles.userPositionSummary}>
          <Text style={styles.positionText}>Your Rank: #{userRank}</Text>
        </View>
      )}

      {/* Nearby Competitors */}
      {renderNearbyCompetitors()}

      {/* Main Leaderboard */}
      {loading && entries.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff00" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={entries}
            renderItem={renderLeaderboardEntry}
            keyExtractor={(item) => `${item.userId}-${item.rank}`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#00ff00"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No leaderboard data available</Text>
              </View>
            }
          />

          {/* Pagination Controls */}
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <Text style={styles.paginationButtonText}>← Previous</Text>
            </TouchableOpacity>

            <Text style={styles.pageIndicator}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[
                styles.paginationButton,
                currentPage === totalPages && styles.paginationButtonDisabled,
              ]}
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <Text style={styles.paginationButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 15,
    marginHorizontal: 5,
  },
  typeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  typeButtonActive: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  typeButtonText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#000',
  },
  userPositionSummary: {
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#00ff00',
  },
  positionText: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: '600',
  },
  nearbySection: {
    marginBottom: 15,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  entryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginVertical: 4,
    backgroundColor: '#222',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#555',
  },
  currentUserEntry: {
    backgroundColor: '#1a3a1a',
    borderLeftColor: '#00ff00',
  },
  nearbyEntry: {
    backgroundColor: '#2a2a3a',
    borderLeftColor: '#0088ff',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userLevel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpText: {
    color: '#00ff00',
    fontSize: 13,
    fontWeight: '600',
  },
  youBadge: {
    color: '#000',
    backgroundColor: '#00ff00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 10,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#00ff00',
    borderRadius: 6,
  },
  paginationButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  paginationButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  pageIndicator: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
});
