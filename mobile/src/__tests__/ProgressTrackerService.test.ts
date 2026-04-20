import ProgressTrackerService from '../services/ProgressTrackerService';
import { mockAxiosGet } from './setup';

jest.mock('axios');
jest.mock('../services/AuthenticationService');

describe('ProgressTrackerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
  });

  it('should fetch personal records', async () => {
    const mockPRs = [
      {
        id: 'pr1',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        weight: 225,
        reps: 5,
        recordedAt: '2024-01-15T10:00:00Z',
      },
    ];

    mockAxiosGet.mockResolvedValueOnce({ data: { prs: mockPRs } });

    const result = await ProgressTrackerService.getPersonalRecords();

    expect(result).toHaveLength(1);
    expect(result[0].exerciseName).toBe('Bench Press');
  });
});
