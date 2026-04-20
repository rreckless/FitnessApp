import FriendService, {
  FriendInfo,
  FriendRequest,
  SearchResult,
  FriendServiceError,
} from '../services/FriendService';
import DatabaseManager from '@database/DatabaseManager';
import { mockAxiosGet, mockAxiosPost, mockAxiosPut, mockAxiosDelete } from './setup';

jest.mock('@database/DatabaseManager');
jest.mock('axios');
jest.mock('../services/SyncEngine');

describe('FriendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
    mockAxiosPost.mockClear();
    mockAxiosPut.mockClear();
    mockAxiosDelete.mockClear();
  });

  describe('searchUsers', () => {
    it('should search for users by username', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'user1',
          name: 'John Doe',
          level: 5,
          currentStreak: 10,
          isFriend: false,
          hasPendingRequest: false,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { results: mockResults } });

      const result = await FriendService.searchUsers('john', 20);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Doe');
    });

    it('should throw error on empty search query', async () => {
      await expect(FriendService.searchUsers('', 20)).rejects.toThrow(FriendServiceError);
    });

    it('should throw error on query too long', async () => {
      const longQuery = 'a'.repeat(101);
      await expect(FriendService.searchUsers(longQuery, 20)).rejects.toThrow(FriendServiceError);
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      const mockRequest: FriendRequest = {
        id: 'req1',
        senderId: 'user1',
        recipientId: 'user2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAxiosPost.mockResolvedValueOnce({ data: mockRequest });

      const result = await FriendService.sendFriendRequest('user2');

      expect(result.status).toBe('PENDING');
      expect(result.recipientId).toBe('user2');
    });

    it('should throw error on empty recipient ID', async () => {
      await expect(FriendService.sendFriendRequest('')).rejects.toThrow(FriendServiceError);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept friend request successfully', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });

      await FriendService.acceptFriendRequest('req1');

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should throw error on empty request ID', async () => {
      await expect(FriendService.acceptFriendRequest('')).rejects.toThrow(FriendServiceError);
    });
  });

  describe('declineFriendRequest', () => {
    it('should decline friend request successfully', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });

      await FriendService.declineFriendRequest('req1');

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should throw error on empty request ID', async () => {
      await expect(FriendService.declineFriendRequest('')).rejects.toThrow(FriendServiceError);
    });
  });

  describe('getFriendsList', () => {
    it('should fetch friends list', async () => {
      const mockFriends: FriendInfo[] = [
        {
          id: 'friend1',
          name: 'Friend One',
          level: 5,
          currentStreak: 10,
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { friends: mockFriends } });

      const result = await FriendService.getFriendsList();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Friend One');
    });
  });

  describe('removeFriend', () => {
    it('should remove friend successfully', async () => {
      mockAxiosDelete.mockResolvedValueOnce({ data: { success: true } });

      await FriendService.removeFriend('friend1');

      expect(mockAxiosDelete).toHaveBeenCalled();
    });

    it('should throw error on empty friend ID', async () => {
      await expect(FriendService.removeFriend('')).rejects.toThrow(FriendServiceError);
    });
  });

  describe('getPendingRequests', () => {
    it('should fetch pending friend requests', async () => {
      const mockRequests: FriendRequest[] = [
        {
          id: 'req1',
          senderId: 'user1',
          recipientId: 'user2',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAxiosGet.mockResolvedValueOnce({ data: { requests: mockRequests } });

      const result = await FriendService.getPendingRequests();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });
  });

  describe('friend request round trip', () => {
    it('should complete full friend request flow', async () => {
      const sendRequest: FriendRequest = {
        id: 'req1',
        senderId: 'user1',
        recipientId: 'user2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAxiosPost.mockResolvedValueOnce({ data: sendRequest });
      const sent = await FriendService.sendFriendRequest('user2');
      expect(sent.status).toBe('PENDING');

      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });
      await FriendService.acceptFriendRequest('req1');

      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });
  });
});
