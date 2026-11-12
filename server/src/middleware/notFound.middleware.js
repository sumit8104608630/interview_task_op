import { sendError } from '../utils/apiResponse.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * 404 Not Found catch-all middleware for unmatched routes
 */
export const notFound = (req, res) => {
  return sendError(res, {
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
    message: `${ERROR_MESSAGES[ERROR_CODES.NOT_FOUND]} (${req.method} ${req.originalUrl})`,
  });
};

export default notFound;
