import logger from '../logging/logger';

// MARK: - Types

export interface XPCalculationInput {
  totalVolume: number;
  exerciseDifficulties: string[]; // Array of difficulty levels for exercises in workout
  currentStreak: number; // Current streak in days
}

export interface XPCalculationResult {
  baseXP: number;
  difficultyMultiplier: number;
  streakBonus: number;
  totalXP: number;
  breakdown: {
    volumeXP: number;
    difficultyBonusXP: number;
    streakBonusXP: number;
  };
}

// MARK: - Constants

const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  COMPOUND: 1.2,
  ISOLATION: 1.0,
  CARDIO: 0.8,
};

const EXERCISE_DIFFICULTY_MAPPING: Record<string, string> = {
  CHEST_PRESS: 'COMPOUND',
  SQUATS: 'COMPOUND',
  DEADLIFTS: 'COMPOUND',
  ROWS: 'COMPOUND',
  BENCH_PRESS: 'COMPOUND',
  OVERHEAD_PRESS: 'COMPOUND',
  PULL_UPS: 'COMPOUND',
  DIPS: 'COMPOUND',
  BICEP_CURLS: 'ISOLATION',
  TRICEP_EXTENSIONS: 'ISOLATION',
  LEG_CURLS: 'ISOLATION',
  LEG_EXTENSIONS: 'ISOLATION',
  LATERAL_RAISES: 'ISOLATION',
  RUNNING: 'CARDIO',
  CYCLING: 'CARDIO',
  SWIMMING: 'CARDIO',
  ROWING: 'CARDIO',
};

const STREAK_BONUS_PERCENTAGE = 0.05; // 5% per day
const MAX_STREAK_BONUS = 0.5; // 50% max

// MARK: - XP Calculation

/**
 * Calculate XP earned from a workout
 * Formula: max(volume / 100, 10) × difficulty multiplier × (1 + streak bonus)
 */
export function calculateWorkoutXP(input: XPCalculationInput): XPCalculationResult {
  try {
    // Validate input
    validateXPInput(input);

    // Calculate base XP from volume
    const baseXP = Math.max(Math.floor(input.totalVolume / 100), 10);

    // Calculate difficulty multiplier (average of all exercises)
    const difficultyMultiplier = calculateDifficultyMultiplier(input.exerciseDifficulties);

    // Calculate streak bonus
    const streakBonus = calculateStreakBonus(input.currentStreak);

    // Calculate total XP
    const volumeXP = baseXP;
    const difficultyBonusXP = Math.floor(baseXP * (difficultyMultiplier - 1));
    const streakBonusXP = Math.floor((baseXP + difficultyBonusXP) * streakBonus);
    const totalXP = volumeXP + difficultyBonusXP + streakBonusXP;

    logger.info('XP calculated', {
      baseXP,
      difficultyMultiplier,
      streakBonus,
      totalXP,
    });

    return {
      baseXP,
      difficultyMultiplier,
      streakBonus,
      totalXP,
      breakdown: {
        volumeXP,
        difficultyBonusXP,
        streakBonusXP,
      },
    };
  } catch (error) {
    logger.error('Failed to calculate XP', error as Error);
    throw error;
  }
}

/**
 * Calculate difficulty multiplier based on exercise types
 */
function calculateDifficultyMultiplier(exerciseDifficulties: string[]): number {
  if (exerciseDifficulties.length === 0) {
    return 1.0;
  }

  const multipliers = exerciseDifficulties.map((difficulty) => {
    return DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
  });

  // Return average multiplier
  const sum = multipliers.reduce((a, b) => a + b, 0);
  return sum / multipliers.length;
}

/**
 * Calculate streak bonus (5% per day, max 50%)
 */
function calculateStreakBonus(currentStreak: number): number {
  if (currentStreak <= 0) {
    return 0;
  }

  const bonus = currentStreak * STREAK_BONUS_PERCENTAGE;
  return Math.min(bonus, MAX_STREAK_BONUS);
}

// MARK: - Anti-Cheat Validation

/**
 * Validate XP calculation input
 */
function validateXPInput(input: XPCalculationInput): void {
  if (input.totalVolume < 0) {
    throw new Error('Total volume cannot be negative');
  }

  if (!Array.isArray(input.exerciseDifficulties)) {
    throw new Error('Exercise difficulties must be an array');
  }

  if (input.currentStreak < 0) {
    throw new Error('Current streak cannot be negative');
  }
}

/**
 * Validate set data for anti-cheat
 */
export function validateSetForAntiCheat(reps: number, weight: number, duration?: number): void {
  // Max 50 reps per set
  if (reps > 50) {
    throw new Error('Anti-cheat: Max 50 reps per set');
  }

  // Weight between 1-1000 lbs
  if (weight < 1 || weight > 1000) {
    throw new Error('Anti-cheat: Weight must be between 1-1000 lbs');
  }

  // Duration between 5 minutes and 4 hours (if provided)
  if (duration !== undefined) {
    const durationMinutes = duration / 60;
    if (durationMinutes < 5 || durationMinutes > 240) {
      throw new Error('Anti-cheat: Workout duration must be between 5 minutes and 4 hours');
    }
  }
}

/**
 * Validate total reps per exercise
 */
export function validateExerciseReps(totalReps: number): void {
  // Max 100 reps per exercise
  if (totalReps > 100) {
    throw new Error('Anti-cheat: Max 100 reps per exercise');
  }
}

/**
 * Flag suspicious workout patterns
 */
export function flagSuspiciousPatterns(
  totalVolume: number,
  duration: number,
  exerciseCount: number
): string[] {
  const flags: string[] = [];

  // Flag if volume per minute is extremely high
  const volumePerMinute = totalVolume / (duration / 60);
  if (volumePerMinute > 10000) {
    flags.push('EXTREMELY_HIGH_VOLUME_PER_MINUTE');
  }

  // Flag if too many exercises in short time
  if (exerciseCount > 20 && duration < 3600) {
    flags.push('TOO_MANY_EXERCISES_SHORT_TIME');
  }

  // Flag if workout is suspiciously short
  if (duration < 300 && totalVolume > 10000) {
    flags.push('SUSPICIOUSLY_SHORT_DURATION');
  }

  return flags;
}

// MARK: - Level Progression

/**
 * Calculate level from total XP
 * Exponential progression: Level 1 = 0 XP, Level 2 = 500 XP, Level 3 = 1500 XP, etc.
 */
export function calculateLevelFromXP(totalXP: number): number {
  if (totalXP < 500) {
    return 1;
  }

  // Exponential formula: Level = 1 + floor(log(totalXP / 500) / log(1.5))
  // Simplified: Each level requires 50% more XP than previous
  let level = 1;
  let xpRequired = 500;

  while (totalXP >= xpRequired) {
    level++;
    xpRequired = Math.floor(xpRequired * 1.5);
  }

  return level;
}

/**
 * Calculate XP required for next level
 */
export function calculateXPForNextLevel(currentLevel: number): number {
  let xpRequired = 500;

  for (let i = 2; i <= currentLevel; i++) {
    xpRequired = Math.floor(xpRequired * 1.5);
  }

  return xpRequired;
}

/**
 * Calculate XP progress to next level
 */
export function calculateXPProgress(totalXP: number): {
  currentLevel: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercentage: number;
} {
  const currentLevel = calculateLevelFromXP(totalXP);
  const xpForCurrentLevel = calculateXPForLevel(currentLevel);
  const xpForNextLevel = calculateXPForNextLevel(currentLevel);

  const xpInCurrentLevel = totalXP - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  return {
    currentLevel,
    xpInCurrentLevel,
    xpForNextLevel,
    progressPercentage,
  };
}

/**
 * Calculate total XP required to reach a specific level
 */
export function calculateXPForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }

  let totalXP = 0;
  let xpRequired = 500;

  for (let i = 2; i <= level; i++) {
    totalXP += xpRequired;
    xpRequired = Math.floor(xpRequired * 1.5);
  }

  return totalXP;
}

// MARK: - Milestone Rewards

/**
 * Get milestone rewards for reaching a level
 */
export function getMilestoneReward(level: number): {
  xpBonus: number;
  description: string;
} {
  const milestones: Record<number, { xpBonus: number; description: string }> = {
    5: { xpBonus: 100, description: 'Reached Level 5' },
    10: { xpBonus: 250, description: 'Reached Level 10' },
    25: { xpBonus: 500, description: 'Reached Level 25' },
    50: { xpBonus: 1000, description: 'Reached Level 50' },
    100: { xpBonus: 2500, description: 'Reached Level 100' },
  };

  return (
    milestones[level] || {
      xpBonus: 0,
      description: `Reached Level ${level}`,
    }
  );
}
