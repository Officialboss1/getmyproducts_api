/**
 * Process Manager
 * Handles graceful shutdowns, cross-platform compatibility, and process management
 */

import config from '../config/index.js';

/**
 * Graceful shutdown handler
 * @param {Object} server - HTTP server instance
 * @param {Object} io - Socket.IO server instance
 * @param {Function} callback - Optional callback function
 */
export const gracefulShutdown = async (server, io, callback = null) => {
  console.log('Shutting down gracefully...');
  
  try {
    // Close Socket.IO connections
    if (io) {
      io.close(() => {
        console.log('Socket.IO connections closed');
      });
    }
    
    // Close HTTP server
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }
    
    // Give some time for cleanup
    setTimeout(() => {
      console.log('Process terminated');
      if (callback) callback();
      process.exit(0);
    }, config.gracefulShutdownTimeout);
    
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

/**
 * Setup process event listeners for graceful shutdown
 * @param {Object} server - HTTP server instance
 * @param {Object} io - Socket.IO server instance
 */
export const setupProcessListeners = (server, io) => {
  // Handle different shutdown signals
  const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  shutdownSignals.forEach(signal => {
    process.on(signal, () => {
      console.log(`Received ${signal}, initiating graceful shutdown...`);
      gracefulShutdown(server, io);
    });
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown(server, io);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown(server, io);
  });
  
  // Handle multiple event listeners warning
  process.setMaxListeners(config.maxEventListeners);
};

/**
 * Cross-platform environment detection
 * @returns {Object} Platform information
 */
export const getPlatformInfo = () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    uptime: process.uptime(),
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed
    }
  };
};

/**
 * Check if running in production environment
 * @returns {boolean} True if running in production
 */
export const isProduction = () => {
  return config.env === 'production';
};

/**
 * Check if running in development environment
 * @returns {boolean} True if running in development
 */
export const isDevelopment = () => {
  return config.env === 'development';
};

/**
 * Check if running in staging environment
 * @returns {boolean} True if running in staging
 */
export const isStaging = () => {
  return config.env === 'staging';
};

/**
 * Get environment-specific configuration
 * @returns {Object} Environment-specific configuration
 */
export const getEnvSpecificConfig = () => {
  return config.getEnvironmentConfig();
};

/**
 * Log system information for debugging
 */
export const logSystemInfo = () => {
  const platformInfo = getPlatformInfo();
  console.log('System Information:', {
    environment: config.env,
    platform: platformInfo.platform,
    architecture: platformInfo.arch,
    nodeVersion: platformInfo.version,
    uptime: platformInfo.uptime,
    memoryUsage: {
      rss: `${(platformInfo.memory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(platformInfo.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(platformInfo.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    }
  });
};