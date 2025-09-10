import chalk from 'chalk';
import { LogLevel, LogEntry } from '../types';

export class Logger {
  private level: LogLevel;
  private entries: LogEntry[] = [];
  private maxEntries: number;

  constructor(level: LogLevel = 'info', maxEntries: number = 1000) {
    this.level = level;
    this.maxEntries = maxEntries;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: any, context?: Record<string, any>): void {
    const fullContext = { ...context };
    if (error) {
      if (error instanceof Error) {
        fullContext.error = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      } else {
        fullContext.error = error;
      }
    }
    this.log('error', message, fullContext);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };

    this.entries.push(entry);
    
    // Maintain max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.outputToConsole(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}`;
    
    let coloredMessage: string;
    
    switch (entry.level) {
      case 'debug':
        coloredMessage = chalk.gray(`${prefix}: ${entry.message}`);
        break;
      case 'info':
        coloredMessage = chalk.blue(`${prefix}: ${entry.message}`);
        break;
      case 'warn':
        coloredMessage = chalk.yellow(`${prefix}: ${entry.message}`);
        break;
      case 'error':
        coloredMessage = chalk.red(`${prefix}: ${entry.message}`);
        break;
    }

    console.log(coloredMessage);

    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(chalk.gray(JSON.stringify(entry.context, null, 2)));
    }
  }

  getEntries(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = this.entries;
    
    if (level) {
      filtered = filtered.filter(entry => entry.level === level);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  clear(): void {
    this.entries = [];
  }
}
