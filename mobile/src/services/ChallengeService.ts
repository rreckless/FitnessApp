import DatabaseManager from '@database/DatabaseManager';
import { SyncEngine } from './SyncEngine';
import axios from 'axios';
import Config from '@config/Config';

export type ChallengeType = 'FRIEND' | 'COMMUNITY';
export type GoalType = 'XP' | 'VOLUME' | 'STREAK';

export interface Challenge {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  type: ChallengeType;
  goalType: GoalType;
  targetValue: number;
  duration: number; // days
  startDate: Date;
  endDate: Date;
  participants: string[];
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: Date;
}

export interface ChallengeProgress {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  currentValue: number;
  rank: number;
  profilePictureUrl?: string;
}

export interface ChallengeDetail extends Challenge {
  progress: ChallengeProgress[];
  userProgress?: ChallengeProgress;
}

export enum ChallengeServiceErrorType {
  InvalidChallenge = 'INVALID_CHALLENGE',
  InvalidGoalType = 'INVALID_GOAL_TYPE',
  InvalidDuration = 'INVALID_DURATION',
  DatabaseError = 'DATABASE_ERROR',
  NetworkError = 'NETWORK_ERROR',
  ChallengeNotFound = 'CHALLENGE_NOT_FOUND',
  AlreadyJoined = 'ALREADY_JOINED',
  ChallengeEnded = 'CHALLENGE_ENDED',
}

export class ChallengeServiceError extends Error {
  constructor(
    public type: ChallengeServiceErrorType,
    message: string
  ) {
    super(message);
    this.name = 'ChallengeServiceError';
  }
}

export class ChallengeService {
  private static instance: ChallengeService;
  private dbManager = DatabaseManager;
  private syncEngine: any;

  private constructor() {
    try {
      this.syncEngine = SyncEngine;
    } catch (e) {
      // SyncEngine may not be available in tests
      this.syncEngine = null;
    }
  }

  static getInstance(): ChallengeService {
    if (!ChallengeService.instance) {
      ChallengeService.instance = new ChallengeService();
    }
    return ChallengeService.instance;
  }

  /**
   * Create a new challenge
   */
  async createChallenge(
    name: string,
    description: string,
    type: ChallengeType,
    goalType: GoalType,
    targetValue: number,
    duration: number,
    invitedUserIds?: string[]
  ): Promise<Challenge> {
    try {
      this.validateChallenge(name, description, goalType, targetValue, duration);

      const userId = await this.getCurrentUserId();
      const now = new Date();
      const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

      // Create on API
      const response = await axios.post(
        `${Config.apiBaseURL}/challenges`,
        {
          name,
          description,
          type,
          goalType,
          targetValue,
          duration,
          invitedUserIds: invitedUserIds || [],
        },
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const challenge: Challenge = {
        id: response.data.id,
        creatorId: response.data.creatorId,
        name: response.data.name,
        description: response.data.description,
        type: response.data.type,
        goalType: response.data.goalType,
        targetValue: response.data.targetValue,
        duration: response.data.duration,
        startDate: new Date(response.data.startDate),
        endDate: new Date(response.data.endDate),
        participants: response.data.participants || [userId],
        status: response.data.status || 'ACTIVE',
        createdAt: new Date(response.data.createdAt),
      };

      // Store locally
      await this.storeChallengeLocally(challenge);

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'CREATE',
          entityType: 'CHALLENGE',
          entityId: challenge.id,
          payload: JSON.stringify(challenge),
        });
      }

      return challenge;
    } catch (error) {
      if (error instanceof ChallengeServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.NetworkError,
          `Failed to create challenge: ${error.message}`
        );
      }
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.DatabaseError,
        `Failed to create challenge: ${error}`
      );
    }
  }

  /**
   * Get challenge details with progress
   */
  async getChallengeDetail(challengeId: string): Promise<ChallengeDetail> {
    try {
      if (!challengeId || challengeId.trim().length === 0) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.InvalidChallenge,
          'Challenge ID cannot be empty'
        );
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/challenges/${challengeId}`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const challenge: ChallengeDetail = {
        id: response.data.id,
        creatorId: response.data.creatorId,
        name: response.data.name,
        description: response.data.description,
        type: response.data.type,
        goalType: response.data.goalType,
        targetValue: response.data.targetValue,
        duration: response.data.duration,
        startDate: new Date(response.data.startDate),
        endDate: new Date(response.data.endDate),
        participants: response.data.participants || [],
        status: response.data.status || 'ACTIVE',
        createdAt: new Date(response.data.createdAt),
        progress: (response.data.progress || []).map((p: any) => ({
          id: p.id,
          challengeId: p.challengeId,
          userId: p.userId,
          userName: p.userName,
          currentValue: p.currentValue,
          rank: p.rank,
          profilePictureUrl: p.profilePictureUrl,
        })),
        userProgress: response.data.userProgress
          ? {
              id: response.data.userProgress.id,
              challengeId: response.data.userProgress.challengeId,
              userId: response.data.userProgress.userId,
              userName: response.data.userProgress.userName,
              currentValue: response.data.userProgress.currentValue,
              rank: response.data.userProgress.rank,
              profilePictureUrl: response.data.userProgress.profilePictureUrl,
            }
          : undefined,
      };

      // Store locally
      await this.storeChallengeLocally(challenge);

      return challenge;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new ChallengeServiceError(
            ChallengeServiceErrorType.ChallengeNotFound,
            'Challenge not found'
          );
        }
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.NetworkError,
          `Failed to fetch challenge: ${error.message}`
        );
      }
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.DatabaseError,
        `Failed to fetch challenge: ${error}`
      );
    }
  }

  /**
   * Get user's active challenges
   */
  async getActiveChallenges(): Promise<Challenge[]> {
    try {
      const userId = await this.getCurrentUserId();

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/challenges`,
        {
          params: { status: 'ACTIVE' },
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const challenges: Challenge[] = (response.data.challenges || []).map((c: any) => ({
        id: c.id,
        creatorId: c.creatorId,
        name: c.name,
        description: c.description,
        type: c.type,
        goalType: c.goalType,
        targetValue: c.targetValue,
        duration: c.duration,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        participants: c.participants || [],
        status: c.status || 'ACTIVE',
        createdAt: new Date(c.createdAt),
      }));

      // Store locally
      for (const challenge of challenges) {
        await this.storeChallengeLocally(challenge);
      }

      return challenges;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Fall back to local cache
        return this.getActiveChallengesFromCache();
      }
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.DatabaseError,
        `Failed to fetch active challenges: ${error}`
      );
    }
  }

  /**
   * Join a challenge
   */
  async joinChallenge(challengeId: string): Promise<void> {
    try {
      if (!challengeId || challengeId.trim().length === 0) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.InvalidChallenge,
          'Challenge ID cannot be empty'
        );
      }

      const userId = await this.getCurrentUserId();

      // Check if already joined
      const isJoined = await this.isUserInChallengeLocally(userId, challengeId);
      if (isJoined) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.AlreadyJoined,
          'Already joined this challenge'
        );
      }

      // Join on API
      await axios.post(
        `${Config.apiBaseURL}/challenges/${challengeId}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      // Update locally
      await this.dbManager.executeSql(
        `UPDATE challenges SET participants = json_array_append(participants, '$', ?) WHERE id = ?`,
        [userId, challengeId]
      );

      // Queue for sync
      if (this.syncEngine) {
        await this.syncEngine.queueOperation({
          operation: 'UPDATE',
          entityType: 'CHALLENGE',
          entityId: challengeId,
          payload: JSON.stringify({ action: 'JOIN', userId }),
        });
      }
    } catch (error) {
      if (error instanceof ChallengeServiceError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.NetworkError,
          `Failed to join challenge: ${error.message}`
        );
      }
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.DatabaseError,
        `Failed to join challenge: ${error}`
      );
    }
  }

  /**
   * Get challenge progress
   */
  async getChallengeProgress(challengeId: string): Promise<ChallengeProgress[]> {
    try {
      if (!challengeId || challengeId.trim().length === 0) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.InvalidChallenge,
          'Challenge ID cannot be empty'
        );
      }

      // Fetch from API
      const response = await axios.get(
        `${Config.apiBaseURL}/challenges/${challengeId}/progress`,
        {
          headers: { Authorization: `Bearer ${await this.getAuthToken()}` },
        }
      );

      const progress: ChallengeProgress[] = (response.data.progress || []).map((p: any) => ({
        id: p.id,
        challengeId: p.challengeId,
        userId: p.userId,
        userName: p.userName,
        currentValue: p.currentValue,
        rank: p.rank,
        profilePictureUrl: p.profilePictureUrl,
      }));

      // Store locally
      for (const p of progress) {
        await this.storeProgressLocally(p);
      }

      return progress;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ChallengeServiceError(
          ChallengeServiceErrorType.NetworkError,
          `Failed to fetch challenge progress: ${error.message}`
        );
      }
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.DatabaseError,
        `Failed to fetch challenge progress: ${error}`
      );
    }
  }

  /**
   * Store challenge locally
   */
  private async storeChallengeLocally(challenge: Challenge | ChallengeDetail): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO challenges (id, creator_id, name, description, type, goal_type, target_value, duration, start_date, end_date, participants, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          challenge.id,
          challenge.creatorId,
          challenge.name,
          challenge.description,
          challenge.type,
          challenge.goalType,
          challenge.targetValue,
          challenge.duration,
          challenge.startDate.toISOString(),
          challenge.endDate.toISOString(),
          JSON.stringify(challenge.participants),
          challenge.status,
          challenge.createdAt.toISOString(),
        ]
      );
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Store progress locally
   */
  private async storeProgressLocally(progress: ChallengeProgress): Promise<void> {
    try {
      await this.dbManager.executeSql(
        `INSERT OR REPLACE INTO challenge_progress (id, challenge_id, user_id, user_name, current_value, rank, profile_picture_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          progress.id,
          progress.challengeId,
          progress.userId,
          progress.userName,
          progress.currentValue,
          progress.rank,
          progress.profilePictureUrl || null,
        ]
      );
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Check if user is in challenge (local)
   */
  private async isUserInChallengeLocally(userId: string, challengeId: string): Promise<boolean> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id FROM challenge_progress WHERE user_id = ? AND challenge_id = ?`,
        [userId, challengeId]
      );
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get active challenges from local cache
   */
  private async getActiveChallengesFromCache(): Promise<Challenge[]> {
    try {
      const result = await this.dbManager.executeSql(
        `SELECT id, creator_id, name, description, type, goal_type, target_value, duration, start_date, end_date, participants, status, created_at
         FROM challenges
         WHERE status = 'ACTIVE'
         ORDER BY created_at DESC`
      );

      const challenges: Challenge[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        challenges.push({
          id: row.id,
          creatorId: row.creator_id,
          name: row.name,
          description: row.description,
          type: row.type,
          goalType: row.goal_type,
          targetValue: row.target_value,
          duration: row.duration,
          startDate: new Date(row.start_date),
          endDate: new Date(row.end_date),
          participants: JSON.parse(row.participants || '[]'),
          status: row.status,
          createdAt: new Date(row.created_at),
        });
      }

      return challenges;
    } catch (error) {
      return [];
    }
  }

  /**
   * Validate challenge data
   */
  private validateChallenge(
    name: string,
    description: string,
    goalType: string,
    targetValue: number,
    duration: number
  ): void {
    if (!name || name.trim().length === 0) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidChallenge,
        'Challenge name cannot be empty'
      );
    }

    if (name.length > 100) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidChallenge,
        'Challenge name too long'
      );
    }

    if (!description || description.trim().length === 0) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidChallenge,
        'Challenge description cannot be empty'
      );
    }

    if (!['XP', 'VOLUME', 'STREAK'].includes(goalType)) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidGoalType,
        `Invalid goal type: ${goalType}`
      );
    }

    if (targetValue <= 0) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidChallenge,
        'Target value must be positive'
      );
    }

    if (duration < 1 || duration > 90) {
      throw new ChallengeServiceError(
        ChallengeServiceErrorType.InvalidDuration,
        'Duration must be between 1 and 90 days'
      );
    }
  }

  /**
   * Get current user ID
   */
  private async getCurrentUserId(): Promise<string> {
    // This would be implemented to retrieve from auth context
    return 'current-user-id';
  }

  /**
   * Get auth token from secure storage
   */
  private async getAuthToken(): Promise<string> {
    // This would be implemented to retrieve from secure storage
    return 'token';
  }
}

export default ChallengeService.getInstance();
