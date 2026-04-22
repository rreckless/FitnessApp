import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface RestTimerScreenProps {
  userId: string;
  onBack: () => void;
}

export const RestTimerScreen: React.FC<RestTimerScreenProps> = ({ userId, onBack }) => {
  const [exerciseType, setExerciseType] = useState<'compound' | 'isolation' | 'cardio'>('compound');
  const [timeRemaining, setTimeRemaining] = useState(150);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const suggestions = {
    compound: { min: 120, max: 180, recommended: 150 },
    isolation: { min: 60, max: 90, recommended: 75 },
    cardio: { min: 30, max: 45, recommended: 37 },
  };

  const current = suggestions[exerciseType];
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const handleReset = () => {
    setTimeRemaining(current.recommended);
    setIsRunning(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rest Timer</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.label}>Exercise Type</Text>
          <View style={styles.typeButtons}>
            {(['compound', 'isolation', 'cardio'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, exerciseType === type && styles.activeTypeButton]}
                onPress={() => {
                  setExerciseType(type);
                  setTimeRemaining(suggestions[type].recommended);
                  setIsRunning(false);
                }}
              >
                <Text style={[styles.typeButtonText, exerciseType === type && styles.activeTypeButtonText]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.timerSection}>
          <View style={styles.timerDisplay}>
            <Text style={styles.timerText}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => setIsRunning(!isRunning)}
            >
              <Text style={styles.buttonText}>{isRunning ? '⏸ Pause' : '▶ Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>↻ Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.suggestionsSection}>
          <Text style={styles.sectionTitle}>Recommended Rest Duration</Text>
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>Minimum</Text>
              <Text style={styles.suggestionValue}>{current.min}s</Text>
            </View>
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>Recommended</Text>
              <Text style={styles.suggestionValue}>{current.recommended}s</Text>
            </View>
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>Maximum</Text>
              <Text style={styles.suggestionValue}>{current.max}s</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Rest Duration Guidelines</Text>
          <Text style={styles.infoText}>
            • Compound: 2-3 minutes (150s recommended){'\n'}
            • Isolation: 60-90 seconds (75s recommended){'\n'}
            • Cardio: 30-45 seconds (37s recommended)
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
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeTypeButton: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  activeTypeButtonText: {
    color: '#000',
  },
  timerSection: {
    marginBottom: 24,
  },
  timerDisplay: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#00ff00',
    fontFamily: 'Courier New',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#00ff00',
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  secondaryButtonText: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  suggestionLabel: {
    fontSize: 12,
    color: '#888',
  },
  suggestionValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00ff00',
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
