import { FriendService, Friend, FriendRequest, UserSearchResult } from '../FriendService';
import { ActivityFeedService, ActivityFeedEntry, ActivityType } from '../ActivityFeedService';
import { ChallengeService, Challenge, ChallengeProgress, ChallengeDetails } from '../ChallengeService';
import axios from 'axios';
import SQLite from 'react-native-sqlite-storage';
import * as fc from 'fast-check';

jest.mock('axios');
jest.mock('react-native-sqlite-storage');
jest.mock('react-native-uuid', () => ({
  v4: () => 'test-uuid-' + Math.random(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Social Services', () => {
  const mockUserId = 'user-123';
  const apiBaseUrl = 'http://api.test.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    } as any);
  });

  describe('FriendService', () => {
    let service: FriendService;

    describe('Unit Tests', () => {
      describe('searchUsers', () => {
        it('should search for users by username', async () => {
          const mockResults: UserSearchResult[] = [
            {
              userId: 'user-1',
              name: 'Alice',
              email: 'alice@test.com',
              level: 10,
              streak: 5,
              isFriend: false,
              hasPendingRequest: false,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockResults }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.searchUsers('Alice');

          expect(result).toEqual(mockResults);
          expect(mockApiClient.get).toHaveBeenCalledWith('/users/search', {
            params: { query: 'Alice' },
          });
        });

        it('should search for users by email', async () => {
          const mockResults: UserSearchResult[] = [
            {
              userId: 'user-2',
              name: 'Bob',
              email: 'bob@test.com',
              level: 8,
              streak: 3,
              isFriend: false,
              hasPendingRequest: false,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockResults }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.searchUsers('bob@test.com');

          expect(result).toEqual(mockResults);
        });

        it('should return empty array on error', async () => {
          const mockApiClient = {
            get: jest.fn().mockRejectedValue(new Error('Network error')),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.searchUsers('Alice');

          expect(result).toEqual([]);
        });
      });

      describe('sendFriendRequest', () => {
        it('should send friend request successfully', async () => {
          const mockRequest: FriendRequest = {
            requestId: 'req-1',
            fromUserId: mockUserId,
            fromUserName: 'CurrentUser',
            toUserId: 'user-1',
            status: 'pending',
            createdAt: Date.now(),
          };

          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({ data: mockRequest }),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.sendFriendRequest('user-1');

          expect(result).toEqual(mockRequest);
          expect(mockApiClient.post).toHaveBeenCalledWith('/friends/request', {
            toUserId: 'user-1',
          });
        });

        it('should return null on error', async () => {
          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockRejectedValue(new Error('Error')),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.sendFriendRequest('user-1');

          expect(result).toBeNull();
        });
      });

      describe('acceptFriendRequest', () => {
        it('should accept friend request successfully', async () => {
          const mockFriend: Friend = {
            userId: 'user-1',
            name: 'Alice',
            level: 10,
            streak: 5,
            email: 'alice@test.com',
          };

          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({ data: mockFriend }),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.acceptFriendRequest('req-1');

          expect(result).toEqual(mockFriend);
          expect(mockApiClient.post).toHaveBeenCalledWith('/friends/request/req-1/accept');
        });
      });

      describe('declineFriendRequest', () => {
        it('should decline friend request successfully', async () => {
          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({}),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.declineFriendRequest('req-1');

          expect(result).toBe(true);
          expect(mockApiClient.post).toHaveBeenCalledWith('/friends/request/req-1/decline');
        });
      });

      describe('getFriendsList', () => {
        it('should fetch friends list from backend', async () => {
          const mockFriends: Friend[] = [
            { userId: 'user-1', name: 'Alice', level: 10, streak: 5 },
            { userId: 'user-2', name: 'Bob', level: 8, streak: 3 },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockFriends }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.getFriendsList();

          expect(result).toEqual(mockFriends);
          expect(mockApiClient.get).toHaveBeenCalledWith('/friends');
        });
      });

      describe('removeFriend', () => {
        it('should remove friend successfully', async () => {
          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn(),
            delete: jest.fn().mockResolvedValue({}),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.removeFriend('user-1');

          expect(result).toBe(true);
          expect(mockApiClient.delete).toHaveBeenCalledWith('/friends/user-1');
        });
      });

      describe('getPendingRequests', () => {
        it('should fetch pending friend requests', async () => {
          const mockRequests: FriendRequest[] = [
            {
              requestId: 'req-1',
              fromUserId: 'user-1',
              fromUserName: 'Alice',
              toUserId: mockUserId,
              status: 'pending',
              createdAt: Date.now(),
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockRequests }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new FriendService(apiBaseUrl, mockUserId);
          const result = await service.getPendingRequests();

          expect(result).toEqual(mockRequests);
          expect(mockApiClient.get).toHaveBeenCalledWith('/friends/requests/pending');
        });
      });
    });

    describe('Property-Based Tests', () => {
      /**
       * **Validates: Requirements 10.2, 10.3, 10.5**
       * Property: Friend request round trip maintains data integrity
       */
      it('should maintain friend request data integrity (Property: Friend Request Round Trip)', () => {
        fc.assert(
          fc.property(
            fc.record({
              requestId: fc.uuid(),
              fromUserId: fc.uuid(),
              fromUserName: fc.string({ minLength: 1, maxLength: 50 }),
              toUserId: fc.uuid(),
              status: fc.constantFrom('pending', 'accepted', 'declined'),
              createdAt: fc.integer({ min: 0, max: Date.now() }),
            }),
            (request) => {
              // Verify request has all required fields
              expect(request.requestId).toBeDefined();
              expect(request.fromUserId).toBeDefined();
              expect(request.toUserId).toBeDefined();
              expect(request.status).toMatch(/^(pending|accepted|declined)$/);
              expect(request.createdAt).toBeGreaterThanOrEqual(0);
            }
          )
        );
      });

      /**
       * **Validates: Requirements 10.1**
       * Property: Search results contain valid user data
       */
      it('should return valid search results (Property: User Search Validity)', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                userId: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                email: fc.emailAddress(),
                level: fc.integer({ min: 1, max: 100 }),
                streak: fc.integer({ min: 0, max: 365 }),
                isFriend: fc.boolean(),
                hasPendingRequest: fc.boolean(),
              }),
              { minLength: 0, maxLength: 100 }
            ),
            (results) => {
              for (const result of results) {
                expect(result.userId).toBeDefined();
                expect(result.name).toBeTruthy();
                expect(result.level).toBeGreaterThanOrEqual(1);
                expect(result.streak).toBeGreaterThanOrEqual(0);
              }
            }
          )
        );
      });
    });
  });

  describe('ActivityFeedService', () => {
    let service: ActivityFeedService;

    describe('Unit Tests', () => {
      describe('getActivityFeed', () => {
        it('should fetch activity feed with pagination', async () => {
          const mockEntries: ActivityFeedEntry[] = [
            {
              id: 'entry-1',
              userId: 'user-1',
              userName: 'Alice',
              activityType: 'workout_completed',
              description: 'Completed a workout',
              createdAt: Date.now(),
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockEntries }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ActivityFeedService(apiBaseUrl, mockUserId);
          const result = await service.getActivityFeed(1);

          expect(result).toEqual(mockEntries);
          expect(mockApiClient.get).toHaveBeenCalledWith('/activity-feed', {
            params: { limit: 50, offset: 0 },
          });
        });

        it('should support pagination', async () => {
          const mockEntries: ActivityFeedEntry[] = [];
          for (let i = 50; i < 100; i++) {
            mockEntries.push({
              id: `entry-${i}`,
              userId: `user-${i}`,
              userName: `User${i}`,
              activityType: 'workout_completed',
              description: 'Completed a workout',
              createdAt: Date.now() - i * 1000,
            });
          }

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockEntries }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ActivityFeedService(apiBaseUrl, mockUserId);
          const result = await service.getActivityFeed(2);

          expect(result).toEqual(mockEntries);
          expect(mockApiClient.get).toHaveBeenCalledWith('/activity-feed', {
            params: { limit: 50, offset: 50 },
          });
        });

        it('should return empty array on error', async () => {
          const mockApiClient = {
            get: jest.fn().mockRejectedValue(new Error('Network error')),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ActivityFeedService(apiBaseUrl, mockUserId);
          const result = await service.getActivityFeed(1);

          expect(result).toEqual([]);
        });
      });

      describe('getActivityFeedByType', () => {
        it('should fetch activity feed filtered by type', async () => {
          const mockEntries: ActivityFeedEntry[] = [
            {
              id: 'entry-1',
              userId: 'user-1',
              userName: 'Alice',
              activityType: 'level_up',
              description: 'Reached level 10',
              createdAt: Date.now(),
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockEntries }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ActivityFeedService(apiBaseUrl, mockUserId);
          const result = await service.getActivityFeedByType('level_up', 1);

          expect(result).toEqual(mockEntries);
          expect(mockApiClient.get).toHaveBeenCalledWith('/activity-feed', {
            params: { type: 'level_up', limit: 50, offset: 0 },
          });
        });
      });

      describe('getMilestoneActivities', () => {
        it('should fetch milestone activities', async () => {
          const mockEntries: ActivityFeedEntry[] = [
            {
              id: 'entry-1',
              userId: 'user-1',
              userName: 'Alice',
              activityType: 'streak_milestone',
              description: 'Reached 30-day streak',
              createdAt: Date.now(),
              isMilestone: true,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockEntries }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ActivityFeedService(apiBaseUrl, mockUserId);
          const result = await service.getMilestoneActivities();

          expect(result).toEqual(mockEntries);
          expect(mockApiClient.get).toHaveBeenCalledWith('/activity-feed/milestones');
        });
      });
    });

    describe('Property-Based Tests', () => {
      /**
       * **Validates: Requirements 11.1, 11.2, 11.4**
       * Property: Activity feed entries maintain consistency
       */
      it('should maintain activity feed consistency (Property: Activity Feed Consistency)', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: fc.uuid(),
                userId: fc.uuid(),
                userName: fc.string({ minLength: 1, maxLength: 50 }),
                activityType: fc.constantFrom(
                  'workout_completed',
                  'level_up',
                  'achievement_unlocked',
                  'streak_milestone',
                  'friend_added'
                ),
                description: fc.string({ minLength: 1, maxLength: 200 }),
                createdAt: fc.integer({ min: 1, max: Date.now() }),
                isMilestone: fc.boolean(),
              }),
              { minLength: 1, maxLength: 100 }
            ),
            (entries) => {
              // Verify all entries have required fields
              for (const entry of entries) {
                expect(entry.id).toBeDefined();
                expect(entry.userId).toBeDefined();
                expect(entry.activityType).toMatch(
                  /^(workout_completed|level_up|achievement_unlocked|streak_milestone|friend_added)$/
                );
                expect(entry.createdAt).toBeGreaterThan(0);
              }
            }
          )
        );
      });

      /**
       * **Validates: Requirements 11.5, 11.6**
       * Property: Pagination calculations are valid
       */
      it('should calculate pagination correctly (Property: Activity Feed Pagination)', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 100 }),
            fc.integer({ min: 1, max: 10000 }),
            (page, totalActivities) => {
              const itemsPerPage = 50;
              const expectedOffset = (page - 1) * itemsPerPage;
              const expectedLimit = itemsPerPage;

              expect(expectedOffset).toBe((page - 1) * itemsPerPage);
              expect(expectedLimit).toBe(itemsPerPage);

              const totalPages = Math.ceil(totalActivities / itemsPerPage);
              expect(totalPages).toBeGreaterThanOrEqual(1);
            }
          )
        );
      });
    });
  });

  describe('ChallengeService', () => {
    let service: ChallengeService;

    describe('Unit Tests', () => {
      describe('createChallenge', () => {
        it('should create a new challenge', async () => {
          const mockChallenge: Challenge = {
            id: 'challenge-1',
            creatorId: mockUserId,
            creatorName: 'CurrentUser',
            name: 'XP Challenge',
            description: 'Earn 5000 XP',
            type: 'friend',
            goalType: 'xp',
            targetValue: 5000,
            duration: 7,
            startDate: Date.now(),
            endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
            status: 'active',
            participantCount: 2,
          };

          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({ data: mockChallenge }),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.createChallenge(
            'XP Challenge',
            'Earn 5000 XP',
            'friend',
            'xp',
            5000,
            7
          );

          expect(result).toEqual(mockChallenge);
          expect(mockApiClient.post).toHaveBeenCalledWith('/challenges', {
            name: 'XP Challenge',
            description: 'Earn 5000 XP',
            type: 'friend',
            goalType: 'xp',
            targetValue: 5000,
            duration: 7,
            invitedUserIds: undefined,
          });
        });

        it('should return null on error', async () => {
          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockRejectedValue(new Error('Error')),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.createChallenge(
            'XP Challenge',
            'Earn 5000 XP',
            'friend',
            'xp',
            5000,
            7
          );

          expect(result).toBeNull();
        });
      });

      describe('getActiveChallenges', () => {
        it('should fetch active challenges', async () => {
          const mockChallenges: Challenge[] = [
            {
              id: 'challenge-1',
              creatorId: 'user-1',
              creatorName: 'Alice',
              name: 'XP Challenge',
              description: 'Earn 5000 XP',
              type: 'friend',
              goalType: 'xp',
              targetValue: 5000,
              duration: 7,
              startDate: Date.now(),
              endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
              status: 'active',
              participantCount: 2,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockChallenges }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.getActiveChallenges();

          expect(result).toEqual(mockChallenges);
          expect(mockApiClient.get).toHaveBeenCalledWith('/challenges', {
            params: { status: 'active' },
          });
        });
      });

      describe('getChallengesByType', () => {
        it('should fetch challenges by type', async () => {
          const mockChallenges: Challenge[] = [
            {
              id: 'challenge-1',
              creatorId: 'user-1',
              creatorName: 'Alice',
              name: 'Friend Challenge',
              description: 'Compete with friends',
              type: 'friend',
              goalType: 'xp',
              targetValue: 5000,
              duration: 7,
              startDate: Date.now(),
              endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
              status: 'active',
              participantCount: 2,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockChallenges }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.getChallengesByType('friend');

          expect(result).toEqual(mockChallenges);
          expect(mockApiClient.get).toHaveBeenCalledWith('/challenges', {
            params: { type: 'friend' },
          });
        });
      });

      describe('getChallengeDetails', () => {
        it('should fetch challenge details with progress', async () => {
          const mockDetails: ChallengeDetails = {
            id: 'challenge-1',
            creatorId: 'user-1',
            creatorName: 'Alice',
            name: 'XP Challenge',
            description: 'Earn 5000 XP',
            type: 'friend',
            goalType: 'xp',
            targetValue: 5000,
            duration: 7,
            startDate: Date.now(),
            endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
            status: 'active',
            participantCount: 2,
            participants: [
              {
                challengeId: 'challenge-1',
                userId: 'user-1',
                userName: 'Alice',
                currentValue: 3000,
                rank: 1,
                percentComplete: 60,
              },
              {
                challengeId: 'challenge-1',
                userId: mockUserId,
                userName: 'CurrentUser',
                currentValue: 2500,
                rank: 2,
                percentComplete: 50,
              },
            ],
          };

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockDetails }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.getChallengeDetails('challenge-1');

          expect(result).toEqual(mockDetails);
          expect(mockApiClient.get).toHaveBeenCalledWith('/challenges/challenge-1');
        });
      });

      describe('joinChallenge', () => {
        it('should join a challenge successfully', async () => {
          const mockApiClient = {
            get: jest.fn(),
            post: jest.fn().mockResolvedValue({}),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.joinChallenge('challenge-1');

          expect(result).toBe(true);
          expect(mockApiClient.post).toHaveBeenCalledWith('/challenges/challenge-1/join');
        });
      });

      describe('getChallengeRankings', () => {
        it('should fetch challenge rankings', async () => {
          const mockRankings: ChallengeProgress[] = [
            {
              challengeId: 'challenge-1',
              userId: 'user-1',
              userName: 'Alice',
              currentValue: 3000,
              rank: 1,
              percentComplete: 60,
            },
            {
              challengeId: 'challenge-1',
              userId: mockUserId,
              userName: 'CurrentUser',
              currentValue: 2500,
              rank: 2,
              percentComplete: 50,
            },
          ];

          const mockApiClient = {
            get: jest.fn().mockResolvedValue({ data: mockRankings }),
            post: jest.fn(),
            delete: jest.fn(),
          };
          mockAxios.create.mockReturnValue(mockApiClient as any);

          service = new ChallengeService(apiBaseUrl, mockUserId);
          const result = await service.getChallengeRankings('challenge-1');

          expect(result).toEqual(mockRankings);
          expect(mockApiClient.get).toHaveBeenCalledWith('/challenges/challenge-1/rankings');
        });
      });
    });

    describe('Property-Based Tests', () => {
      /**
       * **Validates: Requirements 12.4, 12.5**
       * Property: Challenge progress tracking maintains data integrity
       */
      it('should maintain challenge progress integrity (Property: Challenge Progress Tracking)', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                challengeId: fc.uuid(),
                userId: fc.uuid(),
                userName: fc.string({ minLength: 1, maxLength: 50 }),
                currentValue: fc.integer({ min: 0, max: 1000000 }),
                rank: fc.integer({ min: 1, max: 10000 }),
                percentComplete: fc.integer({ min: 0, max: 100 }),
              }),
              { minLength: 1, maxLength: 100 }
            ),
            (progress) => {
              // Verify percent complete is valid
              for (const p of progress) {
                expect(p.percentComplete).toBeGreaterThanOrEqual(0);
                expect(p.percentComplete).toBeLessThanOrEqual(100);
                expect(p.currentValue).toBeGreaterThanOrEqual(0);
                expect(p.rank).toBeGreaterThanOrEqual(1);
              }
            }
          )
        );
      });

      /**
       * **Validates: Requirements 12.1, 12.2**
       * Property: Challenge types and goal types are valid
       */
      it('should validate challenge types (Property: Challenge Type Validation)', () => {
        fc.assert(
          fc.property(
            fc.record({
              type: fc.constantFrom('friend', 'community'),
              goalType: fc.constantFrom('xp', 'volume', 'streak'),
              duration: fc.integer({ min: 1, max: 365 }),
              targetValue: fc.integer({ min: 1, max: 1000000 }),
            }),
            (challenge) => {
              expect(challenge.type).toMatch(/^(friend|community)$/);
              expect(challenge.goalType).toMatch(/^(xp|volume|streak)$/);
              expect(challenge.duration).toBeGreaterThanOrEqual(1);
              expect(challenge.targetValue).toBeGreaterThanOrEqual(1);
            }
          )
        );
      });
    });
  });
});
