import morgan from 'morgan';
import crypto from 'crypto';

/**
 * Middleware to assign or propagate a unique request ID for distributed tracing
 */
export const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.trim().length > 0
    ? incomingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// Define Morgan custom token for request-id
morgan.token('request-id', (req, res) => res.locals.requestId || req.id || '-');

/**
 * Morgan HTTP request logger configured for clean console logging
 */
export const requestLogger = morgan(
  ':date[iso] [:request-id] :method :url :status :response-time ms - :res[content-length]',
  {
    skip: (req) => req.url === '/api/health', // Keep health checks clean from high-frequency poll logs
  }
);

export default {
  requestIdMiddleware,
  requestLogger,
};
