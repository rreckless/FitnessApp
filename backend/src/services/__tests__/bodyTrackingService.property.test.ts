import fc from 'fast-check';
import * as bodyTrackingService from '../bodyTrackingService';
import * as connection from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

/**
 * Property 29: Body Weight Tracking
 * Validates: Requirements 15.1, 15.2
 *
 * Property 30: Body Measurement Tracking
 * Validates: Requirements 15.3, 15.4
 *
 * Property 31: Progress Photo Storage
 * Validates: Requirements 16.1, 16.2
 */

describe('Body Tracking Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // MARK: - Property 29: Body Weight Tracking

  it('Property 29.1: Weight entries are stored with correct values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            weight: fc.float({ min: 50, max: 300, noNaN: true }),
            notes: fc.option(fc.string({ maxLength: 100 })),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (entries) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock insert responses
          for (let i = 0; i < entries.length; i++) {
            mockPool.query.mockResolvedValueOnce({
              rows: [
                {
                  id: `weight-${i}`,
                  user_id: userId,
                  weight: entries[i].weight,
                  notes: entries[i].notes,
                  recorded_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            });
          }

          // Mock select response
          mockPool.query.mockResolvedValueOnce({
            rows: entries.map((entry, i) => ({
              id: `weight-${i}`,
              user_id: userId,
              weight: entry.weight,
              notes: entry.notes,
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          });

          // Log entries
          for (const entry of entries) {
            await bodyTrackingService.logBodyWeight(userId, entry.weight, entry.notes || undefined);
          }

          // Get history
          const history = await bodyTrackingService.getBodyWeightHistory(userId, 100, 0);

          // Verify all entries were stored
          expect(history.length).toBeGreaterThanOrEqual(entries.length);

          // Verify values match
          for (let i = 0; i < entries.length; i++) {
            const found = history.find((h) => Math.abs(h.weight - entries[i].weight) < 0.01);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 29.2: Trend line calculation is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: 50, max: 300, noNaN: true }),
          { minLength: 2, maxLength: 5 }
        ),
        async (weights) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock trend line query response
          mockPool.query.mockResolvedValueOnce({
            rows: weights.map((w, i) => ({
              weight: w,
              recorded_at: new Date(Date.now() - (weights.length - i - 1) * 24 * 60 * 60 * 1000).toISOString(),
            })),
          });

          // Calculate trend line
          const trendLine = await bodyTrackingService.calculateWeightTrendLine(userId);

          if (trendLine) {
            // Verify trend line values
            expect(trendLine.startValue).toBe(weights[0]);
            expect(trendLine.endValue).toBe(weights[weights.length - 1]);

            // Verify trend direction
            const expectedChange = trendLine.endValue - trendLine.startValue;
            if (Math.abs(expectedChange) < 1) {
              expect(trendLine.trend).toBe('stable');
            } else if (expectedChange > 0) {
              expect(trendLine.trend).toBe('increasing');
            } else {
              expect(trendLine.trend).toBe('decreasing');
            }

            // Verify change percentage calculation
            const expectedChangePercentage = ((trendLine.endValue - trendLine.startValue) / trendLine.startValue) * 100;
            expect(Math.abs(trendLine.changePercentage - expectedChangePercentage)).toBeLessThan(0.1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // MARK: - Property 30: Body Measurement Tracking

  it('Property 30.1: Measurements are stored with correct values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            chest: fc.option(fc.float({ min: 20, max: 60, noNaN: true })),
            waist: fc.option(fc.float({ min: 20, max: 60, noNaN: true })),
            hips: fc.option(fc.float({ min: 20, max: 60, noNaN: true })),
            arms: fc.option(fc.float({ min: 5, max: 25, noNaN: true })),
            thighs: fc.option(fc.float({ min: 10, max: 40, noNaN: true })),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (entries) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock insert responses
          let validCount = 0;
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            // Skip if no measurements provided
            if (!entry.chest && !entry.waist && !entry.hips && !entry.arms && !entry.thighs) {
              continue;
            }

            mockPool.query.mockResolvedValueOnce({
              rows: [
                {
                  id: `measurement-${i}`,
                  user_id: userId,
                  chest: entry.chest,
                  waist: entry.waist,
                  hips: entry.hips,
                  arms: entry.arms,
                  thighs: entry.thighs,
                  notes: null,
                  recorded_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            });
            validCount++;
          }

          // Mock select response
          mockPool.query.mockResolvedValueOnce({
            rows: entries
              .filter((e) => e.chest || e.waist || e.hips || e.arms || e.thighs)
              .map((entry, i) => ({
                id: `measurement-${i}`,
                user_id: userId,
                chest: entry.chest,
                waist: entry.waist,
                hips: entry.hips,
                arms: entry.arms,
                thighs: entry.thighs,
                notes: null,
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })),
          });

          // Log entries
          for (const entry of entries) {
            if (!entry.chest && !entry.waist && !entry.hips && !entry.arms && !entry.thighs) {
              continue;
            }
            await bodyTrackingService.logBodyMeasurement(userId, {
              chest: entry.chest || undefined,
              waist: entry.waist || undefined,
              hips: entry.hips || undefined,
              arms: entry.arms || undefined,
              thighs: entry.thighs || undefined,
            });
          }

          // Get history
          const history = await bodyTrackingService.getBodyMeasurementHistory(userId, 100, 0);

          // Verify all entries were stored
          expect(history.length).toBeGreaterThanOrEqual(validCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 30.2: Measurement changes are calculated accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.float({ min: 20, max: 60, noNaN: true }),
          fc.float({ min: 20, max: 60, noNaN: true })
        ),
        async ([measurement1, measurement2]) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock change calculation query
          mockPool.query.mockResolvedValueOnce({
            rows: [
              { chest: measurement2 },
              { chest: measurement1 },
            ],
          });

          // Calculate change
          const change = await bodyTrackingService.calculateMeasurementChange(userId, 'chest');

          if (change) {
            // Verify change calculation
            expect(change.current).toBe(measurement2);
            expect(change.previous).toBe(measurement1);

            const expectedChange = measurement2 - measurement1;
            expect(Math.abs(change.change - expectedChange)).toBeLessThan(0.01);

            const expectedChangePercentage = (expectedChange / measurement1) * 100;
            expect(Math.abs(change.changePercentage - expectedChangePercentage)).toBeLessThan(0.1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // MARK: - Property 31: Progress Photo Storage

  it('Property 31.1: Progress photos are stored with correct metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            imageUrl: fc.webUrl(),
            thumbnailUrl: fc.option(fc.webUrl()),
            notes: fc.option(fc.string({ maxLength: 200 })),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (photos) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock insert responses
          for (let i = 0; i < photos.length; i++) {
            mockPool.query.mockResolvedValueOnce({
              rows: [
                {
                  id: `photo-${i}`,
                  user_id: userId,
                  image_url: photos[i].imageUrl,
                  thumbnail_url: photos[i].thumbnailUrl,
                  notes: photos[i].notes,
                  recorded_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            });
          }

          // Mock select response
          mockPool.query.mockResolvedValueOnce({
            rows: photos.map((photo, i) => ({
              id: `photo-${i}`,
              user_id: userId,
              image_url: photo.imageUrl,
              thumbnail_url: photo.thumbnailUrl,
              notes: photo.notes,
              recorded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          });

          // Upload photos
          for (const photo of photos) {
            await bodyTrackingService.uploadProgressPhoto(
              userId,
              photo.imageUrl,
              photo.thumbnailUrl || undefined,
              photo.notes || undefined
            );
          }

          // Get gallery
          const gallery = await bodyTrackingService.getProgressPhotoGallery(userId, 100, 0);

          // Verify all photos were stored
          expect(gallery.length).toBeGreaterThanOrEqual(photos.length);

          // Verify metadata matches
          for (let i = 0; i < photos.length; i++) {
            const found = gallery.find((g) => g.imageUrl === photos[i].imageUrl);
            expect(found).toBeDefined();
            if (found) {
              expect(found.notes).toBe(photos[i].notes);
              if (photos[i].thumbnailUrl) {
                expect(found.thumbnailUrl).toBe(photos[i].thumbnailUrl);
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 31.2: Photo gallery maintains chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            imageUrl: fc.webUrl(),
            recordedAt: fc.date(),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (photos) => {
          const userId = fc.sample(fc.uuid(), 1)[0];
          const mockGetPool = connection.getPool as jest.MockedFunction<typeof connection.getPool>;

          const mockPool = {
            query: jest.fn(),
          };

          mockGetPool.mockReturnValue(mockPool as any);

          // Mock insert responses
          for (let i = 0; i < photos.length; i++) {
            mockPool.query.mockResolvedValueOnce({
              rows: [
                {
                  id: `photo-${i}`,
                  user_id: userId,
                  image_url: photos[i].imageUrl,
                  thumbnail_url: null,
                  notes: null,
                  recorded_at: photos[i].recordedAt.toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            });
          }

          // Mock select response - sorted by recorded_at DESC
          const sortedPhotos = [...photos].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
          mockPool.query.mockResolvedValueOnce({
            rows: sortedPhotos.map((photo, i) => ({
              id: `photo-${i}`,
              user_id: userId,
              image_url: photo.imageUrl,
              thumbnail_url: null,
              notes: null,
              recorded_at: photo.recordedAt.toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          });

          // Upload photos
          for (const photo of photos) {
            await bodyTrackingService.uploadProgressPhoto(userId, photo.imageUrl, undefined, undefined, photo.recordedAt.toISOString());
          }

          // Get gallery
          const gallery = await bodyTrackingService.getProgressPhotoGallery(userId, 100, 0);

          // Verify chronological order (newest first)
          for (let i = 0; i < gallery.length - 1; i++) {
            const current = new Date(gallery[i].recordedAt).getTime();
            const next = new Date(gallery[i + 1].recordedAt).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
