import request from 'supertest';
import express from 'express';
import friendRoutes from '../friendRoutes';
import * as friendService from '../../services/friendService';

// Mock the friend service
jest.mock('../../services/friendService');
jest.mock('../../logging/logger');

// Mock the auth routes verifyToken
jest.mock('../authRoutes', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/friends', friendRoutes);

describe('Friend Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /friends/request', () => {
    it('should send a friend request', async () => {
      const mockRequest = {
        id: 'request-1',
        senderId: 'test-user-id',
        recipientId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (friendService.sendFriendRequest as jest.Mock).mockResolvedValue(mockRequest);

      const response = await request(app)
        .post('/friends/request')
        .send({ recipientId: 'user-2' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('request-1');
      expect(friendService.sendFriendRequest).toHaveBeenCalledWith('test-user-id', 'user-2');
    });

    it('should reject request without recipientId', async () => {
      const response = await request(app)
        .post('/friends/request')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('recipientId is required');
    });

    it('should reject self-friend request', async () => {
      const response = await request(app)
        .post('/friends/request')
        .send({ recipientId: 'test-user-id' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot send friend request to yourself');
    });

    it('should handle duplicate request error', async () => {
      (friendService.sendFriendRequest as jest.Mock).mockRejectedValue(
        new Error('Friend request already exists')
      );

      const response = await request(app)
        .post('/friends/request')
        .send({ recipientId: 'user-2' });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /friends/request/:id/accept', () => {
    it('should accept a friend request', async () => {
      const mockFriendship = {
        id: 'friendship-1',
        userId1: 'user-1',
        userId2: 'test-user-id',
        createdAt: new Date(),
      };

      (friendService.acceptFriendRequest as jest.Mock).mockResolvedValue(mockFriendship);

      const response = await request(app)
        .post('/friends/request/request-1/accept');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('friendship-1');
      expect(friendService.acceptFriendRequest).toHaveBeenCalledWith('request-1');
    });

    it('should handle service errors', async () => {
      (friendService.acceptFriendRequest as jest.Mock).mockRejectedValue(
        new Error('Request not found')
      );

      const response = await request(app)
        .post('/friends/request/invalid-id/accept');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to accept friend request');
    });
  });

  describe('POST /friends/request/:id/decline', () => {
    it('should decline a friend request', async () => {
      (friendService.declineFriendRequest as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/friends/request/request-1/decline');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(friendService.declineFriendRequest).toHaveBeenCalledWith('request-1');
    });

    it('should handle service errors', async () => {
      (friendService.declineFriendRequest as jest.Mock).mockRejectedValue(
        new Error('Request not found')
      );

      const response = await request(app)
        .post('/friends/request/invalid-id/decline');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to decline friend request');
    });
  });

  describe('DELETE /friends/:id', () => {
    it('should remove a friend', async () => {
      (friendService.removeFriend as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/friends/user-2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(friendService.removeFriend).toHaveBeenCalledWith('test-user-id', 'user-2');
    });

    it('should handle service errors', async () => {
      (friendService.removeFriend as jest.Mock).mockRejectedValue(
        new Error('Friendship not found')
      );

      const response = await request(app)
        .delete('/friends/invalid-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to remove friend');
    });
  });

  describe('GET /friends', () => {
    it('should return list of friends', async () => {
      const mockFriends = [
        {
          id: 'user-2',
          name: 'Friend 1',
          level: 10,
          currentStreak: 5,
          profilePictureUrl: 'url1',
        },
        {
          id: 'user-3',
          name: 'Friend 2',
          level: 8,
          currentStreak: 3,
          profilePictureUrl: 'url2',
        },
      ];

      (friendService.getFriends as jest.Mock).mockResolvedValue(mockFriends);

      const response = await request(app).get('/friends');

      expect(response.status).toBe(200);
      expect(response.body.friends).toEqual(mockFriends);
      expect(friendService.getFriends).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle service errors', async () => {
      (friendService.getFriends as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/friends');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch friends');
    });
  });

  describe('GET /friends/requests/pending', () => {
    it('should return pending friend requests', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          senderId: 'user-2',
          recipientId: 'test-user-id',
          status: 'PENDING',
          createdAt: new Date('2026-04-20T18:16:09.113Z'),
          updatedAt: new Date('2026-04-20T18:16:09.113Z'),
        },
      ];

      (friendService.getPendingFriendRequests as jest.Mock).mockResolvedValue(mockRequests);

      const response = await request(app).get('/friends/requests/pending');

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].id).toBe('request-1');
      expect(response.body.requests[0].senderId).toBe('user-2');
      expect(friendService.getPendingFriendRequests).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle service errors', async () => {
      (friendService.getPendingFriendRequests as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/friends/requests/pending');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch pending friend requests');
    });
  });

  describe('GET /friends/search', () => {
    it('should search for users', async () => {
      const mockResults = [
        {
          id: 'user-2',
          name: 'John Doe',
          level: 10,
          currentStreak: 5,
          profilePictureUrl: 'url1',
        },
      ];

      (friendService.searchUsers as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/friends/search')
        .query({ q: 'john' });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual(mockResults);
      expect(friendService.searchUsers).toHaveBeenCalledWith('john', 20);
    });

    it('should reject search without query', async () => {
      const response = await request(app).get('/friends/search');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('q parameter is required');
    });

    it('should handle custom limit', async () => {
      (friendService.searchUsers as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/friends/search')
        .query({ q: 'test', limit: 50 });

      expect(response.status).toBe(200);
      expect(friendService.searchUsers).toHaveBeenCalledWith('test', 50);
    });

    it('should cap limit at 100', async () => {
      (friendService.searchUsers as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/friends/search')
        .query({ q: 'test', limit: 500 });

      expect(response.status).toBe(200);
      expect(friendService.searchUsers).toHaveBeenCalledWith('test', 100);
    });

    it('should handle service errors', async () => {
      (friendService.searchUsers as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/friends/search')
        .query({ q: 'test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search users');
    });
  });
});
