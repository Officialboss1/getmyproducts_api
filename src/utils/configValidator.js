/**
 * Configuration Validator
 * Validates and sanitizes environment variables with fallbacks and error handling
 */

import config from '../config/index.js';

/**
 * Validates that required environment variables are properly set
 * @returns {Object} Validation result with errors and warnings
 */
export const validateConfig = () => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Validate required fields
  if (!config.mongoUri) {
    result.isValid = false;
    result.errors.push('MONGO_URI is required');
  }

  if (!config.jwtSecret) {
    result.isValid = false;
    result.errors.push('JWT_SECRET is required');
  }

  if (!config.email.user && config.email.pass) {
    result.warnings.push('EMAIL_USER is not configured but EMAIL_PASS is set');
  }

  if (config.email.user && !config.email.pass) {
    result.warnings.push('EMAIL_PASS is not configured but EMAIL_USER is set');
  }

  // Validate environment
  const validEnvironments = ['development', 'staging', 'production'];
  if (!validEnvironments.includes(config.env)) {
    result.warnings.push(`NODE_ENV is set to "${config.env}" which is not a recognized environment. Valid values: ${validEnvironments.join(', ')}`);
  }

  // Validate port
  if (config.port && (isNaN(config.port) || config.port < 1 || config.port > 65535)) {
    result.isValid = false;
    result.errors.push('PORT must be a valid number between 1 and 65535');
  }

  // Validate frontend URLs
  if (Array.isArray(config.frontendUrls)) {
    config.frontendUrls.forEach((url, index) => {
      try {
        new URL(url);
      } catch (e) {
        result.warnings.push(`Frontend URL at index ${index} is not a valid URL: ${url}`);
      }
    });
  }

  return result;
};

/**
 * Provides fallback values for environment variables
 * @param {string} key - The environment variable key
 * @param {*} defaultValue - Default value to use if key is not set
 * @param {Function} validator - Optional validator function
 * @returns {*} The value or fallback
 */
export const getEnvVar = (key, defaultValue, validator = null) => {
  const value = process.env[key];
  
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  if (validator && !validator(value)) {
    console.warn(`Environment variable ${key} failed validation, using default value`);
    return defaultValue;
  }
  
  return value;
};

/**
 * Gets the current environment with fallback for undefined NODE_ENV
 * @returns {string} Environment name
 */
export const getCurrentEnvironment = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Handle special case where NODE_ENV is literally "undefined"
  if (env === 'undefined') {
    console.warn('NODE_ENV is set to "undefined", falling back to "development"');
    return 'development';
  }
  
  return env;
};

/**
 * Creates a sanitized configuration object
 * @returns {Object} Sanitized configuration
 */
export const getSanitizedConfig = () => {
  const sanitized = { ...config };
  
  // Ensure environment is properly handled
  sanitized.env = getCurrentEnvironment();
  
  // Ensure fallbacks for sensitive values
  sanitized.jwtSecret = sanitized.jwtSecret || 'fallback_jwt_secret_for_development';
  
  return sanitized;
};