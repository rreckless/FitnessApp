import { query } from '../database/connection';
import { logger } from '../logging/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Challenge {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  type: 'FRIEND' | 'COMMUNITY';
  goalType: 'XP' | 'VOLUME' | 'STREAK';
  targetValue: number;
  duration: number; // in days
  startDate: Date;
  endDate: Date;
  participants: string[];
  createdAt: Date;
}

export interface ChallengeProgress {
  id: string;
  challengeId: string;
  userId: string;
  currentValue: number;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new challenge
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3**
 */
export async function createChallenge(data: {
  creatorId: string;
  name: string;
  description: string;
  type: 'FRIEND' | 'COMMUNITY';
  goalType: 'XP' | 'VOLUME' | 'STREAK';
  targetValue: number;
  duration: number;
  participants?: string[];
}): Promise<Challenge> {
  try {
    const challengeId = uuidv4();
    const now = new Date();
    const endDate = new Date(now.getTime() + data.duration * 24 * 60 * 60 * 1000);

    // Include creator in participants
    const participants = [data.creatorId, ...(data.participants || [])];

    const result = await query(
      `INSERT INTO challenges (id, creator_id, name, description, type, goal_type, target_value, 
                               duration, start_date, end_date, participants, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING id, creator_id, name, description, type, goal_type, target_value, duration,
                 start_date, end_date, participants, created_at`,
      [
        challengeId,
        data.creatorId,
        data.name,
        data.description,
        data.type,
        data.goalType,
        data.targetValue,
        data.duration,
        now,
        endDate,
        JSON.stringify(participants),
      ]
    );

    const row = result.rows[0];
    const challenge: Challenge = {
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
      participants: JSON.parse(row.participants),
      createdAt: new Date(row.created_at),
    };

    // Initialize progress for creator
    await initializeChallengeProgress(challengeId, data.creatorId);

    logger.info('Challenge created', { challengeId, creatorId: data.creatorId });

    return challenge;
  } catch (error) {
    logger.error('Error creating challenge', error as Error);
    throw error;
  }
}

/**
 * Get challenge by ID
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
export async function getChallenge(challengeId: string): Promise<Challenge | null> {
  try {
    const result = await query(
      `SELECT id, creator_id, name, description, type, goal_type, target_value, duration,
              start_date, end_date, participants, created_at
       FROM challenges
       WHERE id = $1`,
      [challengeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
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
      participants: JSON.parse(row.participants),
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    logger.error('Error fetching challenge', error as Error);
    throw error;
  }
}

/**
 * Get challenges with filtering
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
export async function getChallenges(filters: {
  type?: 'FRIEND' | 'COMMUNITY';
  goalType?: 'XP' | 'VOLUME' | 'STREAK';
  page?: number;
  pageSize?: number;
}): Promise<{ challenges: Challenge[]; total: number }> {
  try {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.type) {
      whereClause += ` AND type = $${params.length + 1}`;
      params.push(filters.type);
    }

    if (filters.goalType) {
      whereClause += ` AND goal_type = $${params.length + 1}`;
      params.push(filters.goalType);
    }

    // Get challenges
    const result = await query(
      `SELECT id, creator_id, name, description, type, goal_type, target_value, duration,
              start_date, end_date, participants, created_at
       FROM challenges
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    const challenges = result.rows.map((row: any) => ({
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
      participants: JSON.parse(row.participants),
      createdAt: new Date(row.created_at),
    }));

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM challenges ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    return { challenges, total };
  } catch (error) {
    logger.error('Error fetching challenges', error as Error);
    throw error;
  }
}

/**
 * Join a challenge
 * 
 * **Validates: Requirements 12.3, 12.5**
 */
export async function joinChallenge(challengeId: string, userId: string): Promise<ChallengeProgress> {
  try {
    // Get challenge
    const challengeResult = await query(
      `SELECT participants FROM challenges WHERE id = $1`,
      [challengeId]
    );

    if (challengeResult.rows.length === 0) {
      throw new Error('Challenge not found');
    }

    const participants = JSON.parse(challengeResult.rows[0].participants);

    // Check if already joined
    if (participants.includes(userId)) {
      throw new Error('User already joined this challenge');
    }

    // Add user to participants
    participants.push(userId);
    await query(
      `UPDATE challenges SET participants = $1 WHERE id = $2`,
      [JSON.stringify(participants), challengeId]
    );

    // Initialize progress
    const progress = await initializeChallengeProgress(challengeId, userId);

    logger.info('User joined challenge', { challengeId, userId });

    return progress;
  } catch (error) {
    logger.error('Error joining challenge', error as Error);
    throw error;
  }
}

/**
 * Initialize challenge progress for a user
 */
async function initializeChallengeProgress(
  challengeId: string,
  userId: string
): Promise<ChallengeProgress> {
  try {
    const progressId = uuidv4();
    const now = new Date();

    const result = await query(
      `INSERT INTO challenge_progress (id, challenge_id, user_id, current_value, rank, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, challenge_id, user_id, current_value, rank, created_at, updated_at`,
      [progressId, challengeId, userId, 0, 0, now, now]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      challengeId: row.challenge_id,
      userId: row.user_id,
      currentValue: row.current_value,
      rank: row.rank,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    logger.error('Error initializing challenge progress', error as Error);
    throw error;
  }
}

/**
 * Get challenge progress for a user
 * 
 * **Validates: Requirements 12.4, 12.5**
 */
export async function getChallengeProgress(
  challengeId: string,
  userId: string
): Promise<ChallengeProgress | null> {
  try {
    const result = await query(
      `SELECT id, challenge_id, user_id, current_value, rank, created_at, updated_at
       FROM challenge_progress
       WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      challengeId: row.challenge_id,
      userId: row.user_id,
      currentValue: row.current_value,
      rank: row.rank,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    logger.error('Error fetching challenge progress', error as Error);
    throw error;
  }
}

/**
 * Get all progress for a challenge with ranking
 * 
 * **Validates: Requirements 12.4, 12.5, 12.6**
 */
export async function getChallengeLearnings(
  challengeId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ progress: ChallengeProgress[]; total: number }> {
  try {
    const offset = (page - 1) * pageSize;

    // Get progress ordered by current_value descending (highest first)
    const result = await query(
      `SELECT id, challenge_id, user_id, current_value, rank, created_at, updated_at
       FROM challenge_progress
       WHERE challenge_id = $1
       ORDER BY current_value DESC, created_at ASC
       LIMIT $2 OFFSET $3`,
      [challengeId, pageSize, offset]
    );

    const progress = result.rows.map((row: any, index: number) => ({
      id: row.id,
      challengeId: row.challenge_id,
      userId: row.user_id,
      currentValue: row.current_value,
      rank: index + 1 + offset, // Calculate rank based on position
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM challenge_progress WHERE challenge_id = $1`,
      [challengeId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    return { progress, total };
  } catch (error) {
    logger.error('Error fetching challenge progress', error as Error);
    throw error;
  }
}

/**
 * Update challenge progress
 * 
 * **Validates: Requirements 12.4, 12.5**
 */
export async function updateChallengeProgress(
  challengeId: string,
  userId: string,
  currentValue: number
): Promise<ChallengeProgress> {
  try {
    const now = new Date();

    const result = await query(
      `UPDATE challenge_progress
       SET current_value = $1, updated_at = $2
       WHERE challenge_id = $3 AND user_id = $4
       RETURNING id, challenge_id, user_id, current_value, rank, created_at, updated_at`,
      [currentValue, now, challengeId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Challenge progress not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      challengeId: row.challenge_id,
      userId: row.user_id,
      currentValue: row.current_value,
      rank: row.rank,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    logger.error('Error updating challenge progress', error as Error);
    throw error;
  }
}

/**
 * Get user's challenges
 * 
 * **Validates: Requirements 12.1, 12.5**
 */
export async function getUserChallenges(userId: string): Promise<Challenge[]> {
  try {
    const result = await query(
      `SELECT id, creator_id, name, description, type, goal_type, target_value, duration,
              start_date, end_date, participants, created_at
       FROM challenges
       WHERE participants @> $1
       ORDER BY created_at DESC`,
      [JSON.stringify([userId])]
    );

    return result.rows.map((row: any) => ({
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
      participants: JSON.parse(row.participants),
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    logger.error('Error fetching user challenges', error as Error);
    throw error;
  }
}
