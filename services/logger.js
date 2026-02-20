import { createLogger, format, transports } from 'winston';
// const monitoring = require('./monitoring');

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level,
  defaultMeta: { service: 'taste-trails-backend' },
  format: isProd
    ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
    : format.combine(format.colorize(), format.timestamp(), format.splat(), format.printf(({ level, message, timestamp, stack, ...meta }) => {
        const err = stack ? `\n${stack}` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}${err}`;
      })),
  transports: [new transports.Console()],
});

// Monitoring/Sentry integration disabled (monitoring module missing)

export default logger;
