/**
 * Exercise Library Screen
 * Browse and search exercises with filtering by muscle group
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { ExerciseLibraryService } from '../services/ExerciseLibraryService';
import { Exercise } from '../models/ExerciseModels';

interface ExerciseLibraryScreenProps {
  onClose: () => void;
}

export const ExerciseLibraryScreen: React.FC<ExerciseLibraryScreenProps> = ({ onClose }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const muscleGroups = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [exercises, searchQuery, selectedMuscleGroup]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      const libraryService = ExerciseLibraryService.getInstance();
      const allExercises = await libraryService.getAllExercises();
      setExercises(allExercises);
    } catch (err) {
      Alert.alert('Error', 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    if (selectedMuscleGroup && selectedMuscleGroup !== 'All') {
      filtered = filtered.filter(
        (ex) =>
          ex.primaryMuscleGroup === selectedMuscleGroup ||
          ex.secondaryMuscleGroups?.includes(selectedMuscleGroup)
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((ex) =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredExercises(filtered);
  };

  const handleExercisePress = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setShowDetails(true);
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={styles.exerciseItem}
      onPress={() => handleExercisePress(item)}
    >
      <View style={styles.exerciseItemContent}>
        <Text style={styles.exerciseName}>{item.name}</Text>
        <Text style={styles.exerciseMuscleGroup}>{item.primaryMuscleGroup}</Text>
        {item.secondaryMuscleGroups && item.secondaryMuscleGroups.length > 0 && (
          <Text style={styles.exerciseSecondary}>
            Secondary: {item.secondaryMuscleGroups.join(', ')}
          </Text>
        )}
      </View>
      <Text style={styles.exerciseDifficulty}>{item.difficulty}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Library</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.muscleGroupsContainer}
      >
        {muscleGroups.map((group) => (
          <TouchableOpacity
            key={group}
            style={[
              styles.muscleGroupButton,
              (selectedMuscleGroup === group || (group === 'All' && !selectedMuscleGroup)) &&
                styles.muscleGroupButtonActive,
            ]}
            onPress={() => setSelectedMuscleGroup(group === 'All' ? null : group)}
          >
            <Text
              style={[
                styles.muscleGroupButtonText,
                (selectedMuscleGroup === group || (group === 'All' && !selectedMuscleGroup)) &&
                  styles.muscleGroupButtonTextActive,
              ]}
            >
              {group}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={filteredExercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No exercises found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />

      <Modal visible={showDetails} animationType="slide">
        <SafeAreaView style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.detailsTitle}>Exercise Details</Text>
            <View style={{ width: 60 }} />
          </View>

          {selectedExercise && (
            <ScrollView contentContainerStyle={styles.detailsContent}>
              <View style={styles.detailsCard}>
                <Text style={styles.detailsName}>{selectedExercise.name}</Text>

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Primary Muscle Group</Text>
                  <Text style={styles.detailsValue}>{selectedExercise.primaryMuscleGroup}</Text>
                </View>

                {selectedExercise.secondaryMuscleGroups &&
                  selectedExercise.secondaryMuscleGroups.length > 0 && (
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Secondary Muscle Groups</Text>
                      <Text style={styles.detailsValue}>
                        {selectedExercise.secondaryMuscleGroups.join(', ')}
                      </Text>
                    </View>
                  )}

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Difficulty</Text>
                  <Text style={styles.detailsValue}>{selectedExercise.difficulty}</Text>
                </View>

                {selectedExercise.equipment && selectedExercise.equipment.length > 0 && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Equipment</Text>
                    <Text style={styles.detailsValue}>{selectedExercise.equipment.join(', ')}</Text>
                  </View>
                )}

                {selectedExercise.description && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>Description</Text>
                    <Text style={styles.detailsDescription}>{selectedExercise.description}</Text>
                  </View>
                )}

                {selectedExercise.formTips && selectedExercise.formTips.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>Form Tips</Text>
                    {selectedExercise.formTips.map((tip, index) => (
                      <Text key={index} style={styles.formTip}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  muscleGroupsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  muscleGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  muscleGroupButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  muscleGroupButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  muscleGroupButtonTextActive: {
    color: '#fff',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 12,
    color: '#999',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  exerciseItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMuscleGroup: {
    fontSize: 12,
    color: '#2196F3',
    marginBottom: 2,
  },
  exerciseSecondary: {
    fontSize: 11,
    color: '#999',
  },
  exerciseDifficulty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailsSection: {
    marginTop: 16,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailsDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  formTip: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
});
