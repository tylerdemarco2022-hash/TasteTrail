const { createLogger, format, transports } = require('winston');
const monitoring = require('./monitoring');

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

// If Sentry is enabled and logging level is error, forward errors to Sentry.
if (monitoring && monitoring.enabled) {
  const Sentry = monitoring.Sentry;
  const origError = logger.error.bind(logger);
  logger.error = (msg, ...meta) => {
    try {
      if (msg instanceof Error) {
        Sentry.captureException(msg);
      } else {
        // create an Error for the message to capture stack and context
        const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        Sentry.captureException(err);
      }
      if (meta && meta.length) {
        try { Sentry.addBreadcrumb({ category: 'log', message: JSON.stringify(meta) }); } catch (e) {}
      }
    } catch (e) {
      // swallow
    }
    return origError(msg, ...meta);
  };
}

module.exports = logger;
