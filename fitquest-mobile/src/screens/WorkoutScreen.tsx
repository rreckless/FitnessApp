/**
 * Workout Screen
 * Allows users to log exercises with sets, reps, and weight
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
  Modal,
} from 'react-native';
import { WorkoutLogger } from '../services/WorkoutLogger';
import { ExerciseLibraryService } from '../services/ExerciseLibraryService';
import { Exercise, WorkoutSet } from '../models/ExerciseModels';

interface WorkoutScreenProps {
  onWorkoutComplete: () => void;
  onCancel: () => void;
}

interface ExerciseEntry {
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
}

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({
  onWorkoutComplete,
  onCancel,
}) => {
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    calculateTotalVolume();
  }, [exercises]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      const libraryService = ExerciseLibraryService.getInstance();
      const allExercises = await libraryService.getAllExercises();
      setAvailableExercises(allExercises);
    } catch (err) {
      Alert.alert('Error', 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalVolume = () => {
    let total = 0;
    exercises.forEach((entry) => {
      entry.sets.forEach((set) => {
        total += (set.weight || 0) * (set.reps || 0);
      });
    });
    setTotalVolume(total);
  };

  const addExercise = (exercise: Exercise) => {
    const newEntry: ExerciseEntry = {
      exerciseId: exercise.id,
      exercise,
      sets: [{ reps: 0, weight: 0 }],
    };
    setExercises([...exercises, newEntry]);
    setShowExerciseModal(false);
    setSearchQuery('');
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    const newExercises = [...exercises];
    const numValue = parseInt(value) || 0;

    if (field === 'reps') {
      newExercises[exerciseIndex].sets[setIndex].reps = numValue;
    } else {
      newExercises[exerciseIndex].sets[setIndex].weight = numValue;
    }

    setExercises(newExercises);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets.push({ reps: 0, weight: 0 });
    setExercises(newExercises);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter(
      (_, i) => i !== setIndex
    );
    setExercises(newExercises);
  };

  const handleCompleteWorkout = async () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise');
      return;
    }

    try {
      setLoading(true);
      const logger = WorkoutLogger.getInstance();
      const workoutData = {
        exercises: exercises.map((entry) => ({
          exerciseId: entry.exerciseId,
          sets: entry.sets,
        })),
      };
      await logger.completeWorkout(workoutData);
      Alert.alert('Success', 'Workout logged successfully!');
      onWorkoutComplete();
    } catch (err) {
      Alert.alert('Error', 'Failed to log workout');
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = availableExercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Workout</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Exercises</Text>
            <Text style={styles.summaryValue}>{exercises.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Volume</Text>
            <Text style={styles.summaryValue}>{totalVolume.toLocaleString()} lbs</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setShowExerciseModal(true)}
        >
          <Text style={styles.addExerciseButtonText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {exercises.length > 0 && (
          <View style={styles.exercisesContainer}>
            {exercises.map((entry, exerciseIndex) => (
              <View key={exerciseIndex} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{entry.exercise.name}</Text>
                    <Text style={styles.exerciseMuscleGroup}>
                      {entry.exercise.primaryMuscleGroup}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(exerciseIndex)}>
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.setsContainer}>
                  {entry.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                      <View style={styles.setInputs}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Reps</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="number-pad"
                            value={set.reps?.toString() || ''}
                            onChangeText={(value) =>
                              updateSet(exerciseIndex, setIndex, 'reps', value)
                            }
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Weight (lbs)</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="number-pad"
                            value={set.weight?.toString() || ''}
                            onChangeText={(value) =>
                              updateSet(exerciseIndex, setIndex, 'weight', value)
                            }
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.removeSetButton}
                          onPress={() => removeSet(exerciseIndex, setIndex)}
                        >
                          <Text style={styles.removeSetButtonText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Text style={styles.addSetButtonText}>+ Add Set</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No exercises added yet</Text>
            <Text style={styles.emptyStateSubtext}>Tap "Add Exercise" to get started</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.completeButton, loading && styles.buttonDisabled]}
          onPress={handleCompleteWorkout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.completeButtonText}>Complete Workout</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showExerciseModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <View style={{ width: 60 }} />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />

          <ScrollView contentContainerStyle={styles.exercisesList}>
            {filteredExercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                style={styles.exerciseOption}
                onPress={() => addExercise(exercise)}
              >
                <View>
                  <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                  <Text style={styles.exerciseOptionMuscle}>
                    {exercise.primaryMuscleGroup}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  cancelButton: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#eee',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  addExerciseButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exercisesContainer: {
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMuscleGroup: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500',
  },
  setsContainer: {
    marginBottom: 12,
  },
  setRow: {
    marginBottom: 12,
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  removeSetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeSetButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addSetButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSetButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
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
  completeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
  },
  exercisesList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  exerciseOption: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseOptionMuscle: {
    fontSize: 12,
    color: '#999',
  },
});
