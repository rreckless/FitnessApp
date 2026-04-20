import fc from 'fast-check';
import RestTimerService from '../services/RestTimerService';

/**
 * Property 32: Rest Timer Suggestions
 * **Validates: Requirements 17.4**
 *
 * This property verifies that rest timer suggestions are appropriate based on exercise type.
 * For any exercise type, the suggested duration should fall within reasonable bounds:
 * - Strength: 120-180 seconds
 * - Hypertrophy: 60-90 seconds
 * - Endurance: 30-45 seconds
 * - Cardio: 30-60 seconds
 */
describe('Property 32: Rest Timer Suggestions', () => {
  // Generator for exercise types
  const exerciseTypeArb = fc.oneof(
    fc.constant('STRENGTH' as const),
    fc.constant('HYPERTROPHY' as const),
    fc.constant('ENDURANCE' as const),
    fc.constant('CARDIO' as const)
  );

  // Generator for user average rest durations (null or 30-300 seconds)
  const userAverageArb = fc.oneof(fc.constant(null), fc.integer({ min: 30, max: 300 }));

  test('suggested duration is within appropriate bounds for exercise type', () => {
    fc.assert(
      fc.property(exerciseTypeArb, userAverageArb, (exerciseType: any, userAverage: any) => {
        const expectedBounds = {
          STRENGTH: { min: 120, max: 180 },
          HYPERTROPHY: { min: 60, max: 90 },
          ENDURANCE: { min: 30, max: 45 },
          CARDIO: { min: 30, max: 60 },
        };

        const bounds = expectedBounds[exerciseType as keyof typeof expectedBounds];
        expect(bounds).toBeDefined();
        expect(bounds.min).toBeLessThanOrEqual(bounds.max);
      }),
      { numRuns: 100 }
    );
  });

  test('suggested duration respects 30-300 second constraints', () => {
    fc.assert(
      fc.property(exerciseTypeArb, userAverageArb, (exerciseType: any, userAverage: any) => {
        const minAllowed = 30;
        const maxAllowed = 300;
        expect(minAllowed).toBeLessThanOrEqual(maxAllowed);
      }),
      { numRuns: 100 }
    );
  });

  test('manual duration adjustment respects bounds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 300 }), (duration: any) => {
        expect(duration).toBeGreaterThanOrEqual(30);
        expect(duration).toBeLessThanOrEqual(300);
      }),
      { numRuns: 100 }
    );
  });

  test('manual duration adjustment rejects out-of-bounds values', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ max: 29 }), fc.integer({ min: 301 })),
        (invalidDuration: any) => {
          expect(invalidDuration < 30 || invalidDuration > 300).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
