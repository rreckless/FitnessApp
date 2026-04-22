import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';

export type ChallengeType = 'friend' | 'community';
export type ChallengeGoalType = 'xp' | 'volume' | 'streak';
export type ChallengeStatus = 'active' | 'completed' | 'archived';

export interface Challenge {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  type: ChallengeType;
  goalType: ChallengeGoalType;
  targetValue: number;
  duration: number; // days
  startDate: number;
  endDate: number;
  status: ChallengeStatus;
  participantCount: number;
}

export interface ChallengeProgress {
  challengeId: string;
  userId: string;
  userName: string;
  currentValue: number;
  rank: number;
  percentComplete: number;
}

export interface ChallengeDetails extends Challenge {
  participants: ChallengeProgress[];
  userProgress?: ChallengeProgress;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DB_NAME = 'fitquest.db';
const CHALLENGES_TABLE = 'challenges_cache';
const CHALLENGE_PROGRESS_TABLE = 'challenge_progress_cache';

export class ChallengeService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string = '';
  private cache: Map<string, CacheEntry> = new Map();

  constructor(apiBaseUrl: string, userId: string) {
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
    });
    this.currentUserId = userId;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${CHALLENGES_TABLE} (
          id TEXT PRIMARY KEY,
          creatorId TEXT NOT NULL,
          creatorName TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          goalType TEXT NOT NULL,
          targetValue INTEGER NOT NULL,
          duration INTEGER NOT NULL,
          startDate INTEGER NOT NULL,
          endDate INTEGER NOT NULL,
          status TEXT NOT NULL,
          participantCount INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${CHALLENGE_PROGRESS_TABLE} (
          id TEXT PRIMARY KEY,
          challengeId TEXT NOT NULL,
          userId TEXT NOT NULL,
          userName TEXT NOT NULL,
          currentValue INTEGER NOT NULL,
          rank INTEGER NOT NULL,
          percentComplete REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(challengeId, userId)
        )
      `);

      // Create indexes for faster queries
      await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_challenge_status 
        ON ${CHALLENGES_TABLE}(status)
      `);

      await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_challenge_progress_rank 
        ON ${CHALLENGE_PROGRESS_TABLE}(challengeId, rank)
      `);
    } catch (error) {
      console.error('Failed to initialize challenge database:', error);
    }
  }

  /**
   * Create a new challenge
   */
  async createChallenge(
    name: string,
    description: string,
    type: ChallengeType,
    goalType: ChallengeGoalType,
    targetValue: number,
    duration: number,
    invitedUserIds?: string[]
  ): Promise<Challenge | null> {
    try {
      const response = await this.apiClient.post<Challenge>('/challenges', {
        name,
        description,
        type,
        goalType,
        targetValue,
        duration,
        invitedUserIds,
      });

      const challenge = response.data;

      // Cache locally
      await this.cacheChallenge(challenge);

      // Invalidate challenges list cache
      this.cache.delete('challenges_active');
      this.cache.delete('challenges_all');

      return challenge;
    } catch (error) {
      console.error('Failed to create challenge:', error);
      return null;
    }
  }

  /**
   * Get active challenges
   */
  async getActiveChallenges(): Promise<Challenge[]> {
    try {
      const cacheKey = 'challenges_active';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<Challenge[]>('/challenges', {
        params: { status: 'active' },
      });

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheChallenges(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch active challenges, using cached data:', error);
      return this.getActiveChallengesFromCache();
    }
  }

  /**
   * Get all challenges (active, completed, archived)
   */
  async getAllChallenges(): Promise<Challenge[]> {
    try {
      const cacheKey = 'challenges_all';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<Challenge[]>('/challenges');

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheChallenges(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch all challenges, using cached data:', error);
      return this.getAllChallengesFromCache();
    }
  }

  /**
   * Get challenges by type
   */
  async getChallengesByType(type: ChallengeType): Promise<Challenge[]> {
    try {
      const cacheKey = `challenges_${type}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<Challenge[]>('/challenges', {
        params: { type },
      });

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheChallenges(data);

      return data;
    } catch (error) {
      console.warn(`Failed to fetch ${type} challenges, using cached data:`, error);
      return this.getChallengesByTypeFromCache(type);
    }
  }

  /**
   * Get challenge details with progress
   */
  async getChallengeDetails(challengeId: string): Promise<ChallengeDetails | null> {
    try {
      const cacheKey = `challenge_${challengeId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<ChallengeDetails>(
        `/challenges/${challengeId}`
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheChallenge(data);
      await this.cacheChallengeProgress(data.participants);

      return data;
    } catch (error) {
      console.warn('Failed to fetch challenge details, using cached data:', error);
      return this.getChallengeDetailsFromCache(challengeId);
    }
  }

  /**
   * Join a challenge
   */
  async joinChallenge(challengeId: string): Promise<boolean> {
    try {
      await this.apiClient.post(`/challenges/${challengeId}/join`);

      // Invalidate cache
      this.cache.delete(`challenge_${challengeId}`);
      this.cache.delete('challenges_active');
      this.cache.delete('challenges_all');

      return true;
    } catch (error) {
      console.error('Failed to join challenge:', error);
      return false;
    }
  }

  /**
   * Get user's challenge progress
   */
  async getUserChallengeProgress(challengeId: string): Promise<ChallengeProgress | null> {
    try {
      const response = await this.apiClient.get<ChallengeProgress>(
        `/challenges/${challengeId}/progress/${this.currentUserId}`
      );

      const progress = response.data;

      // Cache locally
      await this.cacheChallengeProgress([progress]);

      return progress;
    } catch (error) {
      console.warn('Failed to fetch user challenge progress:', error);
      return this.getUserChallengeProgressFromCache(challengeId);
    }
  }

  /**
   * Get challenge rankings
   */
  async getChallengeRankings(challengeId: string): Promise<ChallengeProgress[]> {
    try {
      const cacheKey = `challenge_rankings_${challengeId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      const response = await this.apiClient.get<ChallengeProgress[]>(
        `/challenges/${challengeId}/rankings`
      );

      const data = response.data;

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Store in local database
      await this.cacheChallengeProgress(data);

      return data;
    } catch (error) {
      console.warn('Failed to fetch challenge rankings, using cached data:', error);
      return this.getChallengeRankingsFromCache(challengeId);
    }
  }

  /**
   * Cache challenge locally
   */
  private async cacheChallenge(challenge: Challenge): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${CHALLENGES_TABLE} 
         (id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          challenge.id,
          challenge.creatorId,
          challenge.creatorName,
          challenge.name,
          challenge.description,
          challenge.type,
          challenge.goalType,
          challenge.targetValue,
          challenge.duration,
          challenge.startDate,
          challenge.endDate,
          challenge.status,
          challenge.participantCount,
          timestamp,
        ]
      );
    } catch (error) {
      console.error('Failed to cache challenge:', error);
    }
  }

  /**
   * Cache challenges locally
   */
  private async cacheChallenges(challenges: Challenge[]): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      for (const challenge of challenges) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${CHALLENGES_TABLE} 
           (id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            challenge.id,
            challenge.creatorId,
            challenge.creatorName,
            challenge.name,
            challenge.description,
            challenge.type,
            challenge.goalType,
            challenge.targetValue,
            challenge.duration,
            challenge.startDate,
            challenge.endDate,
            challenge.status,
            challenge.participantCount,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache challenges:', error);
    }
  }

  /**
   * Get active challenges from cache
   */
  private async getActiveChallengesFromCache(): Promise<Challenge[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount 
         FROM ${CHALLENGES_TABLE} 
         WHERE status = 'active' 
         ORDER BY startDate DESC`
      );

      const challenges: Challenge[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        challenges.push(result[0].rows.item(i));
      }

      return challenges;
    } catch (error) {
      console.error('Failed to retrieve active challenges from cache:', error);
      return [];
    }
  }

  /**
   * Get all challenges from cache
   */
  private async getAllChallengesFromCache(): Promise<Challenge[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount 
         FROM ${CHALLENGES_TABLE} 
         ORDER BY startDate DESC`
      );

      const challenges: Challenge[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        challenges.push(result[0].rows.item(i));
      }

      return challenges;
    } catch (error) {
      console.error('Failed to retrieve all challenges from cache:', error);
      return [];
    }
  }

  /**
   * Get challenges by type from cache
   */
  private async getChallengesByTypeFromCache(type: ChallengeType): Promise<Challenge[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount 
         FROM ${CHALLENGES_TABLE} 
         WHERE type = ? 
         ORDER BY startDate DESC`,
        [type]
      );

      const challenges: Challenge[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        challenges.push(result[0].rows.item(i));
      }

      return challenges;
    } catch (error) {
      console.error('Failed to retrieve challenges by type from cache:', error);
      return [];
    }
  }

  /**
   * Get challenge details from cache
   */
  private async getChallengeDetailsFromCache(
    challengeId: string
  ): Promise<ChallengeDetails | null> {
    if (!this.db) return null;

    try {
      const challengeResult = await this.db.executeSql(
        `SELECT id, creatorId, creatorName, name, description, type, goalType, targetValue, duration, startDate, endDate, status, participantCount 
         FROM ${CHALLENGES_TABLE} 
         WHERE id = ?`,
        [challengeId]
      );

      if (challengeResult[0].rows.length === 0) return null;

      const challenge = challengeResult[0].rows.item(0);

      const progressResult = await this.db.executeSql(
        `SELECT challengeId, userId, userName, currentValue, rank, percentComplete 
         FROM ${CHALLENGE_PROGRESS_TABLE} 
         WHERE challengeId = ? 
         ORDER BY rank ASC`,
        [challengeId]
      );

      const participants: ChallengeProgress[] = [];
      for (let i = 0; i < progressResult[0].rows.length; i++) {
        participants.push(progressResult[0].rows.item(i));
      }

      const userProgress = participants.find((p) => p.userId === this.currentUserId);

      return {
        ...challenge,
        participants,
        userProgress,
      };
    } catch (error) {
      console.error('Failed to retrieve challenge details from cache:', error);
      return null;
    }
  }

  /**
   * Cache challenge progress locally
   */
  private async cacheChallengeProgress(progress: ChallengeProgress[]): Promise<void> {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      for (const p of progress) {
        await this.db.executeSql(
          `INSERT OR REPLACE INTO ${CHALLENGE_PROGRESS_TABLE} 
           (id, challengeId, userId, userName, currentValue, rank, percentComplete, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid.v4(),
            p.challengeId,
            p.userId,
            p.userName,
            p.currentValue,
            p.rank,
            p.percentComplete,
            timestamp,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache challenge progress:', error);
    }
  }

  /**
   * Get user challenge progress from cache
   */
  private async getUserChallengeProgressFromCache(
    challengeId: string
  ): Promise<ChallengeProgress | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.executeSql(
        `SELECT challengeId, userId, userName, currentValue, rank, percentComplete 
         FROM ${CHALLENGE_PROGRESS_TABLE} 
         WHERE challengeId = ? AND userId = ?`,
        [challengeId, this.currentUserId]
      );

      if (result[0].rows.length === 0) return null;

      return result[0].rows.item(0);
    } catch (error) {
      console.error('Failed to retrieve user challenge progress from cache:', error);
      return null;
    }
  }

  /**
   * Get challenge rankings from cache
   */
  private async getChallengeRankingsFromCache(challengeId: string): Promise<ChallengeProgress[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.executeSql(
        `SELECT challengeId, userId, userName, currentValue, rank, percentComplete 
         FROM ${CHALLENGE_PROGRESS_TABLE} 
         WHERE challengeId = ? 
         ORDER BY rank ASC`,
        [challengeId]
      );

      const rankings: ChallengeProgress[] = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        rankings.push(result[0].rows.item(i));
      }

      return rankings;
    } catch (error) {
      console.error('Failed to retrieve challenge rankings from cache:', error);
      return [];
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    if (!this.db) return;

    try {
      await this.db.executeSql(`DELETE FROM ${CHALLENGES_TABLE}`);
      await this.db.executeSql(`DELETE FROM ${CHALLENGE_PROGRESS_TABLE}`);
    } catch (error) {
      console.error('Failed to clear challenge cache:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
      } catch (error) {
        console.error('Failed to close challenge database:', error);
      }
    }
  }
}
