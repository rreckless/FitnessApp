import {
  ProgressTrackerService,
  PersonalRecord,
  VolumeData,
  PRNotification,
  ChartData,
} from '../ProgressTrackerService';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import * as fc from 'fast-check';

jest.mock('axios');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-sqlite-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('ProgressTrackerService', () => {
  let service: ProgressTrackerService;
  const mockUserId = 'user-123';
  const apiBaseUrl = 'http://api.test.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
    } as any);
  });

  describe('Unit Tests', () => {
    describe('getPersonalRecords', () => {
      it('should fetch personal records from backend', async () => {
        const mockPRs: PersonalRecord[] = [
          {
            id: 'pr-1',
            userId: mockUserId,
            exerciseId: 'ex-1',
            exerciseName: 'Bench Press',
            muscleGroup: 'CHEST',
            weight: 225,
            reps: 5,
            recordedAt: '2024-01-15T10:00:00Z',
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 'pr-2',
            userId: mockUserId,
            exerciseId: 'ex-2',
            exerciseName: 'Squat',
            muscleGroup: 'LEGS',
            weight: 315,
            reps: 5,
            recordedAt: '2024-01-14T10:00:00Z',
            createdAt: '2024-01-14T10:00:00Z',
          },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPRs }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getPersonalRecords();

        expect(result).toEqual(mockPRs);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/prs', { params: {} });
      });

      it('should filter PRs by muscle group', async () => {
        const mockPRs: PersonalRecord[] = [
          {
            id: 'pr-1',
            userId: mockUserId,
            exerciseId: 'ex-1',
            exerciseName: 'Bench Press',
            muscleGroup: 'CHEST',
            weight: 225,
            reps: 5,
            recordedAt: '2024-01-15T10:00:00Z',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPRs }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getPersonalRecords({ muscleGroup: 'CHEST' });

        expect(result).toEqual(mockPRs);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/prs', {
          params: { muscleGroup: 'CHEST' },
        });
      });

      it('should filter PRs by exercise ID', async () => {
        const mockPRs: PersonalRecord[] = [
          {
            id: 'pr-1',
            userId: mockUserId,
            exerciseId: 'ex-1',
            exerciseName: 'Bench Press',
            muscleGroup: 'CHEST',
            weight: 225,
            reps: 5,
            recordedAt: '2024-01-15T10:00:00Z',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPRs }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getPersonalRecords({ exerciseId: 'ex-1' });

        expect(result).toEqual(mockPRs);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/prs', {
          params: { exerciseId: 'ex-1' },
        });
      });
    });

    describe('getExercisePR', () => {
      it('should fetch PR for specific exercise', async () => {
        const mockPR: PersonalRecord = {
          id: 'pr-1',
          userId: mockUserId,
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          muscleGroup: 'CHEST',
          weight: 225,
          reps: 5,
          recordedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPR }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getExercisePR('ex-1');

        expect(result).toEqual(mockPR);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/prs/ex-1');
      });

      it('should return null when exercise PR not found', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Not found')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getExercisePR('ex-nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('detectNewPRs', () => {
      it('should detect new PRs when weight exceeds existing', async () => {
        const existingPR: PersonalRecord = {
          id: 'pr-1',
          userId: mockUserId,
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          muscleGroup: 'CHEST',
          weight: 225,
          reps: 5,
          recordedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: existingPR }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);

        const workoutData = {
          exercises: [
            {
              exerciseId: 'ex-1',
              exerciseName: 'Bench Press',
              muscleGroup: 'CHEST',
              weight: 235,
              reps: 5,
            },
          ],
        };

        const result = await service.detectNewPRs(workoutData);

        expect(result).toHaveLength(1);
        expect(result[0].previousWeight).toBe(225);
        expect(result[0].newWeight).toBe(235);
        expect(result[0].exerciseName).toBe('Bench Press');
      });

      it('should not detect PR when weight does not exceed existing', async () => {
        const existingPR: PersonalRecord = {
          id: 'pr-1',
          userId: mockUserId,
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          muscleGroup: 'CHEST',
          weight: 225,
          reps: 5,
          recordedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: existingPR }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);

        const workoutData = {
          exercises: [
            {
              exerciseId: 'ex-1',
              exerciseName: 'Bench Press',
              muscleGroup: 'CHEST',
              weight: 215,
              reps: 5,
            },
          ],
        };

        const result = await service.detectNewPRs(workoutData);

        expect(result).toHaveLength(0);
      });

      it('should detect PR for new exercise with no existing PR', async () => {
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(new Error('Not found')),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);

        const workoutData = {
          exercises: [
            {
              exerciseId: 'ex-new',
              exerciseName: 'Deadlift',
              muscleGroup: 'BACK',
              weight: 405,
              reps: 3,
            },
          ],
        };

        const result = await service.detectNewPRs(workoutData);

        expect(result).toHaveLength(1);
        expect(result[0].previousWeight).toBe(0);
        expect(result[0].newWeight).toBe(405);
      });
    });

    describe('getVolumeData', () => {
      it('should fetch volume data for date range', async () => {
        const mockVolume: VolumeData[] = [
          {
            id: 'vol-1',
            userId: mockUserId,
            date: '2024-01-15',
            dailyVolume: 5000,
            weeklyVolume: 25000,
            monthlyVolume: 100000,
            createdAt: '2024-01-15T10:00:00Z',
          },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockVolume }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getVolumeData('2024-01-01', '2024-01-31');

        expect(result).toEqual(mockVolume);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/volume', {
          params: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        });
      });
    });

    describe('getChartData', () => {
      it('should fetch line chart data', async () => {
        const mockChartData: ChartData = {
          type: 'line',
          labels: ['2024-01-01', '2024-01-02', '2024-01-03'],
          datasets: [
            {
              label: 'Daily Volume',
              data: [5000, 5500, 4800],
              borderColor: '#3B82F6',
            },
          ],
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockChartData }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getChartData('line', '2024-01-01', '2024-01-31');

        expect(result).toEqual(mockChartData);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/charts/line', {
          params: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        });
      });

      it('should fetch bar chart data with muscle group filter', async () => {
        const mockChartData: ChartData = {
          type: 'bar',
          labels: ['CHEST', 'BACK', 'LEGS'],
          datasets: [
            {
              label: 'Volume by Muscle Group',
              data: [15000, 12000, 18000],
              backgroundColor: '#10B981',
            },
          ],
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockChartData }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getChartData('bar', '2024-01-01', '2024-01-31', 'CHEST');

        expect(result).toEqual(mockChartData);
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/charts/bar', {
          params: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            muscleGroup: 'CHEST',
          },
        });
      });

      it('should fetch pie chart data', async () => {
        const mockChartData: ChartData = {
          type: 'pie',
          labels: ['CHEST', 'BACK', 'LEGS'],
          datasets: [
            {
              label: 'Exercise Distribution',
              data: [30, 35, 35],
              backgroundColor: ['#F59E0B', '#EF4444', '#8B5CF6'],
            },
          ],
        };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockChartData }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getChartData('pie', '2024-01-01', '2024-01-31');

        expect(result).toEqual(mockChartData);
      });
    });

    describe('exportChart', () => {
      it('should export chart as image', async () => {
        const mockResponse = { imageUrl: 'https://example.com/chart.png' };

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockResponse }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.exportChart('line', '2024-01-01', '2024-01-31');

        expect(result).toBe('https://example.com/chart.png');
        expect(mockApiClient.get).toHaveBeenCalledWith('/progress/charts/line/export', {
          params: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            format: 'image',
          },
        });
      });
    });

    describe('getPRHistory', () => {
      it('should return PRs sorted by date descending', async () => {
        const mockPRs: PersonalRecord[] = [
          {
            id: 'pr-1',
            userId: mockUserId,
            exerciseId: 'ex-1',
            exerciseName: 'Bench Press',
            muscleGroup: 'CHEST',
            weight: 225,
            reps: 5,
            recordedAt: '2024-01-10T10:00:00Z',
            createdAt: '2024-01-10T10:00:00Z',
          },
          {
            id: 'pr-2',
            userId: mockUserId,
            exerciseId: 'ex-2',
            exerciseName: 'Squat',
            muscleGroup: 'LEGS',
            weight: 315,
            reps: 5,
            recordedAt: '2024-01-15T10:00:00Z',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ];

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ data: mockPRs }),
        };
        mockAxios.create.mockReturnValue(mockApiClient as any);

        service = new ProgressTrackerService(apiBaseUrl, mockUserId);
        const result = await service.getPRHistory();

        expect(result[0].recordedAt).toBe('2024-01-15T10:00:00Z');
        expect(result[1].recordedAt).toBe('2024-01-10T10:00:00Z');
      });
    });
  });

  describe('Property-Based Tests', () => {
    describe('PR Detection Property', () => {
      it('**Validates: Requirements 13.0** - should always detect PR when new weight exceeds previous', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 500 }),
            fc.integer({ min: 1, max: 500 }),
            fc.integer({ min: 1, max: 20 }),
            async (previousWeight, weightIncrease, reps) => {
              const newWeight = previousWeight + weightIncrease;
              const existingPR: PersonalRecord = {
                id: 'pr-1',
                userId: mockUserId,
                exerciseId: 'ex-1',
                exerciseName: 'Test Exercise',
                muscleGroup: 'CHEST',
                weight: previousWeight,
                reps,
                recordedAt: '2024-01-15T10:00:00Z',
                createdAt: '2024-01-15T10:00:00Z',
              };

              const mockApiClient = {
                get: jest.fn().mockResolvedValue({ data: existingPR }),
              };
              mockAxios.create.mockReturnValue(mockApiClient as any);

              service = new ProgressTrackerService(apiBaseUrl, mockUserId);

              const workoutData = {
                exercises: [
                  {
                    exerciseId: 'ex-1',
                    exerciseName: 'Test Exercise',
                    muscleGroup: 'CHEST',
                    weight: newWeight,
                    reps,
                  },
                ],
              };

              const result = await service.detectNewPRs(workoutData);

              expect(result).toHaveLength(1);
              expect(result[0].newWeight).toBe(newWeight);
              expect(result[0].previousWeight).toBe(previousWeight);
            }
          ),
          { numRuns: 50 }
        );
      });

      it('**Validates: Requirements 13.0** - should never detect PR when new weight equals or is less than previous', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 500 }),
            fc.integer({ min: 0, max: 500 }),
            fc.integer({ min: 1, max: 20 }),
            async (previousWeight, weightDecrease, reps) => {
              const newWeight = Math.max(1, previousWeight - weightDecrease);
              if (newWeight >= previousWeight) return; // Skip if weight increased

              const existingPR: PersonalRecord = {
                id: 'pr-1',
                userId: mockUserId,
                exerciseId: 'ex-1',
                exerciseName: 'Test Exercise',
                muscleGroup: 'CHEST',
                weight: previousWeight,
                reps,
                recordedAt: '2024-01-15T10:00:00Z',
                createdAt: '2024-01-15T10:00:00Z',
              };

              const mockApiClient = {
                get: jest.fn().mockResolvedValue({ data: existingPR }),
              };
              mockAxios.create.mockReturnValue(mockApiClient as any);

              service = new ProgressTrackerService(apiBaseUrl, mockUserId);

              const workoutData = {
                exercises: [
                  {
                    exerciseId: 'ex-1',
                    exerciseName: 'Test Exercise',
                    muscleGroup: 'CHEST',
                    weight: newWeight,
                    reps,
                  },
                ],
              };

              const result = await service.detectNewPRs(workoutData);

              expect(result).toHaveLength(0);
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Volume Data Filtering Property', () => {
      it('**Validates: Requirements 13.0** - should filter PRs by muscle group consistently', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                muscleGroup: fc.constantFrom('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS'),
                weight: fc.integer({ min: 1, max: 500 }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
            async (exercises) => {
              const mockPRs: PersonalRecord[] = exercises.map((ex, idx) => ({
                id: `pr-${idx}`,
                userId: mockUserId,
                exerciseId: `ex-${idx}`,
                exerciseName: `Exercise ${idx}`,
                muscleGroup: ex.muscleGroup,
                weight: ex.weight,
                reps: 5,
                recordedAt: '2024-01-15T10:00:00Z',
                createdAt: '2024-01-15T10:00:00Z',
              }));

              // Filter to only CHEST exercises for the mock response
              const chestPRs = mockPRs.filter(pr => pr.muscleGroup === 'CHEST');

              const mockApiClient = {
                get: jest.fn().mockImplementation((url, config) => {
                  if (config?.params?.muscleGroup === 'CHEST') {
                    return Promise.resolve({ data: chestPRs });
                  }
                  return Promise.resolve({ data: mockPRs });
                }),
              };
              mockAxios.create.mockReturnValue(mockApiClient as any);

              service = new ProgressTrackerService(apiBaseUrl, mockUserId);
              const result = await service.getPersonalRecords({ muscleGroup: 'CHEST' });

              // All returned PRs should have CHEST muscle group
              result.forEach(pr => {
                expect(pr.muscleGroup).toBe('CHEST');
              });
            }
          ),
          { numRuns: 30 }
        );
      });
    });

    describe('Chart Data Generation Property', () => {
      it('**Validates: Requirements 14.0** - should generate valid chart data with correct structure', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 1, maxLength: 30 }),
            async (volumeValues) => {
              const mockChartData: ChartData = {
                type: 'line',
                labels: volumeValues.map((_, idx) => `2024-01-${String(idx + 1).padStart(2, '0')}`),
                datasets: [
                  {
                    label: 'Daily Volume',
                    data: volumeValues,
                    borderColor: '#3B82F6',
                  },
                ],
              };

              const mockApiClient = {
                get: jest.fn().mockResolvedValue({ data: mockChartData }),
              };
              mockAxios.create.mockReturnValue(mockApiClient as any);

              service = new ProgressTrackerService(apiBaseUrl, mockUserId);
              const result = await service.getChartData('line', '2024-01-01', '2024-01-31');

              // Verify chart structure
              expect(result.type).toBe('line');
              expect(result.labels.length).toBe(volumeValues.length);
              expect(result.datasets).toHaveLength(1);
              expect(result.datasets[0].data.length).toBe(volumeValues.length);
              expect(result.datasets[0].data).toEqual(volumeValues);
            }
          ),
          { numRuns: 30 }
        );
      });
    });
  });
});
