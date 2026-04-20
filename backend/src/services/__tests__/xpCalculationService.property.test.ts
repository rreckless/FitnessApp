import fc from 'fast-check';
import * as xpService from '../xpCalculationService';

/**
 * Property-Based Tests for XP Calculation Service
 * 
 * **Property 5: XP Calculation Correctness**
 * **Validates: Requirements 5.5, 6.1**
 */
describe('XP Calculation Service - Property-Based Tests', () => {
  // MARK: - Property 5.1: XP Formula Correctness

  /**
   * Property: For any valid volume, XP should be at least 10
   */
  it('Property 5.1: XP is always at least 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (volume) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: volume,
            exerciseDifficulties: ['COMPOUND'],
            currentStreak: 0,
          });

          expect(result.totalXP).toBeGreaterThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Base XP should be max(floor(volume / 100), 10)
   */
  it('Property 5.2: Base XP follows formula', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (volume) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: volume,
            exerciseDifficulties: ['COMPOUND'],
            currentStreak: 0,
          });

          const expectedBaseXP = Math.max(Math.floor(volume / 100), 10);
          expect(result.baseXP).toBe(expectedBaseXP);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Difficulty multiplier should be between 0.8 and 1.2
   */
  it('Property 5.3: Difficulty multiplier is within valid range', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant('COMPOUND'),
            fc.constant('ISOLATION'),
            fc.constant('CARDIO')
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (difficulties) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: 5000,
            exerciseDifficulties: difficulties,
            currentStreak: 0,
          });

          expect(result.difficultyMultiplier).toBeGreaterThanOrEqual(0.8);
          expect(result.difficultyMultiplier).toBeLessThanOrEqual(1.2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak bonus should be between 0 and 0.5 (50%)
   */
  it('Property 5.4: Streak bonus is capped at 50%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (streak) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: 5000,
            exerciseDifficulties: ['COMPOUND'],
            currentStreak: streak,
          });

          expect(result.streakBonus).toBeGreaterThanOrEqual(0);
          expect(result.streakBonus).toBeLessThanOrEqual(0.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Total XP should be >= base XP
   */
  it('Property 5.5: Total XP is at least base XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100 }),
        (volume, streak) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: volume,
            exerciseDifficulties: ['COMPOUND'],
            currentStreak: streak,
          });

          expect(result.totalXP).toBeGreaterThanOrEqual(result.baseXP);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: XP breakdown should sum to total XP
   */
  it('Property 5.6: XP breakdown sums to total XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100 }),
        (volume, streak) => {
          const result = xpService.calculateWorkoutXP({
            totalVolume: volume,
            exerciseDifficulties: ['COMPOUND'],
            currentStreak: streak,
          });

          const sum =
            result.breakdown.volumeXP +
            result.breakdown.difficultyBonusXP +
            result.breakdown.streakBonusXP;

          expect(sum).toBe(result.totalXP);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 5.7: Anti-Cheat Validation

  /**
   * Property: Valid sets should not throw
   */
  it('Property 5.7: Valid sets pass validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000 }),
        (reps, weight) => {
          expect(() => {
            xpService.validateSetForAntiCheat(reps, weight);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid reps should throw
   */
  it('Property 5.8: Invalid reps are rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (reps, weight) => {
          expect(() => {
            xpService.validateSetForAntiCheat(reps, weight);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid weight should throw
   */
  it('Property 5.9: Invalid weight is rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 1001, max: 10000 })
        ),
        fc.integer({ min: 1, max: 50 }),
        (weight, reps) => {
          expect(() => {
            xpService.validateSetForAntiCheat(reps, weight);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 5.10: Level Progression

  /**
   * Property: Level should increase monotonically with XP
   */
  it('Property 5.10: Level increases monotonically with XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 10000 }),
        (xp1, xpIncrease) => {
          const xp2 = xp1 + xpIncrease;
          const level1 = xpService.calculateLevelFromXP(xp1);
          const level2 = xpService.calculateLevelFromXP(xp2);

          expect(level2).toBeGreaterThanOrEqual(level1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: XP for level should be non-decreasing
   */
  it('Property 5.11: XP for level is non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (level) => {
          const xpForLevel = xpService.calculateXPForLevel(level);
          const xpForNextLevel = xpService.calculateXPForLevel(level + 1);

          expect(xpForNextLevel).toBeGreaterThanOrEqual(xpForLevel);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Progress percentage should be between 0 and 100
   */
  it('Property 5.12: Progress percentage is valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (xp) => {
          const progress = xpService.calculateXPProgress(xp);

          expect(progress.progressPercentage).toBeGreaterThanOrEqual(0);
          expect(progress.progressPercentage).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 5.13: Difficulty Multiplier

  /**
   * Property: Compound exercises should have 1.2x multiplier
   */
  it('Property 5.13: Compound exercises have 1.2x multiplier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const difficulties = Array(count).fill('COMPOUND');
          const result = xpService.calculateWorkoutXP({
            totalVolume: 5000,
            exerciseDifficulties: difficulties,
            currentStreak: 0,
          });

          expect(result.difficultyMultiplier).toBe(1.2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Isolation exercises should have 1.0x multiplier
   */
  it('Property 5.14: Isolation exercises have 1.0x multiplier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const difficulties = Array(count).fill('ISOLATION');
          const result = xpService.calculateWorkoutXP({
            totalVolume: 5000,
            exerciseDifficulties: difficulties,
            currentStreak: 0,
          });

          expect(result.difficultyMultiplier).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cardio exercises should have 0.8x multiplier
   */
  it('Property 5.15: Cardio exercises have 0.8x multiplier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const difficulties = Array(count).fill('CARDIO');
          const result = xpService.calculateWorkoutXP({
            totalVolume: 5000,
            exerciseDifficulties: difficulties,
            currentStreak: 0,
          });

          expect(result.difficultyMultiplier).toBe(0.8);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 6: Level Progression

  /**
   * Property: For any user, when total XP reaches or exceeds the threshold for a new level,
   * the user's level should increase by 1, and the user should not skip levels.
   * 
   * **Validates: Requirements 6.2**
   */
  it('Property 6.1: Level increases monotonically with XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 10000 }),
        (xp1, xpIncrease) => {
          const xp2 = xp1 + xpIncrease;
          const level1 = xpService.calculateLevelFromXP(xp1);
          const level2 = xpService.calculateLevelFromXP(xp2);

          // Level should never decrease when XP increases
          expect(level2).toBeGreaterThanOrEqual(level1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Level 1 should always be at 0 XP
   */
  it('Property 6.2: Level 1 starts at 0 XP', () => {
    const level = xpService.calculateLevelFromXP(0);
    expect(level).toBe(1);
  });

  /**
   * Property: XP required for each level should be non-decreasing
   */
  it('Property 6.3: XP for level is non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (level) => {
          const xpForLevel = xpService.calculateXPForLevel(level);
          const xpForNextLevel = xpService.calculateXPForLevel(level + 1);

          // Each level should require more XP than the previous
          expect(xpForNextLevel).toBeGreaterThan(xpForLevel);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User should not skip levels
   */
  it('Property 6.4: User does not skip levels', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (xp) => {
          const level = xpService.calculateLevelFromXP(xp);
          const xpForLevel = xpService.calculateXPForLevel(level);
          const xpForNextLevel = xpService.calculateXPForLevel(level + 1);

          // XP should be within the range for this level
          expect(xp).toBeGreaterThanOrEqual(xpForLevel);
          expect(xp).toBeLessThan(xpForNextLevel);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Progress percentage should be between 0 and 100
   */
  it('Property 6.5: Progress percentage is valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (xp) => {
          const progress = xpService.calculateXPProgress(xp);

          expect(progress.progressPercentage).toBeGreaterThanOrEqual(0);
          expect(progress.progressPercentage).toBeLessThanOrEqual(100);
          expect(progress.currentLevel).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: XP progress should be consistent
   */
  it('Property 6.6: XP progress is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (xp) => {
          const progress = xpService.calculateXPProgress(xp);
          const level = xpService.calculateLevelFromXP(xp);

          // Progress should match the calculated level
          expect(progress.currentLevel).toBe(level);

          // XP in current level should be non-negative
          expect(progress.xpInCurrentLevel).toBeGreaterThanOrEqual(0);

          // XP for next level should be greater than XP for current level
          expect(progress.xpForNextLevel).toBeGreaterThan(
            xpService.calculateXPForLevel(progress.currentLevel)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Milestone rewards should exist for specific levels
   */
  it('Property 6.7: Milestone rewards are defined for key levels', () => {
    const milestones = [5, 10, 25, 50, 100];

    for (const level of milestones) {
      const reward = xpService.getMilestoneReward(level);
      expect(reward.xpBonus).toBeGreaterThan(0);
      expect(reward.description).toBeDefined();
    }
  });

  /**
   * Property: Non-milestone levels should have 0 XP bonus
   */
  it('Property 6.8: Non-milestone levels have 0 XP bonus', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        (level) => {
          // Skip milestone levels
          if ([5, 10, 25, 50, 100].includes(level)) {
            return true;
          }

          const reward = xpService.getMilestoneReward(level);
          expect(reward.xpBonus).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
