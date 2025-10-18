import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";
import { createServer } from "http";
import { Server } from "socket.io";

// Route Imports
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import salesRoutes from "./src/routes/salesRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import auditRoutes from "./src/routes/auditRoutes.js";
import targetsRoutes from "./src/routes/targetsRoutes.js";
import competitionRoutes from "./src/routes/competitionRoutes.js";
import customerCodeRoutes from "./src/routes/customerCodeRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import referralRoutes from "./src/routes/referralRoutes.js";
import settingRoutes from "./src/routes/settingRoutes.js";
import superAdminRoutes from "./src/routes/superAdminRoutes.js";
import systemRoutes from "./src/routes/systemRoutes.js";

// Import configuration
import config from "./src/config/index.js";
import { setupProcessListeners, logSystemInfo } from "./src/utils/processManager.js";

dotenv.config();
connectDB();

const app = express();
const server = createServer(app);

// Parse allowed origins from config
const allowedOrigins = config.frontendUrls;

// CORS setup
app.use(
  cors({
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
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/targets", targetsRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/customer-codes", customerCodeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/system", systemRoutes);

// Socket.IO setup with JWT authentication middleware
const io = new Server(server, {
  cors: {
    origin: config.frontendUrls,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) {
    console.log('Socket connection rejected: No token provided');
    return next(new Error('Authentication error: No token provided'));
  }

  // Verify JWT token (using the same method as the rest of the app)
  import('jsonwebtoken').then(({ default: jwt }) => {
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        console.log('Socket connection rejected: Invalid token', err.message);
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.decodedToken = decoded;
      console.log('Socket authenticated for user:', decoded.id || decoded._id);
      next();
    });
  }).catch(err => {
    console.error('JWT import error:', err);
    next(new Error('Authentication error: Server configuration issue'));
  });
});

console.log('Socket.IO server initialized with config:', {
  corsOrigins: allowedOrigins,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  timestamp: new Date().toISOString()
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id, {
    handshake: {
      auth: socket.handshake.auth,
      headers: socket.handshake.headers,
      query: socket.handshake.query,
      address: socket.handshake.address,
      time: new Date().toISOString()
    }
  });

  socket.on("join-chat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on("leave-chat", (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat ${chatId}`);
  });

  socket.on("send-message", (data) => {
    const { chatId, message } = data;
    socket.to(chatId).emit("new-message", message);
  });

  socket.on("typing", (data) => {
    const { chatId, userId, isTyping } = data;
    socket.to(chatId).emit("user-typing", { userId, isTyping });
  });

  socket.on("new_chat", (data) => {
    socket.broadcast.emit("new_chat", data);
  });

  socket.on("chat_assigned", (data) => {
    socket.broadcast.emit("chat_assigned", data);
  });

  socket.on("chat_resolved", (data) => {
    socket.broadcast.emit("chat_resolved", data);
  });

  socket.on("chat_reopened", (data) => {
    socket.broadcast.emit("chat_reopened", data);
  });

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, {
      reason,
      timestamp: new Date().toISOString()
    });
  });
});

// Health check endpoints
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.env,
    nodeVersion: process.version,
    uptime: process.uptime(),
    socketIO: {
      enabled: true,
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    }
  });
});

// Root health check for compatibility
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.env,
    nodeVersion: process.version,
    uptime: process.uptime()
  });
});

// Make io accessible in routes
app.set("io", io);

const PORT = process.env.PORT || 8001;
const HOST = process.env.HOST || '0.0.0.0'; // ✅ Listen on all interfaces

// Log system information
logSystemInfo();



server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Retrying...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT);
    }, 1000);
  } else {
    throw err;
  }
});


server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${config.env}`);
});

// Setup process listeners for graceful shutdown
setupProcessListeners(server, io);
