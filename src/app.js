import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dotenvSafe from 'dotenv-safe';
import connectDB from './config/db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import targetsRoutes from './routes/targetsRoutes.js';
import competitionRoutes from './routes/competitionRoutes.js';
import customerCodeRoutes from './routes/customerCodeRoutes.js';
import productRoutes from './routes/productRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

// Import middleware
import errorHandler from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimitMiddleware.js';

// Load environment variables
dotenv.config();
dotenvSafe.config({
  example: '.env.example',
  allowEmptyValues: false
});

// Connect to database
connectDB();

const app = express();
const server = createServer(app);

// Parse allowed origins from .env (comma separated)
const allowedOrigins = process.env.FRONTEND_URLS
  ? process.env.FRONTEND_URLS.split(",").map(url => url.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://salestracker.silverspringbank.com"
    ];

// Socket.IO setup for real-time chat
const io = new Server(server, {
  cors: {
    origin: [
      "https://getmyproducts.com",
      "https://salestracker.silverspringbank.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

console.log('Socket.IO server initialized with config:', {
  corsOrigins: allowedOrigins,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  timestamp: new Date().toISOString()
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any localhost during development
    if (origin.startsWith("http://localhost:")) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/customer-codes', customerCodeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, {
    handshake: {
      auth: socket.handshake.auth,
      headers: socket.handshake.headers,
      query: socket.handshake.query,
      address: socket.handshake.address,
      time: new Date().toISOString()
    }
  });

  // Join chat room
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`, {
      chatId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  // Leave chat room
  socket.on('leave-chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat ${chatId}`, {
      chatId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle new message
  socket.on('send-message', (data) => {
    const { chatId, message } = data;
    // Broadcast to all users in the chat room except sender
    socket.to(chatId).emit('new-message', message);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { chatId, userId, isTyping } = data;
    socket.to(chatId).emit('user-typing', { userId, isTyping });
  });

  // Listen for chat events from controllers
  socket.on('new_chat', (data) => {
    // Broadcast to all connected clients (admins will handle filtering)
    socket.broadcast.emit('new_chat', data);
  });

  socket.on('chat_assigned', (data) => {
    socket.broadcast.emit('chat_assigned', data);
  });

  socket.on('chat_resolved', (data) => {
    socket.broadcast.emit('chat_resolved', data);
  });

  socket.on('chat_reopened', (data) => {
    socket.broadcast.emit('chat_reopened', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, {
      reason,
      timestamp: new Date().toISOString()
    });
  });
});

// Make io accessible in routes
app.set('io', io);

// Global error handling middleware (must be last)
app.use(errorHandler);

export default app;
export { server, io };