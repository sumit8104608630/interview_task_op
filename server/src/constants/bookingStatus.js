/**
 * Standardized booking status values for the Hotel Booking Portal
 */
export const BOOKING_STATUS = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
});

export const VALID_BOOKING_STATUSES = Object.values(BOOKING_STATUS);

export default BOOKING_STATUS;
