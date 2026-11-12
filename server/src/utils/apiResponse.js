/**
 * Formats a standardized successful API response
 * @param {object} res - Express response object
 * @param {number} [statusCode=200] - HTTP status code
 * @param {any} [data=null] - Payload to return
 * @param {string} [message] - Optional human-readable message
 * @param {object} [meta] - Optional pagination or metadata
 */
export const sendSuccess = (res, { statusCode = 200, data = null, message, meta } = {}) => {
  const payload = {
    success: true,
    ...(data !== null && { data }),
    ...(message && { message }),
    ...(meta && { meta }),
    requestId: res.locals?.requestId,
  };

  return res.status(statusCode).json(payload);
};

/**
 * Formats a standardized error API response
 * @param {object} res - Express response object
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string} code - Machine-readable error code
 * @param {string} message - User-safe error description
 * @param {any} [details] - Optional validation details
 */
export const sendError = (res, { statusCode = 500, code = 'INTERNAL_SERVER_ERROR', message = 'An error occurred', details } = {}) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    requestId: res.locals?.requestId,
  };

  return res.status(statusCode).json(payload);
};

export default {
  sendSuccess,
  sendError,
};
