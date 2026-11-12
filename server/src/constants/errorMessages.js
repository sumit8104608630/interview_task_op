/**
 * Centralized, standardized error codes and user-safe messages
 * Prevents information leakage while providing clear client diagnostics.
 */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  HOTEL_NOT_FOUND: 'HOTEL_NOT_FOUND',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_UNAVAILABLE: 'ROOM_UNAVAILABLE',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  PAST_CHECK_IN_DATE: 'PAST_CHECK_IN_DATE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  CANCELLATION_DEADLINE_PASSED: 'CANCELLATION_DEADLINE_PASSED',
  OTP_REQUIRED: 'OTP_REQUIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
});

export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.VALIDATION_ERROR]: 'The request payload or parameters failed validation.',
  [ERROR_CODES.HOTEL_NOT_FOUND]: 'The requested hotel could not be found.',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'The requested room category could not be found.',
  [ERROR_CODES.ROOM_UNAVAILABLE]: 'The selected room is no longer available for the requested stay dates.',
  [ERROR_CODES.INVALID_DATE_RANGE]: 'Check-out date must be strictly after check-in date.',
  [ERROR_CODES.PAST_CHECK_IN_DATE]: 'Check-in date cannot be in the past.',
  [ERROR_CODES.BOOKING_NOT_FOUND]: 'No booking matching the provided details could be found.',
  [ERROR_CODES.BOOKING_ALREADY_CANCELLED]: 'This booking has already been cancelled.',
  [ERROR_CODES.CANCELLATION_DEADLINE_PASSED]: 'This booking can no longer be cancelled as check-in has already commenced.',
  [ERROR_CODES.OTP_REQUIRED]: 'A valid OTP is required to proceed with this operation.',
  [ERROR_CODES.OTP_INVALID]: 'The provided OTP is invalid or has expired.',
  [ERROR_CODES.OTP_EXPIRED]: 'The OTP has expired. Please request a new one.',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'An upstream notification or verification service error occurred. Please try again.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again.',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'An unexpected internal server error occurred.',
  [ERROR_CODES.NOT_FOUND]: 'The requested API resource was not found.',
});

export default {
  ERROR_CODES,
  ERROR_MESSAGES,
};
