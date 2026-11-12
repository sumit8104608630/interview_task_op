import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for checking room availability across stay dates
 * Supports both /api/rooms/availability?roomTypeId=... and /api/room-types/:id/availability
 */
export const roomAvailabilityQuerySchema = z.object({
  roomTypeId: z.string().trim().min(1, 'Room type ID is required').optional(),
  checkIn: z.string().refine(isValidIsoDate, {
    message: 'checkIn must be a valid date in YYYY-MM-DD format',
  }),
  checkOut: z.string().refine(isValidIsoDate, {
    message: 'checkOut must be a valid date in YYYY-MM-DD format',
  }),
  rooms: z.coerce.number().int().positive().default(1).optional(),
});

/**
 * Validation schema for room type ID route parameter
 */
export const roomParamSchema = z.object({
  id: z.string().trim().min(1, 'Room ID is required').optional(),
  roomTypeId: z.string().trim().min(1, 'Room ID is required').optional(),
});

export default {
  roomAvailabilityQuerySchema,
  roomParamSchema,
};
