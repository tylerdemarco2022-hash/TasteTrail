/**
 * PRODUCTION-SAFE STRUCTURED LOGGER
 * 
 * Purpose: Replace console.log/warn/error with structured logging
 * 
 * Features:
 * - JSON-formatted logs for production parsing
 * - Timestamp + context in every log
 * - No console spam in production
 * - Compatible with log aggregation services (DataDog, Splunk, etc.)
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

/**
 * Log levels
 */
const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format structured log entry
 */
function formatLog(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  
  const entry = {
    timestamp,
    level,
    message,
    ...metadata
  };
  
  return JSON.stringify(entry);
}

/**
 * Logger class
 */
class Logger {
  error(messageOrMetadata, metadata = {}) {
    if (typeof messageOrMetadata === 'string') {
      console.error(formatLog(LogLevel.ERROR, messageOrMetadata, metadata));
    } else {
      // If first arg is object, treat as metadata with message inside
      const { message, ...rest } = messageOrMetadata;
      console.error(formatLog(LogLevel.ERROR, message || 'Error', rest));
    }
  }
  
  warn(messageOrMetadata, metadata = {}) {
    if (typeof messageOrMetadata === 'string') {
      console.warn(formatLog(LogLevel.WARN, messageOrMetadata, metadata));
    } else {
      const { message, ...rest } = messageOrMetadata;
      console.warn(formatLog(LogLevel.WARN, message || 'Warning', rest));
    }
  }
  
  info(messageOrMetadata, metadata = {}) {
    if (typeof messageOrMetadata === 'string') {
      console.log(formatLog(LogLevel.INFO, messageOrMetadata, metadata));
    } else {
      const { message, ...rest } = messageOrMetadata;
      console.log(formatLog(LogLevel.INFO, message || 'Info', rest));
    }
  }
  
  debug(messageOrMetadata, metadata = {}) {
    // Only log debug in development
    if (!isDevelopment) return;
    
    if (typeof messageOrMetadata === 'string') {
      console.log(formatLog(LogLevel.DEBUG, messageOrMetadata, metadata));
    } else {
      const { message, ...rest } = messageOrMetadata;
      console.log(formatLog(LogLevel.DEBUG, message || 'Debug', rest));
    }
  }
}

export const logger = new Logger();
export { LogLevel };
