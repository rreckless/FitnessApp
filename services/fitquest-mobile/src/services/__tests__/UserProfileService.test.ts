/**
 * User Profile Service Tests
 * Unit and property-based tests for user profile management
 */

import { UserProfileService } from '../UserProfileService';
import { DatabaseService } from '../../database/DatabaseService';
import { SyncEngine } from '../SyncEngine';
import {
  UserProfile,
  UserPreferences,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  UserProfileException,
  UserProfileError,
  FitnessGoal,
  ExperienceLevel,
  Equipment,
  SubscriptionTier,
} from '../../models/UserProfileModels';
import { SyncOperation, SyncEntityType } from '../../models/SyncModels';

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
    if (query.includes('FROM profile_picture_cache WHERE userId')) {
      const userId = params?.[0];
      return (this.data.get('profile_picture_cache') || []).filter((row: any) => row.userId === userId);
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

  async queueOperation(
    operation: SyncOperation,
    entityType: SyncEntityType,
    entityId: string,
    payload: any
  ): Promise<string> {
    this.queuedOperations.push({ operation, entityType, entityId, payload });
    return 'sync-id';
  },

  getQueuedOperations(): any[] {
    return this.queuedOperations;
  },

  clearQueue(): void {
    this.queuedOperations = [];
  },
} as any;

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockDb: any;
  let mockSync: any;

  beforeEach(() => {
    UserProfileService.resetInstance();
    mockDb = { ...mockDatabaseService, data: new Map() };
    mockSync = { ...mockSyncEngine, queuedOperations: [] };
    service = UserProfileService.getInstance(mockDb, mockSync);
  });

  describe('createUserProfile', () => {
    it('should create a new user profile with default values', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      const profile = await service.createUserProfile(userId, email, name);

      expect(profile.id).toBe(userId);
      expect(profile.email).toBe(email);
      expect(profile.name).toBe(name);
      expect(profile.level).toBe(1);
      expect(profile.totalXP).toBe(0);
      expect(profile.currentStreak).toBe(0);
      expect(profile.longestStreak).toBe(0);
      expect(profile.subscriptionTier).toBe(SubscriptionTier.FREE);
    });

    it('should queue sync operation on profile creation', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);

      const operations = mockSync.getQueuedOperations();
      expect(operations.length).toBe(1);
      expect(operations[0].operation).toBe(SyncOperation.CREATE);
      expect(operations[0].entityType).toBe(SyncEntityType.USER);
    });

    it('should reject invalid name', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = ''; // Empty name

      await expect(service.createUserProfile(userId, email, name)).rejects.toThrow(
        UserProfileException
      );
    });
  });

  describe('getUserProfile', () => {
    it('should retrieve user profile by ID', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);
      const profile = await service.getUserProfile(userId);

      expect(profile.id).toBe(userId);
      expect(profile.email).toBe(email);
      expect(profile.name).toBe(name);
    });

    it('should throw error when profile not found', async () => {
      await expect(service.getUserProfile('non-existent')).rejects.toThrow(
        UserProfileException
      );
    });

    it('should use current user ID if not provided', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);
      service.setCurrentUserId(userId);

      const profile = await service.getUserProfile();
      expect(profile.id).toBe(userId);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile fields', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);

      const updated = await service.updateUserProfile(
        { name: 'Updated Name', bio: 'New bio' },
        userId
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.bio).toBe('New bio');
    });

    it('should queue sync operation on profile update', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);
      mockSync.clearQueue();

      await service.updateUserProfile({ name: 'Updated Name' }, userId);

      const operations = mockSync.getQueuedOperations();
      expect(operations.length).toBe(1);
      expect(operations[0].operation).toBe(SyncOperation.UPDATE);
    });

    it('should reject invalid bio length', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);

      const longBio = 'a'.repeat(501); // Exceeds max length
      await expect(
        service.updateUserProfile({ bio: longBio }, userId)
      ).rejects.toThrow(UserProfileException);
    });
  });

  describe('createUserPreferences', () => {
    it('should create user preferences', async () => {
      const userId = 'user-123';
      const goals = [FitnessGoal.STRENGTH, FitnessGoal.MUSCLE_GAIN];
      const experience = ExperienceLevel.INTERMEDIATE;
      const frequency = 4;
      const equipment = [Equipment.DUMBBELLS, Equipment.BARBELL];

      const prefs = await service.createUserPreferences(
        userId,
        goals,
        experience,
        frequency,
        equipment
      );

      expect(prefs.userId).toBe(userId);
      expect(prefs.fitnessGoals).toEqual(goals);
      expect(prefs.experienceLevel).toBe(experience);
      expect(prefs.workoutFrequency).toBe(frequency);
      expect(prefs.availableEquipment).toEqual(equipment);
    });

    it('should reject empty fitness goals', async () => {
      const userId = 'user-123';
      const goals: FitnessGoal[] = [];
      const experience = ExperienceLevel.INTERMEDIATE;
      const frequency = 4;
      const equipment = [Equipment.DUMBBELLS];

      await expect(
        service.createUserPreferences(userId, goals, experience, frequency, equipment)
      ).rejects.toThrow(UserProfileException);
    });

    it('should reject invalid workout frequency', async () => {
      const userId = 'user-123';
      const goals = [FitnessGoal.STRENGTH];
      const experience = ExperienceLevel.INTERMEDIATE;
      const frequency = 10; // Invalid: > 7
      const equipment = [Equipment.DUMBBELLS];

      await expect(
        service.createUserPreferences(userId, goals, experience, frequency, equipment)
      ).rejects.toThrow(UserProfileException);
    });
  });

  describe('getUserPreferences', () => {
    it('should retrieve user preferences', async () => {
      const userId = 'user-123';
      const goals = [FitnessGoal.STRENGTH];
      const experience = ExperienceLevel.BEGINNER;
      const frequency = 3;
      const equipment = [Equipment.BODYWEIGHT];

      await service.createUserPreferences(userId, goals, experience, frequency, equipment);
      const prefs = await service.getUserPreferences(userId);

      expect(prefs.userId).toBe(userId);
      expect(prefs.fitnessGoals).toEqual(goals);
      expect(prefs.experienceLevel).toBe(experience);
    });

    it('should throw error when preferences not found', async () => {
      await expect(service.getUserPreferences('non-existent')).rejects.toThrow(
        UserProfileException
      );
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const userId = 'user-123';
      const goals = [FitnessGoal.STRENGTH];
      const experience = ExperienceLevel.BEGINNER;
      const frequency = 3;
      const equipment = [Equipment.BODYWEIGHT];

      await service.createUserPreferences(userId, goals, experience, frequency, equipment);

      const updated = await service.updateUserPreferences(
        {
          fitnessGoals: [FitnessGoal.ENDURANCE],
          workoutFrequency: 5,
        },
        userId
      );

      expect(updated.fitnessGoals).toEqual([FitnessGoal.ENDURANCE]);
      expect(updated.workoutFrequency).toBe(5);
    });

    it('should preserve unchanged preferences', async () => {
      const userId = 'user-123';
      const goals = [FitnessGoal.STRENGTH];
      const experience = ExperienceLevel.BEGINNER;
      const frequency = 3;
      const equipment = [Equipment.BODYWEIGHT];

      await service.createUserPreferences(userId, goals, experience, frequency, equipment);

      const updated = await service.updateUserPreferences(
        { workoutFrequency: 5 },
        userId
      );

      expect(updated.fitnessGoals).toEqual(goals);
      expect(updated.experienceLevel).toBe(experience);
      expect(updated.availableEquipment).toEqual(equipment);
    });
  });

  describe('uploadProfilePicture', () => {
    it('should upload profile picture and cache it', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);

      const url = await service.uploadProfilePicture(
        { filePath: '/local/path/image.jpg', fileName: 'image.jpg' },
        userId
      );

      expect(url).toContain('s3://');
      expect(url).toContain(userId);
    });

    it('should cache profile picture', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);
      await service.uploadProfilePicture(
        { filePath: '/local/path/image.jpg', fileName: 'image.jpg' },
        userId
      );

      const cache = await service.getCachedProfilePicture(userId);
      expect(cache).not.toBeNull();
      expect(cache?.url).toContain('s3://');
    });
  });

  describe('deleteProfilePicture', () => {
    it('should delete profile picture', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createUserProfile(userId, email, name);
      await service.uploadProfilePicture(
        { filePath: '/local/path/image.jpg', fileName: 'image.jpg' },
        userId
      );

      await service.deleteProfilePicture(userId);

      const cache = await service.getCachedProfilePicture(userId);
      expect(cache).toBeNull();
    });
  });

  describe('setCurrentUserId', () => {
    it('should set and retrieve current user ID', () => {
      const userId = 'user-123';
      service.setCurrentUserId(userId);
      expect(service.getCurrentUserId()).toBe(userId);
    });
  });
});

describe('UserProfileService - Property-Based Tests', () => {
  let service: UserProfileService;
  let mockDb: any;
  let mockSync: any;

  beforeEach(() => {
    UserProfileService.resetInstance();
    mockDb = { ...mockDatabaseService, data: new Map() };
    mockSync = { ...mockSyncEngine, queuedOperations: [] };
    service = UserProfileService.getInstance(mockDb, mockSync);
  });

  /**
   * Property 1: Profile Creation Idempotency
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any valid user profile data, creating a profile and retrieving it
   * should return the same data.
   */
  it('Property 1: Profile Creation Idempotency', async () => {
    const testCases = [
      { userId: 'user-1', email: 'test1@example.com', name: 'User One' },
      { userId: 'user-2', email: 'test2@example.com', name: 'User Two' },
      { userId: 'user-3', email: 'test3@example.com', name: 'User Three' },
    ];

    for (const testCase of testCases) {
      const created = await service.createUserProfile(
        testCase.userId,
        testCase.email,
        testCase.name
      );
      const retrieved = await service.getUserProfile(testCase.userId);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.email).toBe(created.email);
      expect(retrieved.name).toBe(created.name);
      expect(retrieved.level).toBe(created.level);
      expect(retrieved.totalXP).toBe(created.totalXP);
    }
  });

  /**
   * Property 2: Preferences Persistence
   * **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
   *
   * For any valid preferences, creating and retrieving preferences
   * should preserve all values exactly.
   */
  it('Property 2: Preferences Persistence', async () => {
    const testCases = [
      {
        userId: 'user-1',
        goals: [FitnessGoal.STRENGTH],
        experience: ExperienceLevel.BEGINNER,
        frequency: 3,
        equipment: [Equipment.BODYWEIGHT],
      },
      {
        userId: 'user-2',
        goals: [FitnessGoal.ENDURANCE, FitnessGoal.WEIGHT_LOSS],
        experience: ExperienceLevel.INTERMEDIATE,
        frequency: 5,
        equipment: [Equipment.DUMBBELLS, Equipment.BARBELL],
      },
      {
        userId: 'user-3',
        goals: [FitnessGoal.MUSCLE_GAIN],
        experience: ExperienceLevel.ADVANCED,
        frequency: 6,
        equipment: [Equipment.MACHINES, Equipment.CABLES, Equipment.KETTLEBELLS],
      },
    ];

    for (const testCase of testCases) {
      const created = await service.createUserPreferences(
        testCase.userId,
        testCase.goals,
        testCase.experience,
        testCase.frequency,
        testCase.equipment
      );

      const retrieved = await service.getUserPreferences(testCase.userId);

      expect(retrieved.fitnessGoals).toEqual(created.fitnessGoals);
      expect(retrieved.experienceLevel).toBe(created.experienceLevel);
      expect(retrieved.workoutFrequency).toBe(created.workoutFrequency);
      expect(retrieved.availableEquipment).toEqual(created.availableEquipment);
    }
  });

  /**
   * Property 3: Profile Update Consistency
   * **Validates: Requirements 2.2**
   *
   * For any valid profile update, the updated profile should reflect
   * the changes while preserving unchanged fields.
   */
  it('Property 3: Profile Update Consistency', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const name = 'Test User';

    const original = await service.createUserProfile(userId, email, name);

    const updates = [
      { name: 'Updated Name' },
      { bio: 'New bio' },
      { name: 'Another Name', bio: 'Another bio' },
    ];

    let current = original;
    for (const update of updates) {
      current = await service.updateUserProfile(update, userId);

      if (update.name) {
        expect(current.name).toBe(update.name);
      }
      if (update.bio) {
        expect(current.bio).toBe(update.bio);
      }

      // Verify unchanged fields remain the same
      expect(current.id).toBe(original.id);
      expect(current.email).toBe(original.email);
      expect(current.level).toBe(original.level);
    }
  });
});
