import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { chatCreateLimiter, messageLimiter, chatLimiter } from '../middlewares/rateLimitMiddleware.js';
import {
  createOrGetChatSession,
  sendMessage,
  getChatMessages,
  getUserChatSessions,
  getAllChatSessions,
  getActiveChatSession,
  assignChat,
  resolveChat,
  reopenChat,
  markMessagesAsRead
} from '../controllers/chatController.js';

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Create or get chat session - rate limited
router.post('/session', chatCreateLimiter, createOrGetChatSession);

// Send message - rate limited
router.post('/message', messageLimiter, sendMessage);

// Get chat messages - rate limited
router.get('/:chatId/messages', chatLimiter, getChatMessages);

// Get user's chat sessions - rate limited
router.get('/sessions/user', chatLimiter, getUserChatSessions);

// Get active chat session for current user - rate limited
router.get('/active', chatLimiter, getActiveChatSession);

// Get all chat sessions (admin only) - rate limited
router.get('/sessions', chatLimiter, getAllChatSessions);

// Assign chat to admin - rate limited
router.put('/:chatId/assign', chatLimiter, assignChat);

// Resolve chat session - rate limited
router.put('/:chatId/resolve', chatLimiter, resolveChat);

// Reopen chat session - rate limited
router.put('/:chatId/reopen', chatLimiter, reopenChat);

// Mark messages as read - rate limited
router.put('/:chatId/read', chatLimiter, markMessagesAsRead);

export default router;
