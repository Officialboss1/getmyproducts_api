import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    index: true,
    maxlength: 100
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    required: true,
    enum: ['customer', 'salesperson', 'admin', 'super_admin', 'team_head', 'system', 'bot']
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    minlength: 1
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'bot'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// TTL index for messages older than 90 days
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Index for efficient queries
chatMessageSchema.index({ chatId: 1, timestamp: -1 });
chatMessageSchema.index({ sender: 1, timestamp: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// Chat session/conversation schema
const chatSessionSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['customer', 'salesperson', 'admin', 'super_admin', 'team_head']
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['open', 'assigned', 'resolved', 'reopened', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'sales', 'technical', 'billing', 'support'],
    default: 'general'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastMessage: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatSessionSchema.index({ status: 1, lastMessage: -1 });
chatSessionSchema.index({ assignedTo: 1, status: 1 });
chatSessionSchema.index({ 'participants.user': 1 });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export { ChatMessage, ChatSession };
export default ChatMessage;