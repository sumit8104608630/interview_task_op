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
  STAY_DURATION_EXCEEDED: 'STAY_DURATION_EXCEEDED',
  INSUFFICIENT_ROOMS: 'INSUFFICIENT_ROOMS',
  MISSING_INVENTORY: 'MISSING_INVENTORY',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  CANCELLATION_DEADLINE_PASSED: 'CANCELLATION_DEADLINE_PASSED',
  INVALID_CANCELLATION_PROOF: 'INVALID_CANCELLATION_PROOF',
  EXPIRED_CANCELLATION_PROOF: 'EXPIRED_CANCELLATION_PROOF',
  OTP_REQUIRED: 'OTP_REQUIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  INVALID_PAYMENT_SIGNATURE: 'INVALID_PAYMENT_SIGNATURE',
  PAYMENT_ORDER_NOT_FOUND: 'PAYMENT_ORDER_NOT_FOUND',
  BOOKING_ALREADY_CONFIRMED: 'BOOKING_ALREADY_CONFIRMED',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
});

export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.VALIDATION_ERROR]: 'The request payload or parameters failed validation.',
  [ERROR_CODES.HOTEL_NOT_FOUND]: 'The requested hotel could not be found.',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'The requested room category could not be found.',
  [ERROR_CODES.ROOM_UNAVAILABLE]: 'The selected room is no longer available for the requested stay dates.',
  [ERROR_CODES.INVALID_DATE_RANGE]: 'Check-out date must be strictly after check-in date.',
  [ERROR_CODES.PAST_CHECK_IN_DATE]: 'Check-in date cannot be in the past.',
  [ERROR_CODES.STAY_DURATION_EXCEEDED]: 'Maximum stay duration cannot exceed 30 nights.',
  [ERROR_CODES.INSUFFICIENT_ROOMS]: 'Insufficient rooms available for the requested stay dates.',
  [ERROR_CODES.MISSING_INVENTORY]: 'Inventory is not available for one or more requested stay dates.',
  [ERROR_CODES.BOOKING_NOT_FOUND]: 'No booking matching the provided details could be found.',
  [ERROR_CODES.BOOKING_ALREADY_CANCELLED]: 'This booking has already been cancelled.',
  [ERROR_CODES.CANCELLATION_DEADLINE_PASSED]: 'This booking can no longer be cancelled as check-in has already commenced.',
  [ERROR_CODES.INVALID_CANCELLATION_PROOF]: 'Invalid, expired, or already consumed cancellation authorization proof.',
  [ERROR_CODES.EXPIRED_CANCELLATION_PROOF]: 'The cancellation authorization proof has expired. Please verify a new OTP.',
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
