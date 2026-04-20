import express, { Request, Response } from 'express';
import * as friendService from '../services/friendService';
import { logger } from '../logging/logger';
import { verifyToken } from './authRoutes';

const router = express.Router();

/**
 * POST /friends/request
 * Send a friend request
 * 
 * Body:
 * - recipientId: ID of user to send request to
 * 
 * **Validates: Requirements 10.2, 10.5**
 */
router.post('/request', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).userId;
    const { recipientId } = req.body;

    if (!recipientId) {
      res.status(400).json({ error: 'recipientId is required' });
      return;
    }

    if (senderId === recipientId) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }

    const friendRequest = await friendService.sendFriendRequest(senderId, recipientId);

    res.status(201).json(friendRequest);
  } catch (error) {
    logger.error('Error sending friend request', error as Error);
    const message = (error as Error).message;
    if (message.includes('already')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  }
});

/**
 * POST /friends/request/:id/accept
 * Accept a friend request
 * 
 * Path parameters:
 * - id: ID of friend request to accept
 * 
 * **Validates: Requirements 10.3, 10.5**
 */
router.post('/request/:id/accept', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const friendship = await friendService.acceptFriendRequest(id);

    res.json(friendship);
  } catch (error) {
    logger.error('Error accepting friend request', error as Error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

/**
 * POST /friends/request/:id/decline
 * Decline a friend request
 * 
 * Path parameters:
 * - id: ID of friend request to decline
 * 
 * **Validates: Requirements 10.3**
 */
router.post('/request/:id/decline', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await friendService.declineFriendRequest(id);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error declining friend request', error as Error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

/**
 * DELETE /friends/:id
 * Remove a friend
 * 
 * Path parameters:
 * - id: ID of friend to remove
 * 
 * **Validates: Requirements 10.4**
 */
router.delete('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    await friendService.removeFriend(userId, id);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing friend', error as Error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

/**
 * GET /friends
 * Get list of friends for the authenticated user
 * 
 * **Validates: Requirements 10.1, 10.5**
 */
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    const friends = await friendService.getFriends(userId);

    res.json({ friends });
  } catch (error) {
    logger.error('Error fetching friends', error as Error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

/**
 * GET /friends/requests/pending
 * Get pending friend requests for the authenticated user
 * 
 * **Validates: Requirements 10.2**
 */
router.get('/requests/pending', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    const requests = await friendService.getPendingFriendRequests(userId);

    res.json({ requests });
  } catch (error) {
    logger.error('Error fetching pending friend requests', error as Error);
    res.status(500).json({ error: 'Failed to fetch pending friend requests' });
  }
});

/**
 * GET /friends/search
 * Search for users by username or email
 * 
 * Query parameters:
 * - q: search query
 * - limit: max results (default: 20)
 * 
 * **Validates: Requirements 10.1**
 */
router.get('/search', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      res.status(400).json({ error: 'q parameter is required' });
      return;
    }

    const results = await friendService.searchUsers(
      q as string,
      Math.min(parseInt(limit as string) || 20, 100)
    );

    res.json({ results });
  } catch (error) {
    logger.error('Error searching users', error as Error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
