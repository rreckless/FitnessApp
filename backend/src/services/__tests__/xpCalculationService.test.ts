import * as xpService from '../xpCalculationService';

/**
 * Unit Tests for XP Calculation Service
 * 
 * **Validates: Requirements 5.5, 6.1, 6.2**
 */
describe('XP Calculation Service', () => {
  // MARK: - XP Calculation Tests

  describe('XP Calculation', () => {
    it('should calculate base XP from volume', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 0,
      });

      // 5000 / 100 = 50 XP
      expect(result.baseXP).toBe(50);
    });

    it('should apply minimum XP of 10', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 500,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 0,
      });

      // 500 / 100 = 5, but minimum is 10
      expect(result.baseXP).toBe(10);
    });

    it('should apply difficulty multiplier for compound exercises', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 0,
      });

      // Compound = 1.2x multiplier
      expect(result.difficultyMultiplier).toBe(1.2);
    });

    it('should apply difficulty multiplier for isolation exercises', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['ISOLATION'],
        currentStreak: 0,
      });

      // Isolation = 1.0x multiplier
      expect(result.difficultyMultiplier).toBe(1.0);
    });

    it('should apply difficulty multiplier for cardio exercises', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['CARDIO'],
        currentStreak: 0,
      });

      // Cardio = 0.8x multiplier
      expect(result.difficultyMultiplier).toBe(0.8);
    });

    it('should average difficulty multiplier for mixed exercises', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND', 'ISOLATION', 'CARDIO'],
        currentStreak: 0,
      });

      // Average of 1.2, 1.0, 0.8 = 1.0
      expect(result.difficultyMultiplier).toBeCloseTo(1.0, 1);
    });

    it('should apply streak bonus', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 5,
      });

      // 5 days * 5% = 25% bonus
      expect(result.streakBonus).toBeCloseTo(0.25, 2);
    });

    it('should cap streak bonus at 50%', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 20,
      });

      // 20 days * 5% = 100%, but capped at 50%
      expect(result.streakBonus).toBe(0.5);
    });

    it('should calculate total XP correctly', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 0,
      });

      // Base: 50, Difficulty bonus: 50 * 0.2 = 10, Streak: 0
      // Total: 50 + 10 = 60
      expect(result.totalXP).toBe(60);
    });

    it('should include streak bonus in total XP', () => {
      const result = xpService.calculateWorkoutXP({
        totalVolume: 5000,
        exerciseDifficulties: ['COMPOUND'],
        currentStreak: 5,
      });

      // Base: 50, Difficulty bonus: 10, Streak bonus: (50 + 10) * 0.25 = 15
      // Total: 50 + 10 + 15 = 75
      expect(result.totalXP).toBe(75);
    });
  });

  // MARK: - Anti-Cheat Validation Tests

  describe('Anti-Cheat Validation', () => {
    it('should reject reps > 50', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(51, 100);
      }).toThrow('Anti-cheat: Max 50 reps per set');
    });

    it('should reject weight < 1', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(10, 0);
      }).toThrow('Anti-cheat: Weight must be between 1-1000 lbs');
    });

    it('should reject weight > 1000', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(10, 1001);
      }).toThrow('Anti-cheat: Weight must be between 1-1000 lbs');
    });

    it('should reject duration < 5 minutes', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(10, 100, 240); // 4 minutes
      }).toThrow('Anti-cheat: Workout duration must be between 5 minutes and 4 hours');
    });

    it('should reject duration > 4 hours', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(10, 100, 14400 + 60); // 4 hours 1 minute
      }).toThrow('Anti-cheat: Workout duration must be between 5 minutes and 4 hours');
    });

    it('should accept valid set data', () => {
      expect(() => {
        xpService.validateSetForAntiCheat(10, 225, 3600);
      }).not.toThrow();
    });

    it('should reject total reps > 100', () => {
      expect(() => {
        xpService.validateExerciseReps(101);
      }).toThrow('Anti-cheat: Max 100 reps per exercise');
    });

    it('should accept total reps <= 100', () => {
      expect(() => {
        xpService.validateExerciseReps(100);
      }).not.toThrow();
    });
  });

  // MARK: - Suspicious Pattern Detection Tests

  describe('Suspicious Pattern Detection', () => {
    it('should flag extremely high volume per minute', () => {
      const flags = xpService.flagSuspiciousPatterns(
        600000, // 600k volume
        60, // 1 minute
        5 // 5 exercises
      );

      expect(flags).toContain('EXTREMELY_HIGH_VOLUME_PER_MINUTE');
    });

    it('should flag too many exercises in short time', () => {
      const flags = xpService.flagSuspiciousPatterns(
        5000, // 5k volume
        600, // 10 minutes
        25 // 25 exercises
      );

      expect(flags).toContain('TOO_MANY_EXERCISES_SHORT_TIME');
    });

    it('should flag suspiciously short duration', () => {
      const flags = xpService.flagSuspiciousPatterns(
        50000, // 50k volume
        240, // 4 minutes
        5 // 5 exercises
      );

      expect(flags).toContain('SUSPICIOUSLY_SHORT_DURATION');
    });

    it('should not flag normal workout', () => {
      const flags = xpService.flagSuspiciousPatterns(
        5000, // 5k volume
        3600, // 1 hour
        5 // 5 exercises
      );

      expect(flags).toHaveLength(0);
    });
  });

  // MARK: - Level Progression Tests

  describe('Level Progression', () => {
    it('should calculate level 1 for 0 XP', () => {
      const level = xpService.calculateLevelFromXP(0);
      expect(level).toBe(1);
    });

    it('should calculate level 2 for 500 XP', () => {
      const level = xpService.calculateLevelFromXP(500);
      expect(level).toBe(2);
    });

    it('should calculate level 3 for 1500 XP', () => {
      const level = xpService.calculateLevelFromXP(1500);
      expect(level).toBe(3);
    });

    it('should calculate XP for next level', () => {
      const xpForLevel2 = xpService.calculateXPForNextLevel(1);
      expect(xpForLevel2).toBe(500);

      const xpForLevel3 = xpService.calculateXPForNextLevel(2);
      expect(xpForLevel3).toBe(750);
    });

    it('should calculate XP progress to next level', () => {
      const progress = xpService.calculateXPProgress(750);

      expect(progress.currentLevel).toBe(2);
      expect(progress.xpInCurrentLevel).toBe(250);
      expect(progress.xpForNextLevel).toBe(750);
      expect(progress.progressPercentage).toBeCloseTo(33.33, 1);
    });

    it('should calculate total XP for level', () => {
      const xpForLevel1 = xpService.calculateXPForLevel(1);
      expect(xpForLevel1).toBe(0);

      const xpForLevel2 = xpService.calculateXPForLevel(2);
      expect(xpForLevel2).toBe(500);

      const xpForLevel3 = xpService.calculateXPForLevel(3);
      expect(xpForLevel3).toBe(1500);
    });
  });

  // MARK: - Milestone Rewards Tests

  describe('Milestone Rewards', () => {
    it('should return reward for level 5', () => {
      const reward = xpService.getMilestoneReward(5);
      expect(reward.xpBonus).toBe(100);
    });

    it('should return reward for level 10', () => {
      const reward = xpService.getMilestoneReward(10);
      expect(reward.xpBonus).toBe(250);
    });

    it('should return reward for level 25', () => {
      const reward = xpService.getMilestoneReward(25);
      expect(reward.xpBonus).toBe(500);
    });

    it('should return reward for level 50', () => {
      const reward = xpService.getMilestoneReward(50);
      expect(reward.xpBonus).toBe(1000);
    });

    it('should return reward for level 100', () => {
      const reward = xpService.getMilestoneReward(100);
      expect(reward.xpBonus).toBe(2500);
    });

    it('should return default reward for non-milestone level', () => {
      const reward = xpService.getMilestoneReward(7);
      expect(reward.xpBonus).toBe(0);
      expect(reward.description).toContain('Level 7');
    });
  });
});
