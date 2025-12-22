import { configs } from '../commands/readOps/configs';
import winston from 'winston';

// Create logger instance
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error'
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      }),
    ],
});

// If not in production, also log to console
if (configs.load().cluster == 'devnet') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}