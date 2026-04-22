import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';

interface RoutePlanningScreenProps {
  userId: string;
  onBack: () => void;
}

export const RoutePlanningScreen: React.FC<RoutePlanningScreenProps> = ({ userId, onBack }) => {
  const [routeName, setRouteName] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MODERATE' | 'HARD'>('MODERATE');

  const savedRoutes = [
    { id: 1, name: 'Central Park Loop', distance: 5.2, difficulty: 'EASY', rating: 4.5 },
    { id: 2, name: 'Mountain Trail', distance: 8.7, difficulty: 'HARD', rating: 4.8 },
    { id: 3, name: 'Riverside Path', distance: 3.2, difficulty: 'EASY', rating: 4.2 },
  ];

  const difficultyInfo = {
    EASY: { pace: '6 min/km', color: '#00ff00' },
    MODERATE: { pace: '5 min/km', color: '#ffaa00' },
    HARD: { pace: '4 min/km', color: '#ff4444' },
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Route Planning</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={styles.mapText}>Select Start & End Points</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Route Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Morning Run"
            placeholderTextColor="#666"
            value={routeName}
            onChangeText={setRouteName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.difficultyButtons}>
            {(['EASY', 'MODERATE', 'HARD'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.difficultyButton, difficulty === level && styles.activeDifficultyButton]}
                onPress={() => setDifficulty(level)}
              >
                <Text style={[styles.difficultyButtonText, difficulty === level && styles.activeDifficultyButtonText]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.estimateSection}>
          <Text style={styles.sectionTitle}>Estimated Metrics</Text>
          <View style={styles.estimateGrid}>
            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>Distance</Text>
              <Text style={styles.estimateValue}>5.2 km</Text>
            </View>
            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>Time</Text>
              <Text style={styles.estimateValue}>26 min</Text>
            </View>
            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>Pace</Text>
              <Text style={styles.estimateValue}>{difficultyInfo[difficulty].pace}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Create Route</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Routes</Text>
          {savedRoutes.map((route) => (
            <View key={route.id} style={styles.routeCard}>
              <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeDetails}>
                  {route.distance} km • {route.difficulty}
                </Text>
              </View>
              <View style={styles.routeRating}>
                <Text style={styles.ratingText}>⭐ {route.rating}</Text>
              </View>
            </View>
          ))}
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
    height: 150,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mapIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 12,
    color: '#888',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeDifficultyButton: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  difficultyButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  activeDifficultyButtonText: {
    color: '#000',
  },
  estimateSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  estimateGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  estimateCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ff00',
  },
  createButton: {
    backgroundColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  createButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  routeCard: {
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
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  routeDetails: {
    fontSize: 12,
    color: '#888',
  },
  routeRating: {
    alignItems: 'flex-end',
  },
  ratingText: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '600',
  },
});
