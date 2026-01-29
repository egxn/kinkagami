/**
 * Logger utility - only logs in development environment
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (tag: string, message: string, data?: unknown) => {
    if (!isDevelopment) return;
    if (data !== undefined) {
      console.log(`[${tag}] ${message}`, data);
    } else {
      console.log(`[${tag}] ${message}`);
    }
  },

  error: (tag: string, message: string, error?: unknown) => {
    if (!isDevelopment) return;
    if (error !== undefined) {
      console.error(`[${tag}] ${message}`, error);
    } else {
      console.error(`[${tag}] ${message}`);
    }
  },

  warn: (tag: string, message: string, data?: unknown) => {
    if (!isDevelopment) return;
    if (data !== undefined) {
      console.warn(`[${tag}] ${message}`, data);
    } else {
      console.warn(`[${tag}] ${message}`);
    }
  },

  info: (tag: string, message: string, data?: unknown) => {
    if (!isDevelopment) return;
    if (data !== undefined) {
      console.info(`[${tag}] ${message}`, data);
    } else {
      console.info(`[${tag}] ${message}`);
    }
  },
};
