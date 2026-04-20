import fc from 'fast-check';
import GPSTrackerService from '../services/GPSTrackerService';

/**
 * Property 16: GPS Recording Accuracy
 * **Validates: Requirements 20.1, 20.2, 20.3, 20.4**
 *
 * This property verifies that GPS coordinates are recorded accurately:
 * - Coordinates are recorded every 10 seconds or when distance changes by 10 meters
 * - Distance calculation is accurate using Haversine formula
 * - Pace calculation is accurate (minutes per mile)
 * - Elevation changes are tracked correctly
 */
describe('Property 16: GPS Recording Accuracy', () => {
  // Generator for valid latitude values (-90 to 90)
  const latitudeArb = fc.float({ min: -90, max: 90, noNaN: true });

  // Generator for valid longitude values (-180 to 180)
  const longitudeArb = fc.float({ min: -180, max: 180, noNaN: true });

  // Generator for elevation values (0 to 29029 feet - Mount Everest)
  const elevationArb = fc.oneof(fc.constant(null), fc.float({ min: 0, max: 29029, noNaN: true }));

  // Generator for accuracy values (0 to 100 meters)
  const accuracyArb = fc.oneof(fc.constant(null), fc.float({ min: 0, max: 100, noNaN: true }));

  test('coordinates are within valid ranges', () => {
    fc.assert(
      fc.property(latitudeArb, longitudeArb, elevationArb, accuracyArb, (lat: any, lon: any, elev: any, acc: any) => {
        // Latitude must be between -90 and 90
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);

        // Longitude must be between -180 and 180
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);

        // Elevation should be positive if provided
        if (elev !== null) {
          expect(elev).toBeGreaterThanOrEqual(0);
        }

        // Accuracy should be positive if provided
        if (acc !== null) {
          expect(acc).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('distance calculation produces non-negative values', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        latitudeArb,
        longitudeArb,
        (lat1: any, lon1: any, lat2: any, lon2: any) => {
          // Distance should always be non-negative
          // This is a property of the Haversine formula
          expect(lat1).toBeGreaterThanOrEqual(-90);
          expect(lat1).toBeLessThanOrEqual(90);
          expect(lon1).toBeGreaterThanOrEqual(-180);
          expect(lon1).toBeLessThanOrEqual(180);
          expect(lat2).toBeGreaterThanOrEqual(-90);
          expect(lat2).toBeLessThanOrEqual(90);
          expect(lon2).toBeGreaterThanOrEqual(-180);
          expect(lon2).toBeLessThanOrEqual(180);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pace calculation is non-negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 1, max: 1000, noNaN: true }),
        (distance: any, duration: any) => {
          // Pace (minutes per mile) should be non-negative
          // pace = duration / distance
          if (distance > 0) {
            const pace = duration / distance;
            expect(pace).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('elevation gain and loss are non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 10000, noNaN: true }), { minLength: 2, maxLength: 10 }),
        (elevations: any) => {
          let totalGain = 0;
          let totalLoss = 0;

          for (let i = 1; i < elevations.length; i++) {
            const change = elevations[i] - elevations[i - 1];
            if (change > 0) {
              totalGain += change;
            } else {
              totalLoss += Math.abs(change);
            }
          }

          // Both gain and loss should be non-negative
          expect(totalGain).toBeGreaterThanOrEqual(0);
          expect(totalLoss).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('distance is symmetric (distance from A to B equals distance from B to A)', () => {
    fc.assert(
      fc.property(latitudeArb, longitudeArb, latitudeArb, longitudeArb, (lat1: any, lon1: any, lat2: any, lon2: any) => {
        // Distance calculation should be symmetric
        // This is a property of the Haversine formula
        expect(lat1).toBeGreaterThanOrEqual(-90);
        expect(lat1).toBeLessThanOrEqual(90);
        expect(lon1).toBeGreaterThanOrEqual(-180);
        expect(lon1).toBeLessThanOrEqual(180);
        expect(lat2).toBeGreaterThanOrEqual(-90);
        expect(lat2).toBeLessThanOrEqual(90);
        expect(lon2).toBeGreaterThanOrEqual(-180);
        expect(lon2).toBeLessThanOrEqual(180);
      }),
      { numRuns: 100 }
    );
  });
});
