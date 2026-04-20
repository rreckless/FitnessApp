import * as userProfileService from '../userProfileService';
import * as connection from '../../database/connection';
import { v4 as uuidv4 } from 'uuid';

// Mock the database connection
jest.mock('../../database/connection');

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

/**
 * Unit Tests for User Profile Service
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 */
describe('User Profile Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Profile CRUD Tests

  describe('Profile CRUD Operations', () => {
    it('should create a user profile', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-uuid-1234',
            user_id: 'user-123',
            name: 'John Doe',
            bio: 'Fitness enthusiast',
            profile_picture_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const profile = await userProfileService.createProfile('user-123', {
        name: 'John Doe',
        bio: 'Fitness enthusiast',
      });

      expect(profile.userId).toBe('user-123');
      expect(profile.name).toBe('John Doe');
      expect(profile.bio).toBe('Fitness enthusiast');
    });

    it('should retrieve a user profile by ID', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-123',
            user_id: 'user-123',
            name: 'John Doe',
            bio: 'Fitness enthusiast',
            profile_picture_url: 'https://example.com/pic.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const profile = await userProfileService.getProfile('user-123');

      expect(profile.userId).toBe('user-123');
      expect(profile.name).toBe('John Doe');
      expect(profile.profilePictureUrl).toBe('https://example.com/pic.jpg');
    });

    it('should update a user profile', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-123',
            user_id: 'user-123',
            name: 'Jane Doe',
            bio: 'Updated bio',
            profile_picture_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const profile = await userProfileService.updateProfile('user-123', {
        name: 'Jane Doe',
        bio: 'Updated bio',
      });

      expect(profile.name).toBe('Jane Doe');
      expect(profile.bio).toBe('Updated bio');
    });

    it('should delete a user profile', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'profile-123' }] });

      const result = await userProfileService.deleteProfile('user-123');

      expect(result).toBe(true);
    });

    it('should throw error when profile not found', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(userProfileService.getProfile('nonexistent')).rejects.toThrow(
        'Profile not found'
      );
    });
  });

  // MARK: - Preferences Tests

  describe('User Preferences', () => {
    it('should set user fitness goals', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            fitness_goals: ['STRENGTH', 'MUSCLE_GAIN'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const preferences = await userProfileService.setFitnessGoals('user-123', [
        'STRENGTH',
        'MUSCLE_GAIN',
      ]);

      expect(preferences.fitnessGoals).toContain('STRENGTH');
      expect(preferences.fitnessGoals).toContain('MUSCLE_GAIN');
    });

    it('should set user experience level', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            experience_level: 'INTERMEDIATE',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const preferences = await userProfileService.setExperienceLevel('user-123', 'INTERMEDIATE');

      expect(preferences.experienceLevel).toBe('INTERMEDIATE');
    });

    it('should set user workout frequency', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            workout_frequency: 5,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const preferences = await userProfileService.setWorkoutFrequency('user-123', 5);

      expect(preferences.workoutFrequency).toBe(5);
    });

    it('should set available equipment', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            available_equipment: ['DUMBBELLS', 'BARBELL', 'BODYWEIGHT'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const preferences = await userProfileService.setAvailableEquipment('user-123', [
        'DUMBBELLS',
        'BARBELL',
        'BODYWEIGHT',
      ]);

      expect(preferences.availableEquipment).toContain('DUMBBELLS');
      expect(preferences.availableEquipment).toContain('BARBELL');
    });

    it('should retrieve all user preferences', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            fitness_goals: ['STRENGTH'],
            experience_level: 'INTERMEDIATE',
            workout_frequency: 4,
            available_equipment: ['DUMBBELLS', 'BARBELL'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const preferences = await userProfileService.getPreferences('user-123');

      expect(preferences.fitnessGoals).toContain('STRENGTH');
      expect(preferences.experienceLevel).toBe('INTERMEDIATE');
      expect(preferences.workoutFrequency).toBe(4);
    });
  });

  // MARK: - Profile Picture Upload Tests

  describe('Profile Picture Upload', () => {
    it('should upload profile picture to S3', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      const s3Url = 'https://s3.amazonaws.com/fitquest/profiles/user-123/pic.jpg';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-123',
            user_id: 'user-123',
            profile_picture_url: s3Url,
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const profile = await userProfileService.uploadProfilePicture('user-123', Buffer.from('image-data'));

      expect(profile.profilePictureUrl).toBe(s3Url);
    });

    it('should validate image file size', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      await expect(
        userProfileService.uploadProfilePicture('user-123', largeBuffer)
      ).rejects.toThrow('Image size exceeds maximum of 5MB');
    });

    it('should validate image file type', async () => {
      const invalidBuffer = Buffer.from('not-an-image');

      await expect(
        userProfileService.uploadProfilePicture('user-123', invalidBuffer)
      ).rejects.toThrow('Invalid image format');
    });
  });

  // MARK: - Profile Validation Tests

  describe('Profile Validation', () => {
    it('should validate profile name length', async () => {
      const invalidName = 'a'; // Too short

      expect(() => userProfileService.validateProfileName(invalidName)).toThrow(
        'Name must be between 2 and 50 characters'
      );
    });

    it('should validate profile bio length', async () => {
      const invalidBio = 'a'.repeat(501); // Too long

      expect(() => userProfileService.validateProfileBio(invalidBio)).toThrow(
        'Bio must not exceed 500 characters'
      );
    });

    it('should sanitize profile input', async () => {
      const maliciousInput = '<script>alert("xss")</script>';

      const sanitized = userProfileService.sanitizeProfileInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    it('should reject invalid email format', async () => {
      const invalidEmail = 'not-an-email';

      expect(() => userProfileService.validateEmail(invalidEmail)).toThrow(
        'Invalid email format'
      );
    });
  });

  // MARK: - Profile Consistency Tests

  describe('Profile Data Consistency', () => {
    it('should maintain profile data consistency across updates', async () => {
      const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

      // Create profile
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-123',
            user_id: 'user-123',
            name: 'John Doe',
            bio: 'Original bio',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const created = await userProfileService.createProfile('user-123', {
        name: 'John Doe',
        bio: 'Original bio',
      });

      // Update profile
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-123',
            user_id: 'user-123',
            name: 'John Doe',
            bio: 'Updated bio',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const updated = await userProfileService.updateProfile('user-123', {
        bio: 'Updated bio',
      });

      // Verify consistency
      expect(created.userId).toBe(updated.userId);
      expect(created.name).toBe(updated.name);
      expect(updated.bio).toBe('Updated bio');
    });
  });
});
