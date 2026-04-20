import ChallengeService, {
  Challenge,
  ChallengeProgress,
  ChallengeDetail,
  ChallengeServiceError,
} from '../services/ChallengeService';
import DatabaseManager from '@database/DatabaseManager';
import { mockAxiosGet, mockAxiosPost, mockAxiosPut, mockAxiosDelete } from './setup';

jest.mock('@database/DatabaseManager');
jest.mock('axios');
jest.mock('../services/SyncEngine');

describe('ChallengeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
    mockAxiosPost.mockClear();
    mockAxiosPut.mockClear();
    mockAxiosDelete.mockClear();
  });

  describe('createChallenge', () => {
    it('should create a new challenge', async () => {
      const mockChallenge: Challenge = {
        id: 'challenge1',
        creatorId: 'user1',
        name: 'Push-up Challenge',
        description: 'Complete 1000 push-ups this week',
        type: 'FRIEND',
        goalType: 'VOLUME',
        targetValue: 1000,
        duration: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        participants: ['user1'],
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      mockAxiosPost.mockResolvedValueOnce({ data: mockChallenge });

      const result = await ChallengeService.createChallenge(
        'Push-up Challenge',
        'Complete 1000 push-ups this week',
        'FRIEND',
        'VOLUME',
        1000,
        7
      );

      expect(result.name).toBe('Push-up Challenge');
      expect(result.goalType).toBe('VOLUME');
      expect(result.targetValue).toBe(1000);
    });

    it('should throw error on empty challenge name', async () => {
      await expect(
        ChallengeService.createChallenge('', 'Description', 'FRIEND', 'XP', 100, 7)
      ).rejects.toThrow(ChallengeServiceError);
    });

    it('should throw error on invalid goal type', async () => {
      await expect(
        ChallengeService.createChallenge(
          'Challenge',
          'Description',
          'FRIEND',
          'INVALID' as any,
          100,
          7
        )
      ).rejects.toThrow(ChallengeServiceError);
    });

    it('should throw error on invalid duration', async () => {
      await expect(
        ChallengeService.createChallenge('Challenge', 'Description', 'FRIEND', 'XP', 100, 0)
      ).rejects.toThrow(ChallengeServiceError);
    });

    it('should throw error on negative target value', async () => {
      await expect(
        ChallengeService.createChallenge('Challenge', 'Description', 'FRIEND', 'XP', -100, 7)
      ).rejects.toThrow(ChallengeServiceError);
    });
  });

  describe('getChallengeDetail', () => {
    it('should fetch challenge details with progress', async () => {
      const mockDetail: ChallengeDetail = {
        id: 'challenge1',
        creatorId: 'user1',
        name: 'Push-up Challenge',
        description: 'Complete 1000 push-ups',
        type: 'FRIEND',
        goalType: 'VOLUME',
        targetValue: 1000,
        duration: 7,
        startDate: new Date(),
        endDate: new Date(),
        participants: ['user1', 'user2'],
        status: 'ACTIVE',
        createdAt: new Date(),
        progress: [
          {
            id: 'prog1',
            challengeId: 'challenge1',
            userId: 'user1',
            userName: 'John Doe',
            currentValue: 500,
            rank: 1,
          },
        ],
        userProgress: {
          id: 'prog1',
          challengeId: 'challenge1',
          userId: 'user1',
          userName: 'John Doe',
          currentValue: 500,
          rank: 1,
        },
      };

      mockAxiosGet.mockResolvedValueOnce({ data: mockDetail });

      const result = await ChallengeService.getChallengeDetail('challenge1');

      expect(result.name).toBe('Push-up Challenge');
      expect(result.progress).toHaveLength(1);
      expect(result.userProgress?.rank).toBe(1);
    });

    it('should throw error on empty challenge ID', async () => {
      await expect(ChallengeService.getChallengeDetail('')).rejects.toThrow(
        ChallengeServiceError
      );
    });
  });

  describe('getActiveChallenges', () => {
    it('should fetch active challenges', async () => {
      const mockChallenges: Challenge[] = [
        {
          id: 'challenge1',
          creatorId: 'user1',
          name: 'Challenge 1',
          description: 'Description 1',
          type: 'FRIEND',
          goalType: 'XP',
          targetValue: 100,
          duration: 7,
          startDate: new Date(),
          endDate: new Date(),
          participants: ['user1'],
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { challenges: mockChallenges } });

      const result = await ChallengeService.getActiveChallenges();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ACTIVE');
    });
  });

  describe('joinChallenge', () => {
    it('should join a challenge', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });

      await ChallengeService.joinChallenge('challenge1');

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should throw error on empty challenge ID', async () => {
      await expect(ChallengeService.joinChallenge('')).rejects.toThrow(ChallengeServiceError);
    });
  });

  describe('getChallengeProgress', () => {
    it('should fetch challenge progress', async () => {
      const mockProgress: ChallengeProgress[] = [
        {
          id: 'prog1',
          challengeId: 'challenge1',
          userId: 'user1',
          userName: 'John Doe',
          currentValue: 500,
          rank: 1,
        },
        {
          id: 'prog2',
          challengeId: 'challenge1',
          userId: 'user2',
          userName: 'Jane Smith',
          currentValue: 300,
          rank: 2,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { progress: mockProgress } });

      const result = await ChallengeService.getChallengeProgress('challenge1');

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('should throw error on empty challenge ID', async () => {
      await expect(ChallengeService.getChallengeProgress('')).rejects.toThrow(
        ChallengeServiceError
      );
    });
  });

  describe('challenge creation and joining', () => {
    it('should complete full challenge flow', async () => {
      const mockChallenge: Challenge = {
        id: 'challenge1',
        creatorId: 'user1',
        name: 'Test Challenge',
        description: 'Test',
        type: 'FRIEND',
        goalType: 'XP',
        targetValue: 100,
        duration: 7,
        startDate: new Date(),
        endDate: new Date(),
        participants: ['user1'],
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      mockAxiosPost.mockResolvedValueOnce({ data: mockChallenge });
      const created = await ChallengeService.createChallenge(
        'Test Challenge',
        'Test',
        'FRIEND',
        'XP',
        100,
        7
      );
      expect(created.id).toBe('challenge1');

      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });
      await ChallengeService.joinChallenge('challenge1');

      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('challenge progress tracking', () => {
    it('should track progress with correct ranking', async () => {
      const mockProgress: ChallengeProgress[] = [
        {
          id: 'prog1',
          challengeId: 'challenge1',
          userId: 'user1',
          userName: 'Leader',
          currentValue: 1000,
          rank: 1,
        },
        {
          id: 'prog2',
          challengeId: 'challenge1',
          userId: 'user2',
          userName: 'Second',
          currentValue: 800,
          rank: 2,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { progress: mockProgress } });

      const result = await ChallengeService.getChallengeProgress('challenge1');

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[0].currentValue).toBeGreaterThan(result[1].currentValue);
    });
  });

  describe('challenge types', () => {
    it('should support friend and community challenges', async () => {
      const types = ['FRIEND', 'COMMUNITY'];

      for (const type of types) {
        const mockChallenge: Challenge = {
          id: `challenge_${type}`,
          creatorId: 'user1',
          name: `${type} Challenge`,
          description: 'Test',
          type: type as any,
          goalType: 'XP',
          targetValue: 100,
          duration: 7,
          startDate: new Date(),
          endDate: new Date(),
          participants: ['user1'],
          status: 'ACTIVE',
          createdAt: new Date(),
        };

        mockAxiosPost.mockResolvedValueOnce({ data: mockChallenge });

        const result = await ChallengeService.createChallenge(
          `${type} Challenge`,
          'Test',
          type as any,
          'XP',
          100,
          7
        );

        expect(result.type).toBe(type);
      }
    });
  });
});
