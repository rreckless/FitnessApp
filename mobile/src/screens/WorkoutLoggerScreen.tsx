import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';

interface WorkoutLoggerScreenProps {
  userId: string;
  onBack: () => void;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export const WorkoutLoggerScreen: React.FC<WorkoutLoggerScreenProps> = ({ userId, onBack }) => {
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: '3',
    reps: '10',
    weight: '0',
  });

  const addExercise = () => {
    if (!newExercise.name.trim()) {
      Alert.alert('Error', 'Please enter exercise name');
      return;
    }

    const exercise: Exercise = {
      id: Math.random().toString(),
      name: newExercise.name,
      sets: parseInt(newExercise.sets) || 3,
      reps: parseInt(newExercise.reps) || 10,
      weight: parseFloat(newExercise.weight) || 0,
    };

    setExercises([...exercises, exercise]);
    setNewExercise({ name: '', sets: '3', reps: '10', weight: '0' });
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id));
  };

  const completeWorkout = () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter workout name');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    const totalVolume = exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0);
    const xpEarned = Math.max(Math.floor(totalVolume / 100), 10);

    Alert.alert('Success', `Workout completed!\n\nExercises: ${exercises.length}\nTotal Volume: ${totalVolume} lbs\nXP Earned: ${xpEarned}`, [
      {
        text: 'OK',
        onPress: () => {
          setWorkoutName('');
          setExercises([]);
          setNewExercise({ name: '', sets: '3', reps: '10', weight: '0' });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log Workout</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.label}>Workout Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Chest Day"
            placeholderTextColor="#666"
            value={workoutName}
            onChangeText={setWorkoutName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Add Exercise</Text>

          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            placeholderTextColor="#666"
            value={newExercise.name}
            onChangeText={(text) => setNewExercise({ ...newExercise, name: text })}
          />

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.smallLabel}>Sets</Text>
              <TextInput
                style={styles.smallInput}
                placeholder="3"
                placeholderTextColor="#666"
                value={newExercise.sets}
                onChangeText={(text) => setNewExercise({ ...newExercise, sets: text })}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.smallLabel}>Reps</Text>
              <TextInput
                style={styles.smallInput}
                placeholder="10"
                placeholderTextColor="#666"
                value={newExercise.reps}
                onChangeText={(text) => setNewExercise({ ...newExercise, reps: text })}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.smallLabel}>Weight (lbs)</Text>
              <TextInput
                style={styles.smallInput}
                placeholder="0"
                placeholderTextColor="#666"
                value={newExercise.weight}
                onChangeText={(text) => setNewExercise({ ...newExercise, weight: text })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={addExercise}>
            <Text style={styles.addButtonText}>+ Add Exercise</Text>
          </TouchableOpacity>
        </View>

        {exercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Exercises ({exercises.length})</Text>

            {exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDetails}>
                    {exercise.sets} sets × {exercise.reps} reps @ {exercise.weight} lbs
                  </Text>
                  <Text style={styles.exerciseVolume}>
                    Volume: {exercise.sets * exercise.reps * exercise.weight} lbs
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeExercise(exercise.id)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.completeButton} onPress={completeWorkout}>
              <Text style={styles.completeButtonText}>✓ Complete Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How XP is Calculated</Text>
          <Text style={styles.infoText}>
            XP = max(Total Volume ÷ 100, 10) × Difficulty Multiplier
          </Text>
          <Text style={styles.infoText}>
            • Compound: 1.2x multiplier
            {'\n'}• Isolation: 1.0x multiplier
            {'\n'}• Cardio: 0.8x multiplier
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
  section: {
    marginBottom: 24,
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputGroup: {
    flex: 1,
    marginHorizontal: 4,
  },
  smallLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  smallInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseCard: {
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
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  exerciseVolume: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '500',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  completeButtonText: {
    color: '#000',
    fontSize: 16,
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
