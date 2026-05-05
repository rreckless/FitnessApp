/**
 * Onboarding Screen - Multi-step onboarding flow for new users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { OnboardingService } from '../services/OnboardingService';
import { UserProfileService } from '../services/UserProfileService';
import {
  OnboardingStep,
  FitnessGoal,
  ExperienceLevel,
  Equipment,
  OnboardingState,
} from '../models/UserProfileModels';

interface OnboardingScreenProps {
  userId: string;
  email: string;
  name: string;
  onOnboardingComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  userId,
  email,
  name,
  onOnboardingComplete,
}) => {
  const [onboardingService] = useState(() =>
    OnboardingService.getInstance(undefined, UserProfileService.getInstance())
  );

  const [state, setState] = useState(() => onboardingService.initializeOnboarding());
  const [loading, setLoading] = useState(false);

  const handleGoalsSelection = (goals: FitnessGoal[]) => {
    try {
      const newState = onboardingService.setFitnessGoals(goals);
      setState(newState);
    } catch (error) {
      console.error('Error setting fitness goals:', error);
      Alert.alert('Error', 'Failed to set fitness goals');
    }
  };

  const handleExperienceSelection = (level: ExperienceLevel) => {
    try {
      const newState = onboardingService.setExperienceLevel(level);
      setState(newState);
    } catch (error) {
      console.error('Error setting experience level:', error);
      Alert.alert('Error', 'Failed to set experience level');
    }
  };

  const handleEquipmentSelection = (equipment: Equipment[]) => {
    try {
      const newState = onboardingService.setAvailableEquipment(equipment);
      setState(newState);
    } catch (error) {
      console.error('Error setting equipment:', error);
      Alert.alert('Error', 'Failed to set equipment');
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      // Ensure the service state is up to date with the current UI state
      if (state.fitnessGoals && state.fitnessGoals.length > 0) {
        onboardingService.setFitnessGoals(state.fitnessGoals);
      }
      if (state.experienceLevel) {
        onboardingService.setExperienceLevel(state.experienceLevel);
      }
      if (state.availableEquipment && state.availableEquipment.length > 0) {
        onboardingService.setAvailableEquipment(state.availableEquipment);
      }

      await onboardingService.completeOnboarding(userId, email, name);
      onOnboardingComplete();
    } catch (error) {
      console.error('Onboarding completion error:', error);
      Alert.alert('Error', 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const progress = onboardingService.getOnboardingProgress();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to FitQuest</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}% Complete</Text>
      </View>

      <ScrollView style={styles.content}>
        {state.currentStep === OnboardingStep.GOALS && (
          <GoalsStep selectedGoals={state.fitnessGoals || []} onSelect={handleGoalsSelection} />
        )}
        {state.currentStep === OnboardingStep.EXPERIENCE && (
          <ExperienceStep selectedLevel={state.experienceLevel} onSelect={handleExperienceSelection} />
        )}
        {state.currentStep === OnboardingStep.EQUIPMENT && (
          <EquipmentStep selectedEquipment={state.availableEquipment || []} onSelect={handleEquipmentSelection} />
        )}
        {state.currentStep === OnboardingStep.COMPLETE && <CompleteStep />}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.buttonDisabled]}
          onPress={completeOnboarding}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {state.currentStep === OnboardingStep.COMPLETE ? 'Get Started' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const GoalsStep: React.FC<{ selectedGoals: FitnessGoal[]; onSelect: (goals: FitnessGoal[]) => void }> = ({
  selectedGoals,
  onSelect,
}) => {
  const goals = [
    { value: FitnessGoal.STRENGTH, label: 'Build Strength' },
    { value: FitnessGoal.ENDURANCE, label: 'Improve Endurance' },
    { value: FitnessGoal.WEIGHT_LOSS, label: 'Lose Weight' },
    { value: FitnessGoal.MUSCLE_GAIN, label: 'Gain Muscle' },
  ];

  const toggleGoal = (goal: FitnessGoal) => {
    const newGoals = selectedGoals.includes(goal)
      ? selectedGoals.filter((g) => g !== goal)
      : [...selectedGoals, goal];
    onSelect(newGoals);
  };

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>What are your fitness goals?</Text>
      {goals.map((goal) => (
        <TouchableOpacity
          key={goal.value}
          style={[styles.option, selectedGoals.includes(goal.value) && styles.optionSelected]}
          onPress={() => toggleGoal(goal.value)}
        >
          <View style={[styles.checkbox, selectedGoals.includes(goal.value) && styles.checkboxSelected]}>
            {selectedGoals.includes(goal.value) && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.optionLabel}>{goal.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ExperienceStep: React.FC<{ selectedLevel?: ExperienceLevel; onSelect: (level: ExperienceLevel) => void }> = ({
  selectedLevel,
  onSelect,
}) => {
  const levels = [
    { value: ExperienceLevel.BEGINNER, label: 'Beginner' },
    { value: ExperienceLevel.INTERMEDIATE, label: 'Intermediate' },
    { value: ExperienceLevel.ADVANCED, label: 'Advanced' },
  ];

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>What's your experience level?</Text>
      {levels.map((level) => (
        <TouchableOpacity
          key={level.value}
          style={[styles.option, selectedLevel === level.value && styles.optionSelected]}
          onPress={() => onSelect(level.value)}
        >
          <View style={[styles.radioButton, selectedLevel === level.value && styles.radioButtonSelected]}>
            {selectedLevel === level.value && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={styles.optionLabel}>{level.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const EquipmentStep: React.FC<{ selectedEquipment: Equipment[]; onSelect: (equipment: Equipment[]) => void }> = ({
  selectedEquipment,
  onSelect,
}) => {
  const equipment = [
    { value: Equipment.DUMBBELLS, label: 'Dumbbells' },
    { value: Equipment.BARBELL, label: 'Barbell' },
    { value: Equipment.MACHINES, label: 'Machines' },
    { value: Equipment.BODYWEIGHT, label: 'Bodyweight' },
  ];

  const toggleEquipment = (eq: Equipment) => {
    const newEquipment = selectedEquipment.includes(eq)
      ? selectedEquipment.filter((e) => e !== eq)
      : [...selectedEquipment, eq];
    onSelect(newEquipment);
  };

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>What equipment do you have?</Text>
      <View style={styles.equipmentGrid}>
        {equipment.map((eq) => (
          <TouchableOpacity
            key={eq.value}
            style={[styles.equipmentCard, selectedEquipment.includes(eq.value) && styles.equipmentCardSelected]}
            onPress={() => toggleEquipment(eq.value)}
          >
            <Text style={styles.equipmentLabel}>{eq.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const CompleteStep: React.FC = () => (
  <View style={styles.step}>
    <Text style={styles.stepTitle}>You're All Set!</Text>
    <Text style={styles.stepDescription}>Your profile is ready. Let's start your fitness journey!</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#2196F3', paddingTop: 40, paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  progressText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  content: { flex: 1, padding: 20 },
  step: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  stepDescription: { fontSize: 14, color: '#666', marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  optionSelected: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxSelected: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  radioButton: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioButtonSelected: { borderColor: '#2196F3' },
  radioButtonInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2196F3' },
  optionLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  equipmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  equipmentCard: { flex: 1, minWidth: '45%', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  equipmentCardSelected: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  equipmentLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  footer: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  nextButton: { backgroundColor: '#2196F3', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
