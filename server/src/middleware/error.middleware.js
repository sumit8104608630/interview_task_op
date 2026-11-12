import { sendError } from '../utils/apiResponse.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';
import { env } from '../config/env.js';

/**
 * Custom application operational error class
 */
export class AppError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message || ERROR_MESSAGES[code] || 'Application error');
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized Express error-handling middleware
 */
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Handle JSON syntax parsing errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Malformed JSON payload in request body.',
    });
  }

  // Handle known operational AppError instances
  if (err.isOperational) {
    return sendError(res, {
      statusCode: err.statusCode || 400,
      code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: err.message,
      details: err.details,
    });
  }

  // Unhandled / unexpected system error
  console.error('[Unhandled Server Error]', {
    requestId: res.locals?.requestId,
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: env.isDevelopment ? err.stack : undefined,
  });

  return sendError(res, {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_SERVER_ERROR],
    ...(env.isDevelopment && { details: err.message }),
  });
};

export default errorHandler;
