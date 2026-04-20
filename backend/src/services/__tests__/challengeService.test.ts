import * as challengeService from '../challengeService';
import { query } from '../../database/connection';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../../logging/logger');
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    on: jest.fn(),
  }));
});

describe('Challenge Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - createChallenge

  /**
   * Test: Create a friend challenge
   * 
   * **Validates: Requirements 12.1, 12.2, 12.3**
   */
  it('should create a friend challenge', async () => {
    const creatorId = 'user-1';
    const participantId = 'user-2';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'challenge-1',
          creator_id: creatorId,
          name: 'Push-up Challenge',
          description: 'Complete 100 push-ups',
          type: 'FRIEND',
          goal_type: 'VOLUME',
          target_value: 10000,
          duration: 7,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          participants: JSON.stringify([creatorId, participantId]),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock progress initialization
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-1',
          challenge_id: 'challenge-1',
          user_id: creatorId,
          current_value: 0,
          rank: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const challenge = await challengeService.createChallenge({
      creatorId,
      name: 'Push-up Challenge',
      description: 'Complete 100 push-ups',
      type: 'FRIEND',
      goalType: 'VOLUME',
      targetValue: 10000,
      duration: 7,
      participants: [participantId],
    });

    expect(challenge.id).toBe('challenge-1');
    expect(challenge.creatorId).toBe(creatorId);
    expect(challenge.type).toBe('FRIEND');
    expect(challenge.goalType).toBe('VOLUME');
    expect(challenge.targetValue).toBe(10000);
    expect(challenge.duration).toBe(7);
    expect(challenge.participants).toContain(creatorId);
    expect(challenge.participants).toContain(participantId);
  });

  /**
   * Test: Create a community challenge
   * 
   * **Validates: Requirements 12.1, 12.2, 12.3**
   */
  it('should create a community challenge', async () => {
    const creatorId = 'user-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'challenge-2',
          creator_id: creatorId,
          name: 'XP Race',
          description: 'Earn 1000 XP',
          type: 'COMMUNITY',
          goal_type: 'XP',
          target_value: 1000,
          duration: 14,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          participants: JSON.stringify([creatorId]),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock progress initialization
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-2',
          challenge_id: 'challenge-2',
          user_id: creatorId,
          current_value: 0,
          rank: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const challenge = await challengeService.createChallenge({
      creatorId,
      name: 'XP Race',
      description: 'Earn 1000 XP',
      type: 'COMMUNITY',
      goalType: 'XP',
      targetValue: 1000,
      duration: 14,
    });

    expect(challenge.type).toBe('COMMUNITY');
    expect(challenge.goalType).toBe('XP');
  });

  /**
   * Test: Get challenge by ID
   * 
   * **Validates: Requirements 12.1, 12.5**
   */
  it('should get challenge by ID', async () => {
    const challengeId = 'challenge-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: challengeId,
          creator_id: 'user-1',
          name: 'Push-up Challenge',
          description: 'Complete 100 push-ups',
          type: 'FRIEND',
          goal_type: 'VOLUME',
          target_value: 10000,
          duration: 7,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          participants: JSON.stringify(['user-1', 'user-2']),
          created_at: new Date().toISOString(),
        },
      ],
    });

    const challenge = await challengeService.getChallenge(challengeId);

    expect(challenge).not.toBeNull();
    expect(challenge?.id).toBe(challengeId);
    expect(challenge?.name).toBe('Push-up Challenge');
  });

  /**
   * Test: Get non-existent challenge returns null
   * 
   * **Validates: Requirements 12.1**
   */
  it('should return null for non-existent challenge', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const challenge = await challengeService.getChallenge('non-existent');

    expect(challenge).toBeNull();
  });

  /**
   * Test: Get challenges with filtering
   * 
   * **Validates: Requirements 12.1, 12.5**
   */
  it('should get challenges with filtering', async () => {
    const mockChallenges = [
      {
        id: 'challenge-1',
        creator_id: 'user-1',
        name: 'Challenge 1',
        description: 'Description 1',
        type: 'FRIEND',
        goal_type: 'XP',
        target_value: 1000,
        duration: 7,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        participants: JSON.stringify(['user-1']),
        created_at: new Date().toISOString(),
      },
    ];

    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockChallenges,
    });

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 1 }],
    });

    const result = await challengeService.getChallenges({
      type: 'FRIEND',
      goalType: 'XP',
    });

    expect(result.challenges).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.challenges[0].type).toBe('FRIEND');
    expect(result.challenges[0].goalType).toBe('XP');
  });

  /**
   * Test: Join a challenge
   * 
   * **Validates: Requirements 12.3, 12.5**
   */
  it('should join a challenge', async () => {
    const challengeId = 'challenge-1';
    const userId = 'user-2';

    // Mock getting challenge
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          participants: JSON.stringify(['user-1']),
        },
      ],
    });

    // Mock updating participants
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: challengeId }],
    });

    // Mock initializing progress
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-1',
          challenge_id: challengeId,
          user_id: userId,
          current_value: 0,
          rank: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const progress = await challengeService.joinChallenge(challengeId, userId);

    expect(progress.userId).toBe(userId);
    expect(progress.currentValue).toBe(0);
  });

  /**
   * Test: Cannot join challenge twice
   * 
   * **Validates: Requirements 12.3**
   */
  it('should not allow joining challenge twice', async () => {
    const challengeId = 'challenge-1';
    const userId = 'user-1';

    // Mock getting challenge with user already in participants
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          participants: JSON.stringify(['user-1']),
        },
      ],
    });

    await expect(challengeService.joinChallenge(challengeId, userId)).rejects.toThrow(
      'User already joined this challenge'
    );
  });

  /**
   * Test: Get challenge progress
   * 
   * **Validates: Requirements 12.4, 12.5**
   */
  it('should get challenge progress', async () => {
    const challengeId = 'challenge-1';
    const userId = 'user-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-1',
          challenge_id: challengeId,
          user_id: userId,
          current_value: 500,
          rank: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const progress = await challengeService.getChallengeProgress(challengeId, userId);

    expect(progress).not.toBeNull();
    expect(progress?.userId).toBe(userId);
    expect(progress?.currentValue).toBe(500);
    expect(progress?.rank).toBe(1);
  });

  /**
   * Test: Get challenge learnings (progress with ranking)
   * 
   * **Validates: Requirements 12.4, 12.5, 12.6**
   */
  it('should get challenge learnings with ranking', async () => {
    const challengeId = 'challenge-1';
    const mockProgress = [
      {
        id: 'progress-1',
        challenge_id: challengeId,
        user_id: 'user-1',
        current_value: 1000,
        rank: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-2',
        challenge_id: challengeId,
        user_id: 'user-2',
        current_value: 500,
        rank: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockProgress,
    });

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 2 }],
    });

    const result = await challengeService.getChallengeLearnings(challengeId, 1, 50);

    expect(result.progress).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.progress[0].currentValue).toBe(1000);
    expect(result.progress[1].currentValue).toBe(500);
  });

  /**
   * Test: Update challenge progress
   * 
   * **Validates: Requirements 12.4, 12.5**
   */
  it('should update challenge progress', async () => {
    const challengeId = 'challenge-1';
    const userId = 'user-1';
    const newValue = 750;

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-1',
          challenge_id: challengeId,
          user_id: userId,
          current_value: newValue,
          rank: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const progress = await challengeService.updateChallengeProgress(
      challengeId,
      userId,
      newValue
    );

    expect(progress.currentValue).toBe(newValue);
  });

  /**
   * Test: Get user's challenges
   * 
   * **Validates: Requirements 12.1, 12.5**
   */
  it('should get user challenges', async () => {
    const userId = 'user-1';
    const mockChallenges = [
      {
        id: 'challenge-1',
        creator_id: 'user-1',
        name: 'Challenge 1',
        description: 'Description 1',
        type: 'FRIEND',
        goal_type: 'XP',
        target_value: 1000,
        duration: 7,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        participants: JSON.stringify([userId]),
        created_at: new Date().toISOString(),
      },
    ];

    (query as jest.Mock).mockResolvedValueOnce({
      rows: mockChallenges,
    });

    const challenges = await challengeService.getUserChallenges(userId);

    expect(challenges).toHaveLength(1);
    expect(challenges[0].participants).toContain(userId);
  });

  /**
   * Test: Challenge with streak goal type
   * 
   * **Validates: Requirements 12.2**
   */
  it('should create challenge with streak goal type', async () => {
    const creatorId = 'user-1';

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'challenge-3',
          creator_id: creatorId,
          name: 'Streak Challenge',
          description: 'Maintain a 30-day streak',
          type: 'COMMUNITY',
          goal_type: 'STREAK',
          target_value: 30,
          duration: 30,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          participants: JSON.stringify([creatorId]),
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Mock progress initialization
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'progress-3',
          challenge_id: 'challenge-3',
          user_id: creatorId,
          current_value: 0,
          rank: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const challenge = await challengeService.createChallenge({
      creatorId,
      name: 'Streak Challenge',
      description: 'Maintain a 30-day streak',
      type: 'COMMUNITY',
      goalType: 'STREAK',
      targetValue: 30,
      duration: 30,
    });

    expect(challenge.goalType).toBe('STREAK');
    expect(challenge.targetValue).toBe(30);
  });
});
