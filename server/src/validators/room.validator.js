import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for checking room availability across stay dates
 */
export const roomAvailabilityQuerySchema = z.object({
  checkIn: z.string().refine(isValidIsoDate, {
    message: 'checkIn must be a valid date in YYYY-MM-DD format',
  }),
  checkOut: z.string().refine(isValidIsoDate, {
    message: 'checkOut must be a valid date in YYYY-MM-DD format',
  }),
});

/**
 * Validation schema for room type ID route parameter
 */
export const roomParamSchema = z.object({
  id: z.string().trim().min(1, 'Room ID is required'),
});

export default {
  roomAvailabilityQuerySchema,
  roomParamSchema,
};
