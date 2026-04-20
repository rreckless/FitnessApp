import fc from 'fast-check';
import * as achievementService from '../achievementService';

/**
 * Property-Based Tests for Achievement Service
 * 
 * **Property 10: Achievement Unlock Correctness**
 * **Validates: Requirements 8.3, 8.4**
 */
describe('Achievement Service - Property-Based Tests', () => {
  // MARK: - Property 10.1: XP Reward Correctness

  /**
   * Property: XP reward for COMMON should be 25
   */
  it('Property 10.1: COMMON rarity has 25 XP reward', () => {
    const reward = achievementService.getXPRewardForRarity('COMMON');
    expect(reward).toBe(25);
  });

  /**
   * Property: XP reward for RARE should be 50
   */
  it('Property 10.2: RARE rarity has 50 XP reward', () => {
    const reward = achievementService.getXPRewardForRarity('RARE');
    expect(reward).toBe(50);
  });

  /**
   * Property: XP reward for EPIC should be 100
   */
  it('Property 10.3: EPIC rarity has 100 XP reward', () => {
    const reward = achievementService.getXPRewardForRarity('EPIC');
    expect(reward).toBe(100);
  });

  /**
   * Property: XP reward for LEGENDARY should be 250
   */
  it('Property 10.4: LEGENDARY rarity has 250 XP reward', () => {
    const reward = achievementService.getXPRewardForRarity('LEGENDARY');
    expect(reward).toBe(250);
  });

  /**
   * Property: XP rewards should be positive
   */
  it('Property 10.5: All XP rewards are positive', () => {
    const rarities = achievementService.getValidRarities();

    for (const rarity of rarities) {
      const reward = achievementService.getXPRewardForRarity(rarity);
      expect(reward).toBeGreaterThan(0);
    }
  });

  /**
   * Property: XP rewards should increase with rarity
   */
  it('Property 10.6: XP rewards increase with rarity', () => {
    const commonReward = achievementService.getXPRewardForRarity('COMMON');
    const rareReward = achievementService.getXPRewardForRarity('RARE');
    const epicReward = achievementService.getXPRewardForRarity('EPIC');
    const legendaryReward = achievementService.getXPRewardForRarity('LEGENDARY');

    expect(rareReward).toBeGreaterThan(commonReward);
    expect(epicReward).toBeGreaterThan(rareReward);
    expect(legendaryReward).toBeGreaterThan(epicReward);
  });

  // MARK: - Property 11: Achievement Metadata

  /**
   * Property: Valid rarities should be retrievable
   */
  it('Property 11.1: Valid rarities are retrievable', () => {
    const rarities = achievementService.getValidRarities();

    expect(rarities).toContain('COMMON');
    expect(rarities).toContain('RARE');
    expect(rarities).toContain('EPIC');
    expect(rarities).toContain('LEGENDARY');
    expect(rarities.length).toBe(4);
  });

  /**
   * Property: Valid categories should be retrievable
   */
  it('Property 11.2: Valid categories are retrievable', () => {
    const categories = achievementService.getValidCategories();

    expect(categories).toContain('STRENGTH');
    expect(categories).toContain('CONSISTENCY');
    expect(categories).toContain('SOCIAL');
    expect(categories).toContain('EXPLORATION');
    expect(categories.length).toBe(4);
  });

  /**
   * Property: Valid achievement data should pass validation
   */
  it('Property 11.3: Valid achievement data passes validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('COMMON'),
          fc.constant('RARE'),
          fc.constant('EPIC'),
          fc.constant('LEGENDARY')
        ),
        fc.oneof(
          fc.constant('STRENGTH'),
          fc.constant('CONSISTENCY'),
          fc.constant('SOCIAL'),
          fc.constant('EXPLORATION')
        ),
        (rarity, category) => {
          const xpReward = achievementService.getXPRewardForRarity(rarity);

          expect(() => {
            achievementService.validateAchievementData(
              'Test Achievement',
              rarity,
              category,
              xpReward
            );
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid rarity should throw
   */
  it('Property 11.4: Invalid rarity throws error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (invalidRarity) => {
          const validRarities = achievementService.getValidRarities();

          // Skip if it happens to be a valid rarity
          if (validRarities.includes(invalidRarity)) {
            return true;
          }

          expect(() => {
            achievementService.validateAchievementData(
              'Test Achievement',
              invalidRarity,
              'STRENGTH',
              25
            );
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid category should throw
   */
  it('Property 11.5: Invalid category throws error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (invalidCategory) => {
          const validCategories = achievementService.getValidCategories();

          // Skip if it happens to be a valid category
          if (validCategories.includes(invalidCategory)) {
            return true;
          }

          expect(() => {
            achievementService.validateAchievementData(
              'Test Achievement',
              'COMMON',
              invalidCategory,
              25
            );
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mismatched XP reward should throw
   */
  it('Property 11.6: Mismatched XP reward throws error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('COMMON'),
          fc.constant('RARE'),
          fc.constant('EPIC'),
          fc.constant('LEGENDARY')
        ),
        fc.integer({ min: 0, max: 1000 }),
        (rarity, xpReward) => {
          const expectedReward = achievementService.getXPRewardForRarity(rarity);

          // Skip if XP reward matches
          if (xpReward === expectedReward) {
            return true;
          }

          expect(() => {
            achievementService.validateAchievementData(
              'Test Achievement',
              rarity,
              'STRENGTH',
              xpReward
            );
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty achievement name should throw
   */
  it('Property 11.7: Empty achievement name throws error', () => {
    expect(() => {
      achievementService.validateAchievementData('', 'COMMON', 'STRENGTH', 25);
    }).toThrow();
  });

  /**
   * Property: Negative XP reward should throw
   */
  it('Property 11.8: Negative XP reward throws error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        (negativeXP) => {
          expect(() => {
            achievementService.validateAchievementData(
              'Test Achievement',
              'COMMON',
              'STRENGTH',
              negativeXP
            );
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rarity tiers should be consistent
   */
  it('Property 11.9: Rarity tiers are consistent', () => {
    const rarities = achievementService.getValidRarities();
    const expectedRarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

    expect(rarities).toEqual(expectedRarities);
  });

  /**
   * Property: Categories should be consistent
   */
  it('Property 11.10: Categories are consistent', () => {
    const categories = achievementService.getValidCategories();
    const expectedCategories = ['STRENGTH', 'CONSISTENCY', 'SOCIAL', 'EXPLORATION'];

    expect(categories).toEqual(expectedCategories);
  });
});
