/**
 * Application Configuration
 * Handles environment variables with fallbacks, error handling, and secure deployment practices
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Determine the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Handle special case where NODE_ENV is literally "undefined"
const getEnvironment = () => {
  const env = process.env.NODE_ENV;
  
  if (env === undefined || env === 'undefined') {
    console.warn('NODE_ENV is undefined or "undefined", falling back to "development"');
    return 'development';
  }
  
  return env;
};

// Create a configuration object with fallbacks and validation
const config = {
  // Environment Configuration
  env: getEnvironment(),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isStaging: process.env.NODE_ENV === 'staging',

  // Server Configuration
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',

  // Database Configuration
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/sales-tracker',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
  
  // CORS Configuration
  frontendUrls: process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(',').map(url => url.trim())
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://getmyproducts.com'
      ],
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },

  // Frontend URLs
  clientUrl: process.env.CLIENT_URL || 'https://getmyproducts.com',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Security Configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',

  // Process Management
  gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 5000,
  maxEventListeners: parseInt(process.env.MAX_EVENT_LISTENERS) || 100,

  // Feature Flags
  enableLogging: process.env.ENABLE_LOGGING !== 'false',
  enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS !== 'false',
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',

  // Validation
  validate() {
    const errors = [];
    
    // Validate required environment variables
    if (!this.mongoUri) {
      errors.push('MONGO_URI is required');
    }
    
    if (!this.jwtSecret) {
      errors.push('JWT_SECRET is required');
    }
    
    if (!this.email.user) {
      console.warn('EMAIL_USER is not configured - email functionality may be limited');
    }
    
    if (!this.email.pass) {
      console.warn('EMAIL_PASS is not configured - email functionality may be limited');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  },

  // Environment-specific configuration
  getEnvironmentConfig() {
    const env = this.env;
    
    switch (env) {
      case 'production':
        return {
          logLevel: 'warn',
          enableLogging: true,
          enableSecurityHeaders: true,
          enableRateLimiting: true,
          // Production-specific security settings
          security: {
            // CSP headers
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
              }
            }
          }
        };
        
      case 'staging':
        return {
          logLevel: 'info',
          enableLogging: true,
          enableSecurityHeaders: true,
          enableRateLimiting: true
        };
        
      case 'development':
      default:
        return {
          logLevel: 'debug',
          enableLogging: true,
          enableSecurityHeaders: false,
          enableRateLimiting: false
        };
    }
  }
};

// Validate configuration on load
try {
  config.validate();
  console.log(`Application configured for ${config.env} environment`);
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}

// Export configuration
export default config;

// Export environment-specific configurations
export const envConfig = config.getEnvironmentConfig();