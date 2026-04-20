import OnboardingService, { OnboardingStep, ONBOARDING_DATA } from '@services/OnboardingService';
import AuthenticationService from '@services/AuthenticationService';
import UserProfileService from '@services/UserProfileService';
import { mockAsyncStorage } from './setup';

const mockedAsyncStorage = mockAsyncStorage;
const mockedAuthService = AuthenticationService as jest.Mocked<typeof AuthenticationService>;
const mockedUserProfileService = UserProfileService as jest.Mocked<typeof UserProfileService>;

describe('OnboardingService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    OnboardingService.reset();
    mockedAuthService.getCurrentUser = jest.fn().mockReturnValue(mockUser);
    mockedAsyncStorage.setItem = jest.fn().mockResolvedValue(undefined);
    mockedAsyncStorage.getItem = jest.fn().mockResolvedValue(null);
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = OnboardingService.getState();

      expect(state.currentStep).toBe(OnboardingStep.Goals);
      expect(state.selectedGoals).toEqual([]);
      expect(state.selectedExperienceLevel).toBeNull();
      expect(state.selectedWorkoutFrequency).toBeNull();
      expect(state.selectedEquipment).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('selectGoals', () => {
    it('should select fitness goals', () => {
      const goals = ['STRENGTH', 'MUSCLE_GAIN'];
      OnboardingService.selectGoals(goals);

      const state = OnboardingService.getState();
      expect(state.selectedGoals).toEqual(goals);
      expect(state.errorMessage).toBeNull();
    });

    it('should clear error message when selecting goals', () => {
      OnboardingService.selectGoals([]);
      OnboardingService.proceedFromGoals(); // This sets error
      OnboardingService.selectGoals(['STRENGTH']);

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('proceedFromGoals', () => {
    it('should move to experience level step', () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.proceedFromGoals();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.ExperienceLevel);
    });

    it('should set error if no goals selected', () => {
      OnboardingService.proceedFromGoals();

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBe('Please select at least one fitness goal');
      expect(state.currentStep).toBe(OnboardingStep.Goals);
    });
  });

  describe('selectExperienceLevel', () => {
    it('should select experience level', () => {
      OnboardingService.selectExperienceLevel('INTERMEDIATE');

      const state = OnboardingService.getState();
      expect(state.selectedExperienceLevel).toBe('INTERMEDIATE');
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('proceedFromExperienceLevel', () => {
    it('should move to workout frequency step', () => {
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.proceedFromExperienceLevel();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.WorkoutFrequency);
    });

    it('should set error if no experience level selected', () => {
      OnboardingService.proceedFromExperienceLevel();

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBe('Please select your experience level');
      expect(state.currentStep).toBe(OnboardingStep.Goals);
    });
  });

  describe('selectWorkoutFrequency', () => {
    it('should select workout frequency', () => {
      OnboardingService.selectWorkoutFrequency(4);

      const state = OnboardingService.getState();
      expect(state.selectedWorkoutFrequency).toBe(4);
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('proceedFromWorkoutFrequency', () => {
    it('should move to equipment step', () => {
      OnboardingService.selectWorkoutFrequency(4);
      OnboardingService.proceedFromWorkoutFrequency();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.Equipment);
    });

    it('should set error if no frequency selected', () => {
      OnboardingService.proceedFromWorkoutFrequency();

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBe('Please select your workout frequency');
    });
  });

  describe('selectEquipment', () => {
    it('should select equipment', () => {
      const equipment = ['DUMBBELLS', 'BARBELL'];
      OnboardingService.selectEquipment(equipment);

      const state = OnboardingService.getState();
      expect(state.selectedEquipment).toEqual(equipment);
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('proceedFromEquipment', () => {
    it('should move to complete step', () => {
      OnboardingService.selectEquipment(['DUMBBELLS']);
      OnboardingService.proceedFromEquipment();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.Complete);
    });

    it('should set error if no equipment selected', () => {
      OnboardingService.proceedFromEquipment();

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBe('Please select at least one equipment type');
    });
  });

  describe('completeOnboarding', () => {
    it('should save all preferences and mark onboarding complete', async () => {
      OnboardingService.selectGoals(['STRENGTH', 'MUSCLE_GAIN']);
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.selectWorkoutFrequency(4);
      OnboardingService.selectEquipment(['DUMBBELLS', 'BARBELL']);

      mockedUserProfileService.setFitnessGoals = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setExperienceLevel = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setWorkoutFrequency = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setAvailableEquipment = jest.fn().mockResolvedValue({});

      await OnboardingService.completeOnboarding();

      expect(mockedUserProfileService.setFitnessGoals).toHaveBeenCalledWith('user-123', [
        'STRENGTH',
        'MUSCLE_GAIN',
      ]);
      expect(mockedUserProfileService.setExperienceLevel).toHaveBeenCalledWith(
        'user-123',
        'INTERMEDIATE'
      );
      expect(mockedUserProfileService.setWorkoutFrequency).toHaveBeenCalledWith('user-123', 4);
      expect(mockedUserProfileService.setAvailableEquipment).toHaveBeenCalledWith('user-123', [
        'DUMBBELLS',
        'BARBELL',
      ]);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('onboardingComplete', 'true');
    });

    it('should set error if no user found', async () => {
      mockedAuthService.getCurrentUser = jest.fn().mockReturnValue(null);

      await expect(OnboardingService.completeOnboarding()).rejects.toThrow('No user found');
    });

    it('should set error on API failure', async () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.selectWorkoutFrequency(4);
      OnboardingService.selectEquipment(['DUMBBELLS']);

      mockedUserProfileService.setFitnessGoals = jest
        .fn()
        .mockRejectedValue(new Error('API error'));

      await expect(OnboardingService.completeOnboarding()).rejects.toThrow('API error');

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBe('API error');
    });

    it('should set loading state during completion', async () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.selectWorkoutFrequency(4);
      OnboardingService.selectEquipment(['DUMBBELLS']);

      mockedUserProfileService.setFitnessGoals = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100);
          })
      );
      mockedUserProfileService.setExperienceLevel = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setWorkoutFrequency = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setAvailableEquipment = jest.fn().mockResolvedValue({});

      const completionPromise = OnboardingService.completeOnboarding();

      // Check loading state during completion
      let state = OnboardingService.getState();
      expect(state.isLoading).toBe(true);

      await completionPromise;

      // Check loading state after completion
      state = OnboardingService.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('skipOnboarding', () => {
    it('should save default preferences and mark onboarding complete', async () => {
      mockedUserProfileService.setFitnessGoals = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setExperienceLevel = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setWorkoutFrequency = jest.fn().mockResolvedValue({});
      mockedUserProfileService.setAvailableEquipment = jest.fn().mockResolvedValue({});

      await OnboardingService.skipOnboarding();

      expect(mockedUserProfileService.setFitnessGoals).toHaveBeenCalledWith('user-123', [
        'STRENGTH',
      ]);
      expect(mockedUserProfileService.setExperienceLevel).toHaveBeenCalledWith('user-123', 'BEGINNER');
      expect(mockedUserProfileService.setWorkoutFrequency).toHaveBeenCalledWith('user-123', 3);
      expect(mockedUserProfileService.setAvailableEquipment).toHaveBeenCalledWith('user-123', [
        'DUMBBELLS',
        'BODYWEIGHT',
      ]);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('onboardingComplete', 'true');
    });

    it('should throw error if no user found', async () => {
      mockedAuthService.getCurrentUser = jest.fn().mockReturnValue(null);

      await expect(OnboardingService.skipOnboarding()).rejects.toThrow('No user found');
    });
  });

  describe('goBack', () => {
    it('should go back from experience level to goals', () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.proceedFromGoals();
      OnboardingService.goBack();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.Goals);
    });

    it('should go back from workout frequency to experience level', () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.proceedFromGoals();
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.proceedFromExperienceLevel();
      OnboardingService.goBack();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.ExperienceLevel);
    });

    it('should not go back from first step', () => {
      OnboardingService.goBack();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.Goals);
    });

    it('should clear error message when going back', () => {
      OnboardingService.proceedFromGoals(); // Sets error
      OnboardingService.goBack();

      const state = OnboardingService.getState();
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset state to initial values', () => {
      OnboardingService.selectGoals(['STRENGTH']);
      OnboardingService.selectExperienceLevel('INTERMEDIATE');
      OnboardingService.selectWorkoutFrequency(4);
      OnboardingService.selectEquipment(['DUMBBELLS']);

      OnboardingService.reset();

      const state = OnboardingService.getState();
      expect(state.currentStep).toBe(OnboardingStep.Goals);
      expect(state.selectedGoals).toEqual([]);
      expect(state.selectedExperienceLevel).toBeNull();
      expect(state.selectedWorkoutFrequency).toBeNull();
      expect(state.selectedEquipment).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('isOnboardingComplete', () => {
    it('should return true if onboarding is complete', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce('true');

      const result = await OnboardingService.isOnboardingComplete();

      expect(result).toBe(true);
    });

    it('should return false if onboarding is not complete', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await OnboardingService.isOnboardingComplete();

      expect(result).toBe(false);
    });

    it('should return false on storage error', async () => {
      mockedAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await OnboardingService.isOnboardingComplete();

      expect(result).toBe(false);
    });
  });

  describe('ONBOARDING_DATA', () => {
    it('should have all required data', () => {
      expect(ONBOARDING_DATA.fitnessGoals).toContain('STRENGTH');
      expect(ONBOARDING_DATA.experienceLevels).toContain('BEGINNER');
      expect(ONBOARDING_DATA.workoutFrequencies).toContain(3);
      expect(ONBOARDING_DATA.equipmentOptions).toContain('DUMBBELLS');
    });
  });
});
