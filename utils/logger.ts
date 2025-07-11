/**
 * Enhanced logging utility for debugging and monitoring
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private sessionId: string;

  constructor() {
    this.logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    this.sessionId = this.generateSessionId();
    
    // Listen for unhandled errors
    this.setupGlobalErrorHandling();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandling() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
      });
    });

    // Catch global JavaScript errors
    window.addEventListener('error', (event) => {
      this.error('Global JavaScript Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context,
      sessionId: this.sessionId,
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Send to external logging service if configured
    this.sendToExternalService(entry);
  }

  private sendToExternalService(entry: LogEntry) {
    // In production, you would send logs to a service like:
    // - Sentry
    // - LogRocket
    // - DataDog
    // - Custom logging endpoint
    
    if (process.env.NODE_ENV === 'development') {
      return; // Don't send in development
    }

    // Example implementation:
    // fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry),
    // }).catch(() => {
    //   // Silently fail if logging service is unavailable
    // });
  }

  private formatConsoleOutput(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const context = entry.context ? `[${entry.context}]` : '';
    return `${timestamp} ${context} ${entry.message}`;
  }

  debug(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry(LogLevel.DEBUG, message, data, context);
    this.addLog(entry);

    console.debug(this.formatConsoleOutput(entry), data || '');
  }

  info(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry(LogLevel.INFO, message, data, context);
    this.addLog(entry);

    console.info(this.formatConsoleOutput(entry), data || '');
  }

  warn(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry(LogLevel.WARN, message, data, context);
    this.addLog(entry);

    console.warn(this.formatConsoleOutput(entry), data || '');
  }

  error(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry(LogLevel.ERROR, message, data, context);
    this.addLog(entry);

    console.error(this.formatConsoleOutput(entry), data || '');
  }

  // API-specific logging methods
  apiRequest(method: string, url: string, data?: any) {
    this.debug(`API Request: ${method} ${url}`, data, 'API');
  }

  apiResponse(method: string, url: string, status: number, data?: any) {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    const message = `API Response: ${method} ${url} - ${status}`;
    
    if (level === LogLevel.ERROR) {
      this.error(message, data, 'API');
    } else {
      this.debug(message, data, 'API');
    }
  }

  apiError(method: string, url: string, error: any) {
    this.error(`API Error: ${method} ${url}`, error, 'API');
  }

  // User action logging
  userAction(action: string, data?: any) {
    this.info(`User Action: ${action}`, data, 'USER');
  }

  // Performance logging
  performance(operation: string, duration: number, data?: any) {
    this.info(`Performance: ${operation} took ${duration}ms`, data, 'PERF');
  }

  // Get logs for debugging
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  // Export logs for support
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Set log level
  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }
}

// Create singleton instance
export const logger = new Logger();

// Convenience functions for common use cases
export const logApiCall = (method: string, url: string, data?: any) => {
  logger.apiRequest(method, url, data);
};

export const logApiResponse = (method: string, url: string, status: number, data?: any) => {
  logger.apiResponse(method, url, status, data);
};

export const logUserAction = (action: string, data?: any) => {
  logger.userAction(action, data);
};

export const logError = (message: string, error?: any, context?: string) => {
  logger.error(message, error, context);
};

export default logger;
