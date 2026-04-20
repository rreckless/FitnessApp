import fc from 'fast-check';
import * as rankService from '../muscleGroupRankService';

/**
 * Property-Based Tests for Muscle Group Rank Service
 * 
 * **Property 7: Muscle Group Rank Tracking**
 * **Validates: Requirements 6.4, 6.5**
 */
describe('Muscle Group Rank Service - Property-Based Tests', () => {
  // MARK: - Property 7.1: Rank Calculation

  /**
   * Property: Rank should be between 1 and 5
   */
  it('Property 7.1: Rank is always between 1 and 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);

          expect(rank).toBeGreaterThanOrEqual(1);
          expect(rank).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rank should increase monotonically with percentile
   */
  it('Property 7.2: Rank increases monotonically with percentile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (p1, p2) => {
          const rank1 = rankService.calculateRankFromPercentile(p1);
          const rank2 = rankService.calculateRankFromPercentile(p2);

          if (p1 <= p2) {
            expect(rank2).toBeGreaterThanOrEqual(rank1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile 0-19 should be Rank 1
   */
  it('Property 7.3: Percentile 0-19 is Rank 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 19 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);
          expect(rank).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile 20-39 should be Rank 2
   */
  it('Property 7.4: Percentile 20-39 is Rank 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 39 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);
          expect(rank).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile 40-59 should be Rank 3
   */
  it('Property 7.5: Percentile 40-59 is Rank 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40, max: 59 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);
          expect(rank).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile 60-79 should be Rank 4
   */
  it('Property 7.6: Percentile 60-79 is Rank 4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 79 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);
          expect(rank).toBe(4);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile 80-100 should be Rank 5
   */
  it('Property 7.7: Percentile 80-100 is Rank 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        (percentile) => {
          const rank = rankService.calculateRankFromPercentile(percentile);
          expect(rank).toBe(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 7.8: Validation

  /**
   * Property: Valid muscle groups should pass validation
   */
  it('Property 7.8: Valid muscle groups pass validation', () => {
    const validGroups = rankService.getValidMuscleGroups();

    for (const group of validGroups) {
      expect(() => {
        rankService.validateMuscleGroupRankData(group, 5000, 3);
      }).not.toThrow();
    }
  });

  /**
   * Property: Invalid muscle groups should throw
   */
  it('Property 7.9: Invalid muscle groups throw error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (invalidGroup) => {
          const validGroups = rankService.getValidMuscleGroups();

          // Skip if it happens to be a valid group
          if (validGroups.includes(invalidGroup)) {
            return true;
          }

          expect(() => {
            rankService.validateMuscleGroupRankData(invalidGroup, 5000, 3);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Negative volume should throw
   */
  it('Property 7.10: Negative volume throws error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: -1 }),
        (negativeVolume) => {
          expect(() => {
            rankService.validateMuscleGroupRankData('CHEST', negativeVolume, 3);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid rank should throw
   */
  it('Property 7.11: Invalid rank throws error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 6, max: 1000 })
        ),
        (invalidRank) => {
          expect(() => {
            rankService.validateMuscleGroupRankData('CHEST', 5000, invalidRank);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // MARK: - Property 7.12: Rank Boundaries

  /**
   * Property: Rank boundaries should be consistent
   */
  it('Property 7.12: Rank boundaries are consistent', () => {
    // Test boundary values
    expect(rankService.calculateRankFromPercentile(0)).toBe(1);
    expect(rankService.calculateRankFromPercentile(19.99)).toBe(1);
    expect(rankService.calculateRankFromPercentile(20)).toBe(2);
    expect(rankService.calculateRankFromPercentile(39.99)).toBe(2);
    expect(rankService.calculateRankFromPercentile(40)).toBe(3);
    expect(rankService.calculateRankFromPercentile(59.99)).toBe(3);
    expect(rankService.calculateRankFromPercentile(60)).toBe(4);
    expect(rankService.calculateRankFromPercentile(79.99)).toBe(4);
    expect(rankService.calculateRankFromPercentile(80)).toBe(5);
    expect(rankService.calculateRankFromPercentile(100)).toBe(5);
  });

  /**
   * Property: Valid muscle groups should be retrievable
   */
  it('Property 7.13: Valid muscle groups are retrievable', () => {
    const groups = rankService.getValidMuscleGroups();

    expect(groups).toContain('CHEST');
    expect(groups).toContain('BACK');
    expect(groups).toContain('SHOULDERS');
    expect(groups).toContain('ARMS');
    expect(groups).toContain('LEGS');
    expect(groups).toContain('CORE');
    expect(groups.length).toBe(6);
  });
});
