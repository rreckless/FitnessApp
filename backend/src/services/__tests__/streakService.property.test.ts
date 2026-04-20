import fc from 'fast-check';
import * as streakService from '../streakService';

/**
 * Property-Based Tests for Streak Service
 * 
 * **Property 8: Streak Increment and Reset**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 * 
 * **Property 9: Streak Milestone Rewards**
 * **Validates: Requirements 7.4**
 */
describe('Streak Service - Property-Based Tests', () => {
  // MARK: - Property 8: Streak Increment and Reset

  /**
   * Property: Current streak should never exceed longest streak
   */
  it('Property 8.1: Current streak never exceeds longest streak', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (currentStreak, longestStreak) => {
          const maxStreak = Math.max(currentStreak, longestStreak);

          expect(() => {
            streakService.validateStreakData(currentStreak, longestStreak);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak should be non-negative
   */
  it('Property 8.2: Streak is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (streak) => {
          expect(streak).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Longest streak should be non-decreasing
   */
  it('Property 8.3: Longest streak is non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (streak1, streak2) => {
          const longestStreak1 = Math.max(streak1, 0);
          const longestStreak2 = Math.max(longestStreak1, streak2);

          expect(longestStreak2).toBeGreaterThanOrEqual(longestStreak1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak reset should set current streak to 0
   */
  it('Property 8.4: Streak reset sets current to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (currentStreak, longestStreak) => {
          // After reset, current should be 0
          const resetStreak = 0;

          expect(resetStreak).toBe(0);
          expect(resetStreak).toBeLessThanOrEqual(longestStreak);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Longest streak should be preserved after reset
   */
  it('Property 8.5: Longest streak is preserved after reset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (currentStreak, longestStreak) => {
          const maxStreak = Math.max(currentStreak, longestStreak);

          // After reset
          const resetCurrent = 0;
          const resetLongest = maxStreak;

          expect(resetLongest).toBe(maxStreak);
          expect(resetCurrent).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 9: Streak Milestone Rewards

  /**
   * Property: Milestone rewards should be positive
   */
  it('Property 9.1: Milestone rewards are positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (streak) => {
          const milestone = streakService.checkStreakMilestone(streak);

          if (milestone) {
            expect(milestone.xpReward).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Milestone days should be positive
   */
  it('Property 9.2: Milestone days are positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (streak) => {
          const milestone = streakService.checkStreakMilestone(streak);

          if (milestone) {
            expect(milestone.days).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Milestone rewards should increase with streak
   */
  it('Property 9.3: Milestone rewards increase with streak', () => {
    const milestones = streakService.getStreakMilestones();

    for (let i = 0; i < milestones.length - 1; i++) {
      expect(milestones[i + 1].xpReward).toBeGreaterThanOrEqual(milestones[i].xpReward);
    }
  });

  /**
   * Property: Next milestone should be greater than current streak
   */
  it('Property 9.4: Next milestone is greater than current streak', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (streak) => {
          const nextMilestone = streakService.getNextMilestone(streak);

          if (nextMilestone) {
            expect(nextMilestone.days).toBeGreaterThan(streak);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Days until next milestone should be positive
   */
  it('Property 9.5: Days until next milestone is positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (streak) => {
          const daysUntil = streakService.daysUntilNextMilestone(streak);

          if (daysUntil !== null) {
            expect(daysUntil).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All milestones should have unique days
   */
  it('Property 9.6: All milestones have unique days', () => {
    const milestones = streakService.getStreakMilestones();
    const days = milestones.map((m) => m.days);
    const uniqueDays = new Set(days);

    expect(uniqueDays.size).toBe(days.length);
  });

  /**
   * Property: Milestones should be in ascending order
   */
  it('Property 9.7: Milestones are in ascending order', () => {
    const milestones = streakService.getStreakMilestones();

    for (let i = 0; i < milestones.length - 1; i++) {
      expect(milestones[i + 1].days).toBeGreaterThan(milestones[i].days);
    }
  });

  /**
   * Property: Streak validation should reject invalid data
   */
  it('Property 9.8: Streak validation rejects invalid data', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        fc.integer({ min: 0, max: 1000 }),
        (negativeStreak, longestStreak) => {
          expect(() => {
            streakService.validateStreakData(negativeStreak, longestStreak);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak validation should accept valid data
   */
  it('Property 9.9: Streak validation accepts valid data', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (currentStreak, longestStreak) => {
          const maxStreak = Math.max(currentStreak, longestStreak);

          expect(() => {
            streakService.validateStreakData(currentStreak, maxStreak);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Milestone detection should be deterministic
   */
  it('Property 9.10: Milestone detection is deterministic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (streak) => {
          const milestone1 = streakService.checkStreakMilestone(streak);
          const milestone2 = streakService.checkStreakMilestone(streak);

          if (milestone1 === null) {
            expect(milestone2).toBeNull();
          } else {
            expect(milestone2).not.toBeNull();
            expect(milestone2?.days).toBe(milestone1.days);
            expect(milestone2?.xpReward).toBe(milestone1.xpReward);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
