import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat specific rate limiter - more restrictive
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 chat requests per minute
  message: 'Too many chat requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending rate limiter - very restrictive
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 messages per minute
  message: 'Too many messages sent, please wait before sending more.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat creation rate limiter
export const chatCreateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 chat creations per minute
  message: 'Too many chat sessions created, please wait before creating more.',
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  apiLimiter,
  chatLimiter,
  messageLimiter,
  chatCreateLimiter
};