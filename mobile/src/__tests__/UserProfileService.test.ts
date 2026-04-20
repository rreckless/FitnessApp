import UserProfileService from '@services/UserProfileService';
import { mockAxiosInstance } from './setup';

const mockedAxios = mockAxiosInstance;

describe('UserProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock instance methods
    mockedAxios.get = jest.fn();
    mockedAxios.put = jest.fn();
    mockedAxios.post = jest.fn();
    mockedAxios.delete = jest.fn();
  });

  describe('getProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        userId: 'user-123',
        name: 'Test User',
        bio: 'Fitness enthusiast',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockProfile });

      const result = await UserProfileService.getProfile('user-123');

      expect(result).toEqual(mockProfile);
      expect(mockedAxios.get).toHaveBeenCalledWith('/users/user-123');
    });

    it('should throw error on 404 not found', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: 'User not found' },
        },
      });

      await expect(UserProfileService.getProfile('invalid-user')).rejects.toThrow();
    });

    it('should throw error on 401 unauthorized', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      });

      await expect(UserProfileService.getProfile('user-123')).rejects.toThrow();
    });

    it('should throw error on network failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(UserProfileService.getProfile('user-123')).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'New bio',
      };

      const mockUpdatedProfile = {
        id: 'user-123',
        userId: 'user-123',
        name: 'Updated Name',
        bio: 'New bio',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockUpdatedProfile });

      const result = await UserProfileService.updateProfile('user-123', updateData);

      expect(result.name).toBe('Updated Name');
      expect(result.bio).toBe('New bio');
      expect(mockedAxios.put).toHaveBeenCalledWith('/users/user-123', updateData);
    });

    it('should throw error on bad request', async () => {
      mockedAxios.put.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'Invalid data' },
        },
      });

      await expect(
        UserProfileService.updateProfile('user-123', { name: '' })
      ).rejects.toThrow();
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({ data: {} });

      await UserProfileService.deleteProfile('user-123');

      expect(mockedAxios.delete).toHaveBeenCalledWith('/users/user-123');
    });

    it('should throw error on 404', async () => {
      mockedAxios.delete.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: 'User not found' },
        },
      });

      await expect(UserProfileService.deleteProfile('invalid-user')).rejects.toThrow();
    });
  });

  describe('getPreferences', () => {
    it('should fetch user preferences successfully', async () => {
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH', 'ENDURANCE'],
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 4,
        availableEquipment: ['DUMBBELLS', 'BARBELL', 'BENCH'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockPreferences });

      const result = await UserProfileService.getPreferences('user-123');

      expect(result).toEqual(mockPreferences);
      expect(mockedAxios.get).toHaveBeenCalledWith('/users/user-123/preferences');
    });

    it('should throw error on network failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(UserProfileService.getPreferences('user-123')).rejects.toThrow();
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences successfully', async () => {
      const updateData = {
        fitnessGoals: ['STRENGTH', 'MUSCLE'],
        workoutFrequency: 5,
      };

      const mockUpdatedPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH', 'MUSCLE'],
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 5,
        availableEquipment: ['DUMBBELLS', 'BARBELL', 'BENCH'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockUpdatedPreferences });

      const result = await UserProfileService.updatePreferences('user-123', updateData);

      expect(result.fitnessGoals).toEqual(['STRENGTH', 'MUSCLE']);
      expect(result.workoutFrequency).toBe(5);
      expect(mockedAxios.put).toHaveBeenCalledWith('/users/user-123/preferences', updateData);
    });
  });

  describe('setFitnessGoals', () => {
    it('should set fitness goals', async () => {
      const goals = ['STRENGTH', 'ENDURANCE'];
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: goals,
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 4,
        availableEquipment: ['DUMBBELLS'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockPreferences });

      const result = await UserProfileService.setFitnessGoals('user-123', goals);

      expect(result.fitnessGoals).toEqual(goals);
      expect(mockedAxios.put).toHaveBeenCalledWith('/users/user-123/preferences', {
        fitnessGoals: goals,
      });
    });
  });

  describe('setExperienceLevel', () => {
    it('should set experience level', async () => {
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH'],
        experienceLevel: 'ADVANCED',
        workoutFrequency: 4,
        availableEquipment: ['DUMBBELLS'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockPreferences });

      const result = await UserProfileService.setExperienceLevel('user-123', 'ADVANCED');

      expect(result.experienceLevel).toBe('ADVANCED');
    });
  });

  describe('setWorkoutFrequency', () => {
    it('should set workout frequency', async () => {
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH'],
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 6,
        availableEquipment: ['DUMBBELLS'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockPreferences });

      const result = await UserProfileService.setWorkoutFrequency('user-123', 6);

      expect(result.workoutFrequency).toBe(6);
    });
  });

  describe('setAvailableEquipment', () => {
    it('should set available equipment', async () => {
      const equipment = ['DUMBBELLS', 'BARBELL', 'KETTLEBELL'];
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH'],
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 4,
        availableEquipment: equipment,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockPreferences });

      const result = await UserProfileService.setAvailableEquipment('user-123', equipment);

      expect(result.availableEquipment).toEqual(equipment);
    });
  });

  describe('uploadProfilePicture', () => {
    it('should upload profile picture successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        userId: 'user-123',
        name: 'Test User',
        bio: 'Fitness enthusiast',
        profilePictureUrl: 'https://example.com/avatar-new.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockProfile });

      const result = await UserProfileService.uploadProfilePicture(
        'user-123',
        'file:///path/to/image.jpg'
      );

      expect(result.profilePictureUrl).toBe('https://example.com/avatar-new.jpg');
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should throw error on upload failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'Invalid image' },
        },
      });

      await expect(
        UserProfileService.uploadProfilePicture('user-123', 'file:///path/to/image.jpg')
      ).rejects.toThrow();
    });
  });

  describe('getCachedProfile', () => {
    it('should return cached profile after fetch', async () => {
      const mockProfile = {
        id: 'user-123',
        userId: 'user-123',
        name: 'Test User',
        bio: 'Fitness enthusiast',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockProfile });

      await UserProfileService.getProfile('user-123');
      const cached = UserProfileService.getCachedProfile();

      expect(cached).toEqual(mockProfile);
    });
  });

  describe('getCachedPreferences', () => {
    it('should return cached preferences after fetch', async () => {
      const mockPreferences = {
        userId: 'user-123',
        fitnessGoals: ['STRENGTH'],
        experienceLevel: 'INTERMEDIATE',
        workoutFrequency: 4,
        availableEquipment: ['DUMBBELLS'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockPreferences });

      await UserProfileService.getPreferences('user-123');
      const cached = UserProfileService.getCachedPreferences();

      expect(cached).toEqual(mockPreferences);
    });
  });
});
