import mongoose from 'mongoose';
import { ChatMessage, ChatSession } from '../models/Chat.js';
import User from '../models/User.js';

// Helper function to find best admin to assign chat
const findBestAdminToAssign = async () => {
  try {
    // Get all active admins and super_admins
    const admins = await User.find({
      role: { $in: ['admin', 'super_admin'] },
      // You could add additional filters like online status, working hours, etc.
    }).select('_id firstName lastName');

    if (admins.length === 0) return null;

    // Find admin with least active chats using aggregation for better performance
    const adminStats = await ChatSession.aggregate([
      {
        $match: {
          assignedTo: { $in: admins.map(admin => admin._id) },
          status: { $in: ['open', 'assigned', 'reopened'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          chatCount: { $sum: 1 }
        }
      }
    ]);

    // Create a map of admin ID to chat count
    const chatCountMap = new Map();
    adminStats.forEach(stat => {
      chatCountMap.set(stat._id.toString(), stat.chatCount);
    });

    // Find admin with least chats
    let bestAdmin = null;
    let minChats = Infinity;

    for (const admin of admins) {
      const chatCount = chatCountMap.get(admin._id.toString()) || 0;
      if (chatCount < minChats) {
        minChats = chatCount;
        bestAdmin = admin;
      }
    }

    return bestAdmin;
  } catch (error) {
    console.error('Find best admin error:', error);
    return null;
  }
};

// Create or get existing chat session
export const createOrGetChatSession = async (req, res) => {
  try {
    const { userId, isSupportChat } = req.body;
    const currentUser = req.user;

    // Input validation
    if (!currentUser || !currentUser._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Ensure isSupportChat is boolean
    const supportChat = Boolean(isSupportChat);

    // For support chats, handle existing active chats differently
    if (supportChat && !['admin', 'super_admin'].includes(currentUser.role)) {
      const existingActiveChat = await ChatSession.findOne({
        'participants.user': currentUser._id,
        category: 'support',
        status: { $in: ['open', 'assigned', 'reopened'] }
      });

      if (existingActiveChat) {
        console.log('[DEBUG] Returning existing active support chat instead of creating new one:', existingActiveChat.chatId);
        return res.json({
          chatSession: existingActiveChat,
          chatId: existingActiveChat.chatId
        });
      }
    }

    let targetUser = null;
    let chatId = '';

    if (supportChat) {
      // User wants to start a support chat - find or create chat with admin
      const assignedAdmin = await findBestAdminToAssign();
      if (!assignedAdmin) {
        return res.status(503).json({ message: 'No support agents available at the moment. Please try again later.' });
      }

      targetUser = assignedAdmin;
      // Generate chat ID for support chat
      const participants = [currentUser._id.toString(), assignedAdmin._id.toString()].sort();
      chatId = `support_${participants.join('_')}`;
    } else {
      // Regular chat between specific users
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required for regular chats' });
      }

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }

      targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent users from chatting with themselves
      if (currentUser._id.toString() === userId) {
        return res.status(400).json({ message: 'Cannot start chat with yourself' });
      }

      // Generate chat ID based on participants (sorted to ensure consistency)
      const participants = [currentUser._id.toString(), userId].sort();
      chatId = `chat_${participants.join('_')}`;
    }

    // For support chats, always create a new chat session to avoid conflicts
    if (supportChat) {
      console.log('[DEBUG] Creating new support chat session for user:', currentUser._id);

      // Find best admin to assign
      const assignedAdmin = await findBestAdminToAssign();
      if (!assignedAdmin) {
        return res.status(503).json({ message: 'No support agents available at the moment. Please try again later.' });
      }

      targetUser = assignedAdmin;

      // Generate unique chat ID with timestamp to ensure uniqueness
      const timestamp = Date.now();
      const participants = [currentUser._id.toString(), assignedAdmin._id.toString()].sort();
      chatId = `support_${participants.join('_')}_${timestamp}`;

      console.log('[DEBUG] Generated unique chatId:', chatId);

      // Create new chat session
      const participantsArray = [
        {
          user: currentUser._id,
          role: currentUser.role || 'customer'
        },
        {
          user: targetUser._id,
          role: targetUser.role || 'admin'
        }
      ];

      const newChatSession = new ChatSession({
        chatId,
        participants: participantsArray,
        status: 'open', // Always start as 'open' for new chats
        assignedTo: targetUser._id,
        priority: 'medium',
        category: 'support'
      });

      await newChatSession.save();

      // Create system message for new chat
      await ChatMessage.create({
        chatId,
        sender: targetUser._id,
        senderRole: 'system',
        message: `Support chat started with ${targetUser.firstName} ${targetUser.lastName}.`,
        messageType: 'system'
      });

      // Emit real-time event for new chat
      const io = req.app.get('io');
      if (io) {
        io.emit('new_chat', {
          chatSession: newChatSession,
          participants: participantsArray.map(p => p.user)
        });
      }

      console.log('[DEBUG] New support chat created successfully:', chatId);
      return res.json({
        chatSession: newChatSession,
        chatId: newChatSession.chatId
      });
    }

    // Try to find existing chat session by chatId (for non-support chats)
    let chatSession = await ChatSession.findOne({ chatId });
    console.log('[DEBUG] Existing chat session lookup:', { chatId, found: !!chatSession, status: chatSession?.status });

    if (!chatSession) {
      // Determine assigned admin based on user roles
      let assignedTo = null;
      let priority = 'low';
      let status = 'open'; // New chats start as 'open'

      if (supportChat) {
        // Support chat - assign to best available admin immediately and set as assigned
        assignedTo = targetUser._id;
        priority = 'medium';
        status = 'assigned'; // Auto-assigned support chats start as assigned
        console.log('[DEBUG] Creating support chat with status:', status, 'assignedTo:', assignedTo);
      } else if (['customer', 'salesperson', 'team_head'].includes(currentUser.role)) {
        // User is requesting support - leave as open for admin assignment
        priority = 'medium';
        status = 'open';
      } else if (['admin', 'super_admin'].includes(currentUser.role)) {
        // Admin is starting chat - assign to themselves
        assignedTo = currentUser._id;
        status = 'assigned';
      }

      // Ensure roles exist with proper defaults
      const currentUserRole = currentUser.role || 'customer';
      const targetUserRole = targetUser.role || (supportChat ? 'admin' : 'customer');

      // For support chats, ensure targetUser has role information
      if (supportChat && !targetUser.role) {
        targetUser.role = 'admin';
      }

      const participants = [
        {
          user: currentUser._id,
          role: currentUserRole
        },
        {
          user: targetUser._id,
          role: targetUserRole
        }
      ];

      chatSession = new ChatSession({
        chatId,
        participants,
        status,
        assignedTo,
        priority,
        category: supportChat ? 'support' : 'general'
      });

      await chatSession.save();

      // Create system message for new chat
      const systemMessage = supportChat
        ? `Support chat started with ${targetUser.firstName} ${targetUser.lastName}.`
        : `Chat started between ${currentUser.firstName} ${currentUser.lastName} and ${targetUser.firstName} ${targetUser.lastName}.`;

      await ChatMessage.create({
        chatId,
        sender: assignedTo || currentUser._id,
        senderRole: supportChat ? 'system' : currentUserRole,
        message: systemMessage,
        messageType: 'system'
      });

      // Emit real-time event for new chat
      const io = req.app.get('io');
      if (io) {
        io.emit('new_chat', {
          chatSession,
          participants: participants.map(p => p.user)
        });
      }
    }

    res.json({
      chatSession,
      chatId: chatSession.chatId
    });
  } catch (error) {
    console.error('Create chat session error:', error);
    res.status(500).json({ message: 'Failed to create chat session' });
  }
};

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, message, messageType = 'text' } = req.body;
    const sender = req.user;

    console.log('[DEBUG] sendMessage called with:', { chatId, message, messageType, senderId: sender._id, senderRole: sender.role });

    // Input validation
    if (!chatId || !message) {
      console.log('[DEBUG] sendMessage validation failed: missing chatId or message');
      return res.status(400).json({ message: 'Chat ID and message are required' });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message must be a non-empty string' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ message: 'Message too long (maximum 2000 characters)' });
    }

    if (!['text', 'system', 'bot'].includes(messageType)) {
      return res.status(400).json({ message: 'Invalid message type' });
    }

    // Verify chat session exists and user is participant
    const chatSession = await ChatSession.findOne({ chatId });
    console.log('[DEBUG] Chat session lookup result:', { found: !!chatSession, status: chatSession?.status, participants: chatSession?.participants?.length });
    if (!chatSession) {
      console.log('[DEBUG] Chat session not found for chatId:', chatId);
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Check if chat is resolved or closed (only resolved/closed chats are read-only)
    if (chatSession.status === 'resolved' || chatSession.status === 'closed') {
      console.log('[DEBUG] Attempted to send message to resolved/closed chat:', chatId, 'status:', chatSession.status);
      return res.status(400).json({ message: 'Cannot send messages to resolved chat. Please start a new chat.' });
    }

    const isParticipant = chatSession.participants.some(p =>
      p.user.toString() === sender._id.toString()
    );

    const isAssignedAdmin = chatSession.assignedTo &&
      chatSession.assignedTo.toString() === sender._id.toString();

    const isSuperAdmin = sender.role === 'super_admin';

    console.log('[DEBUG] Authorization check:', { isParticipant, isAssignedAdmin, isSuperAdmin, senderRole: sender.role });

    // Allow if: participant OR assigned admin OR admin/super_admin role
    if (!isParticipant && !isAssignedAdmin && !isSuperAdmin && !['admin', 'super_admin'].includes(sender.role)) {
      console.log('[DEBUG] Authorization failed for user:', sender._id);
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }

    // Create message
    const chatMessage = new ChatMessage({
      chatId,
      sender: sender._id,
      senderRole: sender.role,
      message: message.trim(),
      messageType
    });

    console.log('[DEBUG] Creating chat message:', { chatId, senderId: sender._id, messageLength: message.length });
    await chatMessage.save();
    console.log('[DEBUG] Chat message saved successfully, ID:', chatMessage._id);

    // Update chat session
    chatSession.lastMessage = new Date();
    chatSession.messageCount += 1;

    // Mark as unread for other participants
    const otherParticipants = chatSession.participants.filter(p =>
      p.user.toString() !== sender._id.toString()
    );

    chatSession.unreadCount += otherParticipants.length;
    await chatSession.save();

    // Populate sender info for response
    await chatMessage.populate('sender', 'firstName lastName email');

    // Emit real-time message to other participants
    const io = req.app.get('io');
    if (io) {
      console.log('[DEBUG] Emitting new-message event to room:', chatId);
      io.to(chatId).emit('new-message', {
        message: chatMessage,
        chatSession: {
          chatId: chatSession.chatId,
          lastMessage: chatSession.lastMessage,
          unreadCount: chatSession.unreadCount
        }
      });
    } else {
      console.log('[DEBUG] Socket.io not available, skipping real-time emit');
    }

    console.log('[DEBUG] sendMessage completed successfully');
    res.json({
      message: chatMessage,
      chatSession
    });
  } catch (error) {
    console.error('[DEBUG] Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Get chat messages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUser = req.user;

    // Input validation
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    // Verify user is participant in chat OR is admin/super_admin
    const chatSession = await ChatSession.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    const isParticipant = chatSession.participants.some(p =>
      p.user.toString() === currentUser._id.toString()
    );

    const isAdmin = ['admin', 'super_admin'].includes(currentUser.role);

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this chat' });
    }

    // Get messages with pagination
    const skip = (pageNum - 1) * limitNum;
    const messages = await ChatMessage.find({ chatId })
      .populate('sender', 'firstName lastName email')
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ChatMessage.countDocuments({ chatId });

    res.json({
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Failed to get chat messages' });
  }
};

// Get user's chat sessions
export const getUserChatSessions = async (req, res) => {
  try {
    const currentUser = req.user;
    const { status = 'active' } = req.query;

    const chatSessions = await ChatSession.find({
      'participants.user': currentUser._id,
      status: status
    })
    .populate('participants.user', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ lastMessage: -1 });

    res.json({ chatSessions });
  } catch (error) {
    console.error('Get user chat sessions error:', error);
    res.status(500).json({ message: 'Failed to get chat sessions' });
  }
};

// Get user's active chat session (for frontend restoration)
export const getActiveChatSession = async (req, res) => {
  try {
    const currentUser = req.user;

    // Find the most recent active support chat
    const activeChat = await ChatSession.findOne({
      'participants.user': currentUser._id,
      category: 'support',
      status: { $in: ['open', 'assigned', 'reopened'] }
    })
    .populate('participants.user', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ lastMessage: -1 });

    if (activeChat) {
      console.log('[DEBUG] Found active chat for user restoration:', activeChat.chatId);
      res.json({
        chatSession: activeChat,
        hasActiveChat: true
      });
    } else {
      console.log('[DEBUG] No active chat found for user:', currentUser._id);
      res.json({
        hasActiveChat: false
      });
    }
  } catch (error) {
    console.error('Get active chat session error:', error);
    res.status(500).json({ message: 'Failed to get active chat session' });
  }
};

// Get all chat sessions (for admins)
export const getAllChatSessions = async (req, res) => {
  try {
    const currentUser = req.user;

    // Only admins and super_admins can see all chats
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { status, assigned, page = 1, limit = 20 } = req.query;

    // Input validation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    let filter = {};
    if (status && ['open', 'assigned', 'resolved', 'reopened', 'closed'].includes(status)) {
      filter.status = status;
    }
    if (assigned === 'me') filter.assignedTo = currentUser._id;
    else if (assigned === 'unassigned') filter.assignedTo = null;

    const skip = (pageNum - 1) * limitNum;
    const chatSessions = await ChatSession.find(filter)
      .populate('participants.user', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ lastMessage: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ChatSession.countDocuments(filter);

    res.json({
      chatSessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all chat sessions error:', error);
    res.status(500).json({ message: 'Failed to get chat sessions' });
  }
};

// Assign chat to admin
export const assignChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { adminId } = req.body;
    const currentUser = req.user;

    // Only admins and super_admins can assign chats
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Input validation
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const chatSession = await ChatSession.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Verify admin exists and has proper role
    if (adminId) {
      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).json({ message: 'Invalid admin ID format' });
      }

      const admin = await User.findById(adminId);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
        return res.status(400).json({ message: 'Invalid admin ID' });
      }
    }

    const wasUnassigned = !chatSession.assignedTo;
    chatSession.assignedTo = adminId || null;

    // If assigning to an admin, change status to assigned
    if (adminId && (chatSession.status === 'open' || chatSession.status === 'reopened')) {
      chatSession.status = 'assigned';

      // Create system message about admin assignment
      const admin = await User.findById(adminId);
      if (admin) {
        await ChatMessage.create({
          chatId,
          sender: adminId,
          senderRole: 'system',
          message: `${admin.firstName} ${admin.lastName} has been assigned to this chat.`,
          messageType: 'system'
        });
      }
    } else if (!adminId) {
      // If unassigning, change back to open status
      chatSession.status = 'open';
    }

    await chatSession.save();

    await chatSession.populate('assignedTo', 'firstName lastName email');

    // Emit real-time event for chat assignment
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_assigned', {
        chatId,
        assignedTo: adminId,
        chatSession
      });
    }

    res.json({
      message: adminId ? 'Chat assigned successfully' : 'Chat unassigned',
      chatSession
    });
  } catch (error) {
    console.error('Assign chat error:', error);
    res.status(500).json({ message: 'Failed to assign chat' });
  }
};

// Resolve chat session (only admins can resolve)
export const resolveChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUser = req.user;

    // Only admins and super_admins can resolve chats
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Not authorized to resolve chats' });
    }

    // Input validation
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const chatSession = await ChatSession.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Check if chat is already resolved
    if (chatSession.status === 'resolved') {
      return res.status(400).json({ message: 'Chat is already resolved' });
    }

    chatSession.status = 'resolved';
    await chatSession.save();

    // Create system message about resolution
    await ChatMessage.create({
      chatId,
      sender: currentUser._id,
      senderRole: 'system',
      message: `Chat resolved by ${currentUser.firstName} ${currentUser.lastName}.`,
      messageType: 'system'
    });

    // Emit real-time event for chat resolution
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_resolved', {
        chatId,
        chatSession
      });
    }

    res.json({
      message: 'Chat resolved successfully',
      chatSession
    });
  } catch (error) {
    console.error('Resolve chat error:', error);
    res.status(500).json({ message: 'Failed to resolve chat' });
  }
};

// Reopen chat session (only admins can reopen)
export const reopenChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUser = req.user;

    // Only admins and super_admins can reopen chats
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Not authorized to reopen chats' });
    }

    // Input validation
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const chatSession = await ChatSession.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Check if chat is resolved (only resolved chats can be reopened)
    if (chatSession.status !== 'resolved') {
      return res.status(400).json({ message: 'Only resolved chats can be reopened' });
    }

    chatSession.status = 'reopened';
    await chatSession.save();

    // Create system message about reopening
    await ChatMessage.create({
      chatId,
      sender: currentUser._id,
      senderRole: 'system',
      message: `Chat reopened by ${currentUser.firstName} ${currentUser.lastName}.`,
      messageType: 'system'
    });

    // Emit real-time event for chat reopening
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_reopened', {
        chatId,
        chatSession
      });
    }

    res.json({
      message: 'Chat reopened successfully',
      chatSession
    });
  } catch (error) {
    console.error('Reopen chat error:', error);
    res.status(500).json({ message: 'Failed to reopen chat' });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUser = req.user;

    // Input validation
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    // Verify user is participant in chat
    const chatSession = await ChatSession.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    const isParticipant = chatSession.participants.some(p =>
      p.user.toString() === currentUser._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to mark messages as read in this chat' });
    }

    // Update messages
    await ChatMessage.updateMany(
      {
        chatId,
        sender: { $ne: currentUser._id },
        isRead: false
      },
      {
        $set: { isRead: true },
        $push: {
          readBy: {
            user: currentUser._id,
            readAt: new Date()
          }
        }
      }
    );

    // Update chat session unread count
    const unreadCount = await ChatMessage.countDocuments({
      chatId,
      sender: { $ne: currentUser._id },
      isRead: false
    });

    chatSession.unreadCount = unreadCount;
    await chatSession.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
};