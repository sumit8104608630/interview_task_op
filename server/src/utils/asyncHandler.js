/**
 * Wraps an async route handler or controller to automatically forward errors to next()
 * Eliminates repetitive try-catch blocks across controllers.
 * @param {Function} fn - Async Express handler (req, res, next)
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
