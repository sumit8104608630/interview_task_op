import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';
import { ERROR_CODES } from '../constants/errorMessages.js';

/**
 * Creates an Express middleware that validates incoming request against Zod schemas
 * Supports validation of req.body, req.query, and req.params simultaneously.
 *
 * @param {object} schemas
 * @param {import('zod').ZodTypeAny} [schemas.body]
 * @param {import('zod').ZodTypeAny} [schemas.query]
 * @param {import('zod').ZodTypeAny} [schemas.params]
 * @returns {Function} Express middleware function
 */
export const validate = (schemas = {}) => async (req, res, next) => {
  try {
    if (schemas.params) {
      req.params = await schemas.params.parseAsync(req.params);
    }
    if (schemas.query) {
      req.query = await schemas.query.parseAsync(req.query);
    }
    if (schemas.body) {
      req.body = await schemas.body.parseAsync(req.body);
    }
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return sendError(res, {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request data.',
        details,
      });
    }
    return next(error);
  }
};

export default validate;
