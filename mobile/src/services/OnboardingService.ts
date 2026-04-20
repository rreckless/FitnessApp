import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthenticationService from './AuthenticationService';
import UserProfileService from './UserProfileService';

export enum OnboardingStep {
  Goals = 'GOALS',
  ExperienceLevel = 'EXPERIENCE_LEVEL',
  WorkoutFrequency = 'WORKOUT_FREQUENCY',
  Equipment = 'EQUIPMENT',
  Complete = 'COMPLETE',
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  selectedGoals: string[];
  selectedExperienceLevel: string | null;
  selectedWorkoutFrequency: number | null;
  selectedEquipment: string[];
  isLoading: boolean;
  errorMessage: string | null;
}

export class OnboardingService {
  private static instance: OnboardingService;
  private authService = AuthenticationService;
  private userProfileService = UserProfileService;

  private state: OnboardingState = {
    currentStep: OnboardingStep.Goals,
    selectedGoals: [],
    selectedExperienceLevel: null,
    selectedWorkoutFrequency: null,
    selectedEquipment: [],
    isLoading: false,
    errorMessage: null,
  };

  private constructor() {}

  static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  /**
   * Get current onboarding state
   */
  getState(): OnboardingState {
    return { ...this.state };
  }

  /**
   * Select fitness goals
   */
  selectGoals(goals: string[]): void {
    this.state.selectedGoals = goals;
    this.state.errorMessage = null;
  }

  /**
   * Proceed from goals step
   */
  proceedFromGoals(): void {
    if (this.state.selectedGoals.length === 0) {
      this.state.errorMessage = 'Please select at least one fitness goal';
      return;
    }
    this.state.currentStep = OnboardingStep.ExperienceLevel;
    this.state.errorMessage = null;
  }

  /**
   * Select experience level
   */
  selectExperienceLevel(level: string): void {
    this.state.selectedExperienceLevel = level;
    this.state.errorMessage = null;
  }

  /**
   * Proceed from experience level step
   */
  proceedFromExperienceLevel(): void {
    if (!this.state.selectedExperienceLevel) {
      this.state.errorMessage = 'Please select your experience level';
      return;
    }
    this.state.currentStep = OnboardingStep.WorkoutFrequency;
    this.state.errorMessage = null;
  }

  /**
   * Select workout frequency
   */
  selectWorkoutFrequency(frequency: number): void {
    this.state.selectedWorkoutFrequency = frequency;
    this.state.errorMessage = null;
  }

  /**
   * Proceed from workout frequency step
   */
  proceedFromWorkoutFrequency(): void {
    if (!this.state.selectedWorkoutFrequency) {
      this.state.errorMessage = 'Please select your workout frequency';
      return;
    }
    this.state.currentStep = OnboardingStep.Equipment;
    this.state.errorMessage = null;
  }

  /**
   * Select available equipment
   */
  selectEquipment(equipment: string[]): void {
    this.state.selectedEquipment = equipment;
    this.state.errorMessage = null;
  }

  /**
   * Proceed from equipment step
   */
  proceedFromEquipment(): void {
    if (this.state.selectedEquipment.length === 0) {
      this.state.errorMessage = 'Please select at least one equipment type';
      return;
    }
    this.state.currentStep = OnboardingStep.Complete;
    this.state.errorMessage = null;
  }

  /**
   * Complete onboarding and save preferences
   */
  async completeOnboarding(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.state.errorMessage = 'No user found';
      throw new Error('No user found');
    }

    this.state.isLoading = true;

    try {
      // Save fitness goals
      await this.userProfileService.setFitnessGoals(user.id, this.state.selectedGoals);

      // Save experience level
      if (this.state.selectedExperienceLevel) {
        await this.userProfileService.setExperienceLevel(user.id, this.state.selectedExperienceLevel);
      }

      // Save workout frequency
      if (this.state.selectedWorkoutFrequency) {
        await this.userProfileService.setWorkoutFrequency(user.id, this.state.selectedWorkoutFrequency);
      }

      // Save equipment
      await this.userProfileService.setAvailableEquipment(user.id, this.state.selectedEquipment);

      // Mark onboarding as complete
      await AsyncStorage.setItem('onboardingComplete', 'true');

      this.state.errorMessage = null;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to complete onboarding';
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Skip onboarding with defaults
   */
  async skipOnboarding(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.state.errorMessage = 'No user found';
      throw new Error('No user found');
    }

    this.state.isLoading = true;

    try {
      // Set default preferences
      await this.userProfileService.setFitnessGoals(user.id, ['STRENGTH']);
      await this.userProfileService.setExperienceLevel(user.id, 'BEGINNER');
      await this.userProfileService.setWorkoutFrequency(user.id, 3);
      await this.userProfileService.setAvailableEquipment(user.id, ['DUMBBELLS', 'BODYWEIGHT']);

      // Mark onboarding as complete
      await AsyncStorage.setItem('onboardingComplete', 'true');

      this.state.errorMessage = null;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to skip onboarding';
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Go back to previous step
   */
  goBack(): void {
    switch (this.state.currentStep) {
      case OnboardingStep.Goals:
        break; // Can't go back from first step
      case OnboardingStep.ExperienceLevel:
        this.state.currentStep = OnboardingStep.Goals;
        break;
      case OnboardingStep.WorkoutFrequency:
        this.state.currentStep = OnboardingStep.ExperienceLevel;
        break;
      case OnboardingStep.Equipment:
        this.state.currentStep = OnboardingStep.WorkoutFrequency;
        break;
      case OnboardingStep.Complete:
        this.state.currentStep = OnboardingStep.Equipment;
        break;
    }
    this.state.errorMessage = null;
  }

  /**
   * Reset onboarding state
   */
  reset(): void {
    this.state = {
      currentStep: OnboardingStep.Goals,
      selectedGoals: [],
      selectedExperienceLevel: null,
      selectedWorkoutFrequency: null,
      selectedEquipment: [],
      isLoading: false,
      errorMessage: null,
    };
  }

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem('onboardingComplete');
      return value === 'true';
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      return false;
    }
  }
}

export const ONBOARDING_DATA = {
  fitnessGoals: ['STRENGTH', 'ENDURANCE', 'WEIGHT_LOSS', 'MUSCLE_GAIN'],
  experienceLevels: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
  workoutFrequencies: [1, 2, 3, 4, 5, 6, 7],
  equipmentOptions: ['DUMBBELLS', 'BARBELL', 'MACHINES', 'BODYWEIGHT', 'CABLES', 'KETTLEBELLS'],
};

export default OnboardingService.getInstance();
