/**
 * Onboarding Service Tests
 * Unit and property-based tests for onboarding flow
 */

import { OnboardingService } from '../OnboardingService';
import { UserProfileService } from '../UserProfileService';
import { DatabaseService } from '../../database/DatabaseService';
import { SyncEngine } from '../SyncEngine';
import {
  OnboardingStep,
  FitnessGoal,
  ExperienceLevel,
  Equipment,
  UserProfileException,
} from '../../models/UserProfileModels';

// Mock implementations
const mockDatabaseService = {
  data: new Map<string, any[]>(),

  async insert(table: string, data: any): Promise<string> {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const tableData = this.data.get(table)!;
    tableData.push(data);
    return data.id || '';
  },

  async update(table: string, data: any, where: string, params: any[]): Promise<number> {
    const tableData = this.data.get(table) || [];
    const id = params[0];
    const index = tableData.findIndex((row: any) => row.id === id || row.userId === id);
    if (index !== -1) {
      tableData[index] = { ...tableData[index], ...data };
      return 1;
    }
    return 0;
  },

  async delete(table: string, where: string, params: any[]): Promise<number> {
    const tableData = this.data.get(table) || [];
    const id = params[0];
    const index = tableData.findIndex((row: any) => row.id === id || row.userId === id);
    if (index !== -1) {
      tableData.splice(index, 1);
      return 1;
    }
    return 0;
  },

  async queryAll(query: string, params?: any[]): Promise<any[]> {
    if (query.includes('FROM users WHERE id')) {
      const id = params?.[0];
      return (this.data.get('users') || []).filter((row: any) => row.id === id);
    }
    if (query.includes('FROM user_preferences WHERE userId')) {
      const userId = params?.[0];
      return (this.data.get('user_preferences') || []).filter((row: any) => row.userId === userId);
    }
    return [];
  },

  async queryOne(query: string, params?: any[]): Promise<any> {
    const results = await this.queryAll(query, params);
    return results[0] || null;
  },

  async close(): Promise<void> {
    // No-op for tests
  },
} as any;

const mockSyncEngine = {
  queuedOperations: [] as any[],

  async queueOperation(): Promise<string> {
    return 'sync-id';
  },
} as any;

describe('OnboardingService', () => {
  let service: OnboardingService;
  let userProfileService: UserProfileService;
  let mockDb: any;
  let mockSync: any;

  beforeEach(() => {
    OnboardingService.resetInstance();
    UserProfileService.resetInstance();
    mockDb = { ...mockDatabaseService, data: new Map() };
    mockSync = { ...mockSyncEngine };
    userProfileService = UserProfileService.getInstance(mockDb, mockSync);
    service = OnboardingService.getInstance(mockDb, userProfileService);
  });

  describe('initializeOnboarding', () => {
    it('should initialize onboarding state', () => {
      const state = service.initializeOnboarding();

      expect(state).not.toBeNull();
      expect(state.currentStep).toBe(OnboardingStep.GOALS);
      expect(state.fitnessGoals).toEqual([]);
      expect(state.availableEquipment).toEqual([]);
      expect(state.isSkipped).toBe(false);
    });
  });

  describe('setFitnessGoals', () => {
    it('should set fitness goals and advance to experience step', () => {
      service.initializeOnboarding();
      const goals = [FitnessGoal.STRENGTH, FitnessGoal.MUSCLE_GAIN];

      const state = service.setFitnessGoals(goals);

      expect(state.fitnessGoals).toEqual(goals);
      expect(state.currentStep).toBe(OnboardingStep.EXPERIENCE);
    });

    it('should reject empty goals', () => {
      service.initializeOnboarding();

      expect(() => service.setFitnessGoals([])).toThrow(UserProfileException);
    });

    it('should throw error if onboarding not initialized', () => {
      expect(() => service.setFitnessGoals([FitnessGoal.STRENGTH])).toThrow(
        UserProfileException
      );
    });
  });

  describe('setExperienceLevel', () => {
    it('should set experience level and advance to frequency step', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);

      const state = service.setExperienceLevel(ExperienceLevel.INTERMEDIATE);

      expect(state.experienceLevel).toBe(ExperienceLevel.INTERMEDIATE);
      expect(state.currentStep).toBe(OnboardingStep.FREQUENCY);
    });

    it('should reject invalid experience level', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);

      expect(() => service.setExperienceLevel('INVALID' as any)).toThrow(
        UserProfileException
      );
    });
  });

  describe('setWorkoutFrequency', () => {
    it('should set workout frequency and advance to equipment step', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);

      const state = service.setWorkoutFrequency(4);

      expect(state.currentStep).toBe(OnboardingStep.EQUIPMENT);
    });

    it('should reject invalid frequency (< 1)', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);

      expect(() => service.setWorkoutFrequency(0)).toThrow(UserProfileException);
    });

    it('should reject invalid frequency (> 7)', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);

      expect(() => service.setWorkoutFrequency(8)).toThrow(UserProfileException);
    });
  });

  describe('setAvailableEquipment', () => {
    it('should set available equipment and advance to complete step', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);

      const equipment = [Equipment.DUMBBELLS, Equipment.BARBELL];
      const state = service.setAvailableEquipment(equipment);

      expect(state.availableEquipment).toEqual(equipment);
      expect(state.currentStep).toBe(OnboardingStep.COMPLETE);
    });

    it('should reject empty equipment', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);

      expect(() => service.setAvailableEquipment([])).toThrow(UserProfileException);
    });
  });

  describe('skipOnboarding', () => {
    it('should skip onboarding and advance to complete step', () => {
      service.initializeOnboarding();

      const state = service.skipOnboarding();

      expect(state.isSkipped).toBe(true);
      expect(state.currentStep).toBe(OnboardingStep.COMPLETE);
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding with full flow', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);
      service.setAvailableEquipment([Equipment.BODYWEIGHT]);

      await service.completeOnboarding(userId, email, name);

      const profile = await userProfileService.getUserProfile(userId);
      expect(profile.id).toBe(userId);
      expect(profile.level).toBe(1);
      expect(profile.totalXP).toBe(0);
    });

    it('should complete onboarding with skip', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      service.initializeOnboarding();
      service.skipOnboarding();

      await service.completeOnboarding(userId, email, name);

      const profile = await userProfileService.getUserProfile(userId);
      expect(profile.id).toBe(userId);

      const prefs = await userProfileService.getUserPreferences(userId);
      expect(prefs.fitnessGoals).toContain(FitnessGoal.STRENGTH);
      expect(prefs.experienceLevel).toBe(ExperienceLevel.BEGINNER);
    });

    it('should reject completion if onboarding not initialized', async () => {
      await expect(
        service.completeOnboarding('user-123', 'test@example.com', 'Test User')
      ).rejects.toThrow(UserProfileException);
    });
  });

  describe('getOnboardingProgress', () => {
    it('should return 0% progress for new onboarding', () => {
      service.initializeOnboarding();
      expect(service.getOnboardingProgress()).toBe(0);
    });

    it('should return 25% progress after setting goals', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      expect(service.getOnboardingProgress()).toBe(25);
    });

    it('should return 50% progress after setting goals and experience', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      expect(service.getOnboardingProgress()).toBe(50);
    });

    it('should return 75% progress after setting goals, experience, and frequency', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);
      expect(service.getOnboardingProgress()).toBe(75);
    });

    it('should return 100% progress after setting all fields', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);
      service.setAvailableEquipment([Equipment.BODYWEIGHT]);
      expect(service.getOnboardingProgress()).toBe(100);
    });
  });

  describe('isOnboardingComplete', () => {
    it('should return false for incomplete onboarding', () => {
      service.initializeOnboarding();
      expect(service.isOnboardingComplete()).toBe(false);
    });

    it('should return true after completion', async () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);
      service.setAvailableEquipment([Equipment.BODYWEIGHT]);

      await service.completeOnboarding('user-123', 'test@example.com', 'Test User');

      expect(service.isOnboardingComplete()).toBe(true);
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding state', () => {
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);

      service.resetOnboarding();

      expect(service.getOnboardingState()).toBeNull();
    });
  });
});

describe('OnboardingService - Property-Based Tests', () => {
  let service: OnboardingService;
  let userProfileService: UserProfileService;
  let mockDb: any;
  let mockSync: any;

  beforeEach(() => {
    OnboardingService.resetInstance();
    UserProfileService.resetInstance();
    mockDb = { ...mockDatabaseService, data: new Map() };
    mockSync = { ...mockSyncEngine };
    userProfileService = UserProfileService.getInstance(mockDb, mockSync);
    service = OnboardingService.getInstance(mockDb, userProfileService);
  });

  /**
   * Property 1: Onboarding Flow Progression
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   *
   * For any valid onboarding flow, each step should advance to the next step
   * and preserve all previously entered data.
   */
  it('Property 1: Onboarding Flow Progression', () => {
    const testCases = [
      {
        goals: [FitnessGoal.STRENGTH],
        experience: ExperienceLevel.BEGINNER,
        frequency: 3,
        equipment: [Equipment.BODYWEIGHT],
      },
      {
        goals: [FitnessGoal.ENDURANCE, FitnessGoal.WEIGHT_LOSS],
        experience: ExperienceLevel.INTERMEDIATE,
        frequency: 5,
        equipment: [Equipment.DUMBBELLS, Equipment.BARBELL],
      },
      {
        goals: [FitnessGoal.MUSCLE_GAIN],
        experience: ExperienceLevel.ADVANCED,
        frequency: 6,
        equipment: [Equipment.MACHINES, Equipment.CABLES],
      },
    ];

    for (const testCase of testCases) {
      service.resetOnboarding();
      service.initializeOnboarding();

      // Step 1: Goals
      let state = service.setFitnessGoals(testCase.goals);
      expect(state.fitnessGoals).toEqual(testCase.goals);
      expect(state.currentStep).toBe(OnboardingStep.EXPERIENCE);

      // Step 2: Experience
      state = service.setExperienceLevel(testCase.experience);
      expect(state.experienceLevel).toBe(testCase.experience);
      expect(state.fitnessGoals).toEqual(testCase.goals); // Preserved
      expect(state.currentStep).toBe(OnboardingStep.FREQUENCY);

      // Step 3: Frequency
      state = service.setWorkoutFrequency(testCase.frequency);
      expect(state.experienceLevel).toBe(testCase.experience); // Preserved
      expect(state.fitnessGoals).toEqual(testCase.goals); // Preserved
      expect(state.currentStep).toBe(OnboardingStep.EQUIPMENT);

      // Step 4: Equipment
      state = service.setAvailableEquipment(testCase.equipment);
      expect(state.availableEquipment).toEqual(testCase.equipment);
      expect(state.experienceLevel).toBe(testCase.experience); // Preserved
      expect(state.fitnessGoals).toEqual(testCase.goals); // Preserved
      expect(state.currentStep).toBe(OnboardingStep.COMPLETE);
    }
  });

  /**
   * Property 2: Onboarding Completion Initializes User at Level 1
   * **Validates: Requirements 3.5, 3.6**
   *
   * For any completed onboarding, the user should be initialized at Level 1 with 0 XP.
   */
  it('Property 2: Onboarding Completion Initializes User at Level 1', async () => {
    const testCases = [
      { userId: 'user-1', email: 'test1@example.com', name: 'User One' },
      { userId: 'user-2', email: 'test2@example.com', name: 'User Two' },
      { userId: 'user-3', email: 'test3@example.com', name: 'User Three' },
    ];

    for (const testCase of testCases) {
      service.resetOnboarding();
      service.initializeOnboarding();
      service.setFitnessGoals([FitnessGoal.STRENGTH]);
      service.setExperienceLevel(ExperienceLevel.BEGINNER);
      service.setWorkoutFrequency(3);
      service.setAvailableEquipment([Equipment.BODYWEIGHT]);

      await service.completeOnboarding(testCase.userId, testCase.email, testCase.name);

      const profile = await userProfileService.getUserProfile(testCase.userId);
      expect(profile.level).toBe(1);
      expect(profile.totalXP).toBe(0);
      expect(profile.currentStreak).toBe(0);
      expect(profile.longestStreak).toBe(0);
    }
  });

  /**
   * Property 3: Skip Onboarding Uses Defaults
   * **Validates: Requirements 3.6**
   *
   * For any skipped onboarding, default preferences should be applied.
   */
  it('Property 3: Skip Onboarding Uses Defaults', async () => {
    const testCases = [
      { userId: 'user-1', email: 'test1@example.com', name: 'User One' },
      { userId: 'user-2', email: 'test2@example.com', name: 'User Two' },
    ];

    for (const testCase of testCases) {
      service.resetOnboarding();
      service.initializeOnboarding();
      service.skipOnboarding();

      await service.completeOnboarding(testCase.userId, testCase.email, testCase.name);

      const prefs = await userProfileService.getUserPreferences(testCase.userId);
      expect(prefs.fitnessGoals).toContain(FitnessGoal.STRENGTH);
      expect(prefs.experienceLevel).toBe(ExperienceLevel.BEGINNER);
      expect(prefs.availableEquipment).toContain(Equipment.BODYWEIGHT);
    }
  });

  /**
   * Property 4: Onboarding Progress Monotonically Increases
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * For any onboarding flow, progress should monotonically increase
   * as steps are completed.
   */
  it('Property 4: Onboarding Progress Monotonically Increases', () => {
    service.initializeOnboarding();
    let previousProgress = service.getOnboardingProgress();
    expect(previousProgress).toBe(0);

    service.setFitnessGoals([FitnessGoal.STRENGTH]);
    let currentProgress = service.getOnboardingProgress();
    expect(currentProgress).toBeGreaterThan(previousProgress);
    previousProgress = currentProgress;

    service.setExperienceLevel(ExperienceLevel.BEGINNER);
    currentProgress = service.getOnboardingProgress();
    expect(currentProgress).toBeGreaterThan(previousProgress);
    previousProgress = currentProgress;

    service.setWorkoutFrequency(3);
    currentProgress = service.getOnboardingProgress();
    expect(currentProgress).toBeGreaterThan(previousProgress);
    previousProgress = currentProgress;

    service.setAvailableEquipment([Equipment.BODYWEIGHT]);
    currentProgress = service.getOnboardingProgress();
    expect(currentProgress).toBeGreaterThanOrEqual(previousProgress);
    expect(currentProgress).toBe(100);
  });
});
