/**
 * Onboarding Service
 * Handles the onboarding flow for new users
 */

import { DatabaseService } from '../database/DatabaseService';
import { UserProfileService } from './UserProfileService';
import {
  OnboardingState,
  OnboardingStep,
  FitnessGoal,
  ExperienceLevel,
  Equipment,
  UserProfileException,
  UserProfileError,
} from '../models/UserProfileModels';

export class OnboardingService {
  private static instance: OnboardingService;
  private db: DatabaseService;
  private userProfileService: UserProfileService;
  private onboardingState: OnboardingState | null = null;

  private constructor(db: DatabaseService, userProfileService: UserProfileService) {
    this.db = db;
    this.userProfileService = userProfileService;
  }

  static getInstance(
    db?: DatabaseService,
    userProfileService?: UserProfileService
  ): OnboardingService {
    if (!OnboardingService.instance) {
      if (!db || !userProfileService) {
        throw new UserProfileException(
          UserProfileError.DATABASE_ERROR,
          'DatabaseService and UserProfileService are required for initialization'
        );
      }
      OnboardingService.instance = new OnboardingService(db, userProfileService);
    }
    return OnboardingService.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    OnboardingService.instance = null as any;
  }

  /**
   * Initialize onboarding state
   */
  initializeOnboarding(): OnboardingState {
    this.onboardingState = {
      currentStep: OnboardingStep.GOALS,
      fitnessGoals: [],
      availableEquipment: [],
      isSkipped: false,
    };
    return this.onboardingState;
  }

  /**
   * Get current onboarding state
   */
  getOnboardingState(): OnboardingState | null {
    return this.onboardingState;
  }

  /**
   * Set fitness goals
   */
  setFitnessGoals(goals: FitnessGoal[]): OnboardingState {
    if (!this.onboardingState) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Onboarding not initialized'
      );
    }

    if (!Array.isArray(goals) || goals.length === 0) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'At least one fitness goal must be selected'
      );
    }

    this.onboardingState.fitnessGoals = goals;
    this.onboardingState.currentStep = OnboardingStep.EXPERIENCE;

    return this.onboardingState;
  }

  /**
   * Set experience level
   */
  setExperienceLevel(level: ExperienceLevel): OnboardingState {
    if (!this.onboardingState) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Onboarding not initialized'
      );
    }

    if (!Object.values(ExperienceLevel).includes(level)) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Invalid experience level'
      );
    }

    this.onboardingState.experienceLevel = level;
    this.onboardingState.currentStep = OnboardingStep.FREQUENCY;

    return this.onboardingState;
  }

  /**
   * Set workout frequency
   */
  setWorkoutFrequency(frequency: number): OnboardingState {
    if (!this.onboardingState) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Onboarding not initialized'
      );
    }

    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 7) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Workout frequency must be between 1 and 7 days per week'
      );
    }

    this.onboardingState.currentStep = OnboardingStep.EQUIPMENT;

    return this.onboardingState;
  }

  /**
   * Set available equipment
   */
  setAvailableEquipment(equipment: Equipment[]): OnboardingState {
    if (!this.onboardingState) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Onboarding not initialized'
      );
    }

    if (!Array.isArray(equipment) || equipment.length === 0) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'At least one equipment type must be selected'
      );
    }

    this.onboardingState.availableEquipment = equipment;
    this.onboardingState.currentStep = OnboardingStep.COMPLETE;

    return this.onboardingState;
  }

  /**
   * Skip onboarding
   */
  skipOnboarding(): OnboardingState {
    if (!this.onboardingState) {
      throw new UserProfileException(
        UserProfileError.INVALID_PREFERENCES_DATA,
        'Onboarding not initialized'
      );
    }

    this.onboardingState.isSkipped = true;
    this.onboardingState.currentStep = OnboardingStep.COMPLETE;

    return this.onboardingState;
  }

  /**
   * Complete onboarding and save preferences
   */
  async completeOnboarding(userId: string, email: string, name: string): Promise<void> {
    try {
      if (!this.onboardingState) {
        throw new UserProfileException(
          UserProfileError.INVALID_PREFERENCES_DATA,
          'Onboarding not initialized'
        );
      }

      // If onboarding was skipped, use default preferences
      if (this.onboardingState.isSkipped) {
        this.onboardingState.fitnessGoals = [FitnessGoal.STRENGTH];
        this.onboardingState.experienceLevel = ExperienceLevel.BEGINNER;
        this.onboardingState.availableEquipment = [Equipment.BODYWEIGHT];
        // Default to 3 days per week
        const frequency = 3;

        // Create user profile
        await this.userProfileService.createUserProfile(userId, email, name);

        // Create user preferences with defaults
        await this.userProfileService.createUserPreferences(
          userId,
          this.onboardingState.fitnessGoals,
          this.onboardingState.experienceLevel,
          frequency,
          this.onboardingState.availableEquipment
        );
      } else {
        // Validate that all steps were completed
        if (
          !this.onboardingState.fitnessGoals ||
          this.onboardingState.fitnessGoals.length === 0
        ) {
          throw new UserProfileException(
            UserProfileError.INVALID_PREFERENCES_DATA,
            'Fitness goals not set'
          );
        }

        if (!this.onboardingState.experienceLevel) {
          throw new UserProfileException(
            UserProfileError.INVALID_PREFERENCES_DATA,
            'Experience level not set'
          );
        }

        if (!this.onboardingState.availableEquipment || this.onboardingState.availableEquipment.length === 0) {
          throw new UserProfileException(
            UserProfileError.INVALID_PREFERENCES_DATA,
            'Available equipment not set'
          );
        }

        // Create user profile
        await this.userProfileService.createUserProfile(userId, email, name);

        // Create user preferences
        await this.userProfileService.createUserPreferences(
          userId,
          this.onboardingState.fitnessGoals,
          this.onboardingState.experienceLevel,
          this.onboardingState.currentStep === OnboardingStep.COMPLETE ? 3 : 1, // Default to 3 if not set
          this.onboardingState.availableEquipment
        );
      }

      this.onboardingState.completedAt = new Date().toISOString();
    } catch (error) {
      if (error instanceof UserProfileException) {
        throw error;
      }
      throw new UserProfileException(
        UserProfileError.DATABASE_ERROR,
        'Failed to complete onboarding',
        error
      );
    }
  }

  /**
   * Reset onboarding state
   */
  resetOnboarding(): void {
    this.onboardingState = null;
  }

  /**
   * Check if onboarding is complete
   */
  isOnboardingComplete(): boolean {
    return (
      this.onboardingState !== null &&
      this.onboardingState.currentStep === OnboardingStep.COMPLETE &&
      this.onboardingState.completedAt !== undefined
    );
  }

  /**
   * Get onboarding progress (0-100)
   */
  getOnboardingProgress(): number {
    if (!this.onboardingState) {
      return 0;
    }

    // Count completed steps (excluding COMPLETE step)
    let completedSteps = 0;

    if (this.onboardingState.fitnessGoals && this.onboardingState.fitnessGoals.length > 0) {
      completedSteps++;
    }

    if (this.onboardingState.experienceLevel) {
      completedSteps++;
    }

    // Workout frequency is optional in the state, but we check if we've moved past frequency step
    if (this.onboardingState.currentStep === OnboardingStep.EQUIPMENT || 
        this.onboardingState.currentStep === OnboardingStep.COMPLETE) {
      completedSteps++;
    }

    if (this.onboardingState.availableEquipment && this.onboardingState.availableEquipment.length > 0) {
      completedSteps++;
    }

    // Total steps: Goals, Experience, Frequency, Equipment
    const totalSteps = 4;
    return Math.round((completedSteps / totalSteps) * 100);
  }
}
